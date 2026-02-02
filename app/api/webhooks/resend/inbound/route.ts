import { NextRequest, NextResponse } from "next/server";
import { resend, RESEND_WEBHOOK_SECRET, parseAgentEmailAddress } from "@/lib/email/resend-client";
import { getAdminClient } from "@/lib/supabase/admin";
import { storeInboundEmail, findAgentByEmailAddress } from "@/lib/db/emails";
import { logActivity } from "@/lib/db/activity-log";
import { createNotification } from "@/lib/db/notifications";

/**
 * Resend Inbound Email Webhook Handler
 * 
 * Receives email.received events from Resend and:
 * 1. Verifies webhook signature
 * 2. Routes to correct agent based on recipient address
 * 3. Fetches full email content via Resend API
 * 4. Stores in database
 * 5. Creates notification for user
 */

// Rate limiting map (in-memory, resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PER_HOUR = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(sender: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sender);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(sender, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_PER_HOUR) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  console.log("[resend-webhook] Received inbound email webhook");

  try {
    // Get the raw payload for signature verification
    const payload = await req.text();
    
    // Verify webhook signature
    if (!RESEND_WEBHOOK_SECRET) {
      console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (!resend) {
      console.error("[resend-webhook] Resend client not initialized");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    // Get Svix headers for verification
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("[resend-webhook] Missing Svix headers");
      return NextResponse.json(
        { error: "Missing webhook signature headers" },
        { status: 400 }
      );
    }

    // Verify the webhook signature
    let event;
    try {
      event = resend.webhooks.verify({
        payload,
        headers: {
          id: svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        secret: RESEND_WEBHOOK_SECRET,
      });
    } catch (verifyError) {
      console.error("[resend-webhook] Signature verification failed:", verifyError);
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    console.log("[resend-webhook] Verified webhook event:", event.type);

    // Handle different event types
    if (event.type === "email.received") {
      return await handleEmailReceived(event.data);
    } else if (event.type === "email.delivered") {
      return await handleEmailDelivered(event.data);
    } else if (event.type === "email.bounced") {
      return await handleEmailBounced(event.data);
    } else {
      console.log("[resend-webhook] Unhandled event type:", event.type);
      return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("[resend-webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface EmailReceivedData {
  email_id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  attachments?: {
    id: string;
    filename: string;
    content_type: string;
  }[];
}

async function handleEmailReceived(data: EmailReceivedData) {
  const { email_id, from, to, cc, bcc, subject, attachments } = data;
  
  console.log(`[resend-webhook] Processing received email from ${from} to ${to.join(", ")}`);

  // Rate limit by sender
  if (!checkRateLimit(from.toLowerCase())) {
    console.warn(`[resend-webhook] Rate limit exceeded for sender: ${from}`);
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const supabase = getAdminClient();

  // Find the agent based on recipient email address
  // We need to check all recipients to find one that matches our agent email format
  let agent: { id: string; user_id: string; name: string } | null = null;
  let matchedRecipient: string | null = null;

  for (const recipient of to) {
    const userId = parseAgentEmailAddress(recipient);
    if (userId) {
      const result = await findAgentByEmailAddress(supabase, recipient);
      if (result.agent) {
        agent = result.agent;
        matchedRecipient = recipient;
        break;
      }
    }
  }

  if (!agent) {
    console.warn(`[resend-webhook] No matching agent found for recipients: ${to.join(", ")}`);
    // Don't return error - just acknowledge receipt
    // The email might be for a non-existent or deleted user
    return NextResponse.json({ received: true, status: "no_agent_found" });
  }

  console.log(`[resend-webhook] Routed email to agent ${agent.name} (${agent.id})`);

  // Fetch full email content from Resend
  let emailContent: { html?: string; text?: string; headers?: Record<string, string> } | null = null;
  try {
    const { data: fullEmail } = await resend!.emails.receiving.get(email_id);
    emailContent = {
      html: fullEmail?.html || undefined,
      text: fullEmail?.text || undefined,
      headers: fullEmail?.headers as Record<string, string> | undefined,
    };
  } catch (fetchError) {
    console.error("[resend-webhook] Error fetching email content:", fetchError);
    // Continue without content - we at least have metadata
  }

  // Extract Message-ID and In-Reply-To from headers
  const messageId = emailContent?.headers?.["message-id"] || emailContent?.headers?.["Message-ID"];
  const inReplyTo = emailContent?.headers?.["in-reply-to"] || emailContent?.headers?.["In-Reply-To"];

  // Parse sender name from email address
  const fromMatch = from.match(/^(.+?)\s*<([^>]+)>$/);
  const fromName = fromMatch ? fromMatch[1].trim() : undefined;
  const fromAddress = fromMatch ? fromMatch[2] : from;

  // Store the email in our database
  const { email: storedEmail, error: storeError } = await storeInboundEmail(supabase, {
    userId: agent.user_id,
    agentId: agent.id,
    resendEmailId: email_id,
    fromAddress,
    fromName,
    toAddresses: to,
    ccAddresses: cc,
    bccAddresses: bcc,
    subject,
    htmlBody: emailContent?.html,
    textBody: emailContent?.text,
    messageId,
    inReplyTo,
    headers: emailContent?.headers,
    receivedAt: new Date().toISOString(),
    attachments: attachments?.map((att) => ({
      resendAttachmentId: att.id,
      filename: att.filename,
      contentType: att.content_type,
    })),
  });

  if (storeError) {
    console.error("[resend-webhook] Error storing email:", storeError);
    return NextResponse.json(
      { error: "Failed to store email" },
      { status: 500 }
    );
  }

  console.log(`[resend-webhook] Stored email with ID: ${storedEmail?.id}`);

  // Log the activity
  await logActivity(supabase, {
    agentId: agent.id,
    activityType: "email_received",
    source: "email",
    title: `Email received from ${fromName || fromAddress}`,
    description: subject,
    metadata: {
      email_id: storedEmail?.id,
      resend_email_id: email_id,
      from: from,
      subject,
      has_attachments: (attachments?.length || 0) > 0,
    },
    status: "completed",
  });

  // Create notification for the user
  await createNotification(supabase, {
    agentId: agent.id,
    type: "new_message",
    title: `New email from ${fromName || fromAddress}`,
    content: subject,
    linkType: null,
    linkId: null,
  });

  return NextResponse.json({
    received: true,
    email_id: storedEmail?.id,
    agent_id: agent.id,
  });
}

interface EmailDeliveredData {
  email_id: string;
  to: string;
}

async function handleEmailDelivered(data: EmailDeliveredData) {
  const { email_id } = data;
  
  console.log(`[resend-webhook] Email delivered: ${email_id}`);

  const supabase = getAdminClient();

  // Update email status in our database
  const { error } = await supabase
    .from("emails")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
    })
    .eq("resend_email_id", email_id);

  if (error) {
    console.error("[resend-webhook] Error updating email status:", error);
  }

  return NextResponse.json({ received: true });
}

interface EmailBouncedData {
  email_id: string;
  to: string;
  bounce?: {
    type: string;
    message: string;
  };
}

async function handleEmailBounced(data: EmailBouncedData) {
  const { email_id, bounce } = data;
  
  console.log(`[resend-webhook] Email bounced: ${email_id}`, bounce);

  const supabase = getAdminClient();

  // Update email status in our database
  const { error } = await supabase
    .from("emails")
    .update({
      status: "bounced",
      bounced_at: new Date().toISOString(),
      bounce_reason: bounce ? `${bounce.type}: ${bounce.message}` : "Unknown bounce",
    })
    .eq("resend_email_id", email_id);

  if (error) {
    console.error("[resend-webhook] Error updating email status:", error);
  }

  // TODO: Consider notifying the agent/user about the bounce

  return NextResponse.json({ received: true });
}

// Disable body parsing - we need raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
