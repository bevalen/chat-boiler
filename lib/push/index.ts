import webpush from "web-push";
import { SupabaseClient } from "@supabase/supabase-js";

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://madewell-maia.vercel.app";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    `mailto:notifications@${new URL(appUrl).hostname}`,
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    id?: string;
    linkType?: string;
    linkId?: string;
    [key: string]: unknown;
  };
}

/**
 * Send a push notification to all subscribed devices for an agent
 */
export async function sendPushNotification(
  supabase: SupabaseClient,
  agentId: string,
  payload: PushPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured, skipping push notification");
    return { success: false, sent: 0, failed: 0 };
  }

  try {
    // Get all push subscriptions for this agent
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("agent_id", agentId);

    if (error) {
      console.error("Error fetching push subscriptions:", error);
      return { success: false, sent: 0, failed: 0 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const staleSubscriptions: string[] = [];

    // Send to all subscriptions
    const sendPromises = subscriptions.map(async (sub: PushSubscription & { id: string }) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || "/logos/profile-icon-512.png",
            badge: payload.badge || "/logos/profile-icon-512.png",
            data: payload.data || {},
          })
        );
        sent++;
      } catch (err) {
        failed++;
        const error = err as { statusCode?: number };
        // If subscription is expired or invalid, mark for cleanup
        if (error.statusCode === 404 || error.statusCode === 410) {
          staleSubscriptions.push(sub.id);
        } else {
          console.error("Error sending push notification:", err);
        }
      }
    });

    await Promise.all(sendPromises);

    // Clean up stale subscriptions
    if (staleSubscriptions.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", staleSubscriptions);
      console.log(`Cleaned up ${staleSubscriptions.length} stale push subscriptions`);
    }

    return { success: true, sent, failed };
  } catch (error) {
    console.error("Error in sendPushNotification:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}

/**
 * Send push notification for a new in-app notification
 */
export async function sendNotificationPush(
  supabase: SupabaseClient,
  agentId: string,
  notification: {
    id: string;
    title: string;
    content?: string | null;
    linkType?: string | null;
    linkId?: string | null;
  }
): Promise<void> {
  await sendPushNotification(supabase, agentId, {
    title: notification.title,
    body: notification.content || "You have a new notification from MAIA",
    data: {
      id: notification.id,
      linkType: notification.linkType || undefined,
      linkId: notification.linkId || undefined,
    },
  });
}
