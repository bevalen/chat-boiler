import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/database";
import { sendNotificationPush } from "@/lib/push";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

export interface Notification {
  id: string;
  agentId: string;
  type: "reminder" | "new_message" | "task_update" | "project_update";
  title: string;
  content: string | null;
  linkType: "conversation" | "task" | "project" | "reminder" | null;
  linkId: string | null;
  read: boolean;
  createdAt: string | null;
}

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type,
    title: row.title,
    content: row.content,
    linkType: row.link_type,
    linkId: row.link_id,
    read: row.read,
    createdAt: row.created_at,
  };
}

/**
 * Create a new notification
 */
export async function createNotification(
  supabase: SupabaseClient,
  agentId: string,
  type: NotificationInsert["type"],
  title: string,
  content?: string | null,
  linkType?: NotificationInsert["link_type"],
  linkId?: string | null
): Promise<{ notification: Notification | null; error: string | null }> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      agent_id: agentId,
      type,
      title,
      content: content || null,
      link_type: linkType || null,
      link_id: linkId || null,
      read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    return { notification: null, error: error.message };
  }

  const notification = mapNotificationRow(data);

  // Send push notification (async, don't block)
  sendNotificationPush(supabase, agentId, {
    id: notification.id,
    title: notification.title,
    content: notification.content,
    linkType: notification.linkType,
    linkId: notification.linkId,
  }).catch((err) => {
    console.error("Error sending push notification:", err);
  });

  return { notification, error: null };
}

/**
 * Get notifications for an agent
 */
export async function getNotifications(
  supabase: SupabaseClient,
  agentId: string,
  options: {
    limit?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<{ notifications: Notification[]; error: string | null }> {
  const { limit = 50, unreadOnly = false } = options;

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching notifications:", error);
    return { notifications: [], error: error.message };
  }

  return {
    notifications: (data || []).map(mapNotificationRow),
    error: null,
  };
}

/**
 * Get unread notification count for an agent
 */
export async function getUnreadCount(
  supabase: SupabaseClient,
  agentId: string
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("read", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return { count: 0, error: error.message };
  }

  return { count: count || 0, error: null };
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("Error marking notification as read:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Mark all notifications as read for an agent
 */
export async function markAllAsRead(
  supabase: SupabaseClient,
  agentId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("agent_id", agentId)
    .eq("read", false);

  if (error) {
    console.error("Error marking all notifications as read:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  supabase: SupabaseClient,
  notificationId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) {
    console.error("Error deleting notification:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Delete all read notifications older than a certain date
 */
export async function cleanupOldNotifications(
  supabase: SupabaseClient,
  agentId: string,
  olderThanDays: number = 30
): Promise<{ deletedCount: number; error: string | null }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("agent_id", agentId)
    .eq("read", true)
    .lt("created_at", cutoffDate.toISOString())
    .select("id");

  if (error) {
    console.error("Error cleaning up notifications:", error);
    return { deletedCount: 0, error: error.message };
  }

  return { deletedCount: data?.length || 0, error: null };
}
