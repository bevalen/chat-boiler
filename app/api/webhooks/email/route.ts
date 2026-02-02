/**
 * Incoming Email Webhook Handler (LEGACY - Zapier)
 *
 * NOTE: This is the legacy Zapier-based email webhook.
 * For new deployments, use the Resend webhook at /api/webhooks/resend/inbound
 * which triggers the Inngest email processor with full context gathering.
 *
 * This endpoint receives incoming emails via Zapier webhook and triggers
 * the AI agent to process and respond to them.
 *
 * Flow:
 * 1. Validate webhook secret
 * 2. Look up the agent owner
 * 3. Find related tasks
 * 4. Call the chat API with the email content
 * 5. Agent decides to respond directly or forward to user
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findTasksForEmail } from "@/lib/db/search";
import { getAgentById } from "@/lib/db/agents";
import { createNotification } from "@/lib/db/notifications";

// Zapier webhook payload structure
interface IncomingEmailPayload {
  from: string; // sender email address
  to: string; // recipient (user's email)
  subject: string;
  body_plain: string; // plain text body
  body_html?: string; // HTML body (optional)
  date: string; // received date
  message_id?: string; // for threading
  reply_to?: string; // reply-to header
}

// Create Supabase admin client
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Look up the agent owner - currently single user system
 * Returns the first active user with email integration configured
 */
async function lookupAgentOwner(supabase: ReturnType<typeof getAdminClient>): Promise<{
  userId: string;
  agentId: string;
  userEmail: string;
  conversationId: string | null;
} | null> {
  // Find users with active Zapier MCP credentials (email integration)
  const { data: creds, error: credsError } = await supabase
    .from("user_channel_credentials")
    .select("user_id")
    .eq("channel_type", "zapier_mcp")
    .eq("is_active", true);

  if (credsError || !creds?.length) {
    console.log("[email-webhook] No active email credentials found");
    return null;
  }

  // Get the first user with email integration
  const userId = creds[0].user_id;

  // Get user email
  const { data: user } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  if (!user?.email) {
    console.log("[email-webhook] No email found for user");
    return null;
  }

  // Get the user's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!agent) {
    console.log("[email-webhook] No agent found for user");
    return null;
  }

  // Get or create an email conversation
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("agent_id", agent.id)
    .eq("channel_type", "email")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  let conversationId = conv?.id || null;

  if (!conversationId) {
    // Create a new email conversation
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        agent_id: agent.id,
        channel_type: "email",
        status: "active",
        title: "Email Conversations",
      })
      .select("id")
      .single();
    conversationId = newConv?.id || null;
  }

  return {
    userId,
    agentId: agent.id,
    userEmail: user.email,
    conversationId,
  };
}

/**
 * Format the email for the AI to process
 */
function formatEmailForAI(email: IncomingEmailPayload, context: string): string {
  const parts: string[] = [];

  parts.push("=== INCOMING EMAIL ===");
  parts.push(`From: ${email.from}`);
  parts.push(`To: ${email.to}`);
  parts.push(`Subject: ${email.subject}`);
  parts.push(`Date: ${email.date}`);
  if (email.message_id) {
    parts.push(`Message-ID: ${email.message_id}`);
  }
  parts.push("");
  parts.push("--- Email Body ---");
  parts.push(email.body_plain);
  parts.push("--- End of Email ---");

  if (context) {
    parts.push("");
    parts.push("=== RELEVANT CONTEXT FROM YOUR MEMORY ===");
    parts.push(context);
    parts.push("=== END OF CONTEXT ===");
  }

  parts.push("");
  parts.push("=== INSTRUCTIONS ===");
  parts.push("You have received this email. Please:");
  parts.push("1. Review the email content and the relevant context from your memory");
  parts.push("2. If you have enough information to respond helpfully, compose and send an email reply using the sendEmail tool");
  parts.push("3. If you're uncertain, need user input, or the email requires the user's personal attention, forward it to your user using the forwardEmailToUser tool");
  parts.push("");
  parts.push("When responding to emails:");
  parts.push("- Be professional and helpful");
  parts.push("- Reference relevant context from projects or past conversations when applicable");
  parts.push("- If forwarding to your user, include a brief note explaining why you're forwarding it");

  return parts.join("\n");
}

/**
 * Send the email to the chat API for processing
 */
async function sendToChatAPI(
  userId: string,
  conversationId: string | null,
  formattedMessage: string,
  emailMetadata: {
    from: string;
    subject: string;
    message_id?: string;
  }
): Promise<string> {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    const messages = [
      {
        role: "user",
        content: formattedMessage,
        parts: [{ type: "text", text: formattedMessage }],
      },
    ];

    const response = await fetch(`${appBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        messages,
        conversationId,
        userId,
        channelSource: "email",
        channelMetadata: {
          email_from: emailMetadata.from,
          email_subject: emailMetadata.subject,
          email_message_id: emailMetadata.message_id,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[email-webhook] Chat API error:", response.status, errorText);
      return `Error processing email: ${response.status}`;
    }

    // Read the streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      return "Error: No response body";
    }

    let fullResponse = "";
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        // Handle SSE data: prefix format (AI SDK v6)
        if (line.startsWith("data: ")) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr.trim()) {
              const data = JSON.parse(jsonStr);
              if (data.type === "text-delta" && data.delta) {
                fullResponse += data.delta;
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
        // Handle older format with 0: prefix
        else if (line.startsWith("0:")) {
          try {
            const textContent = JSON.parse(line.slice(2));
            fullResponse += textContent;
          } catch {
            fullResponse += line.slice(2);
          }
        }
      }
    }

    return fullResponse || "Email processed successfully";
  } catch (error) {
    console.error("[email-webhook] Error calling chat API:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

export async function POST(request: Request) {
  console.log("[email-webhook] Incoming email webhook received");

  try {
    // Validate webhook secret
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    const providedSecret = request.headers.get("X-Webhook-Secret");

    if (webhookSecret && providedSecret !== webhookSecret) {
      console.error("[email-webhook] Invalid webhook secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the email payload
    const payload: IncomingEmailPayload = await request.json();
    console.log("[email-webhook] Email from:", payload.from);
    console.log("[email-webhook] Subject:", payload.subject);

    // Validate required fields
    if (!payload.from || !payload.subject || !payload.body_plain) {
      return NextResponse.json(
        { error: "Missing required fields: from, subject, body_plain" },
        { status: 400 }
      );
    }

    // Get admin client
    const supabase = getAdminClient();

    // Look up the agent owner
    const owner = await lookupAgentOwner(supabase);
    if (!owner) {
      console.log("[email-webhook] No configured agent owner found");
      return NextResponse.json(
        { error: "No configured agent found" },
        { status: 404 }
      );
    }

    console.log("[email-webhook] Processing for user:", owner.userId);
    console.log("[email-webhook] Agent:", owner.agentId);

    // Find related tasks for this email
    const emailContent = `${payload.subject}\n\n${payload.body_plain}`;
    const relatedTasks = await findTasksForEmail(supabase, owner.agentId, emailContent, {
      matchCount: 3,
      matchThreshold: 0.7, // Higher threshold for more precise matching
    });

    let linkedTaskInfo = "";
    let triggeredTaskProcessing = false;

    if (relatedTasks.length > 0) {
      console.log(`[email-webhook] Found ${relatedTasks.length} related task(s)`);

      // Link email to the most relevant task
      const primaryTask = relatedTasks[0];
      console.log(`[email-webhook] Primary related task: ${primaryTask.title} (similarity: ${primaryTask.similarity.toFixed(2)})`);

      // Add email as a comment on the task
      const emailComment = `**Email received from ${payload.from}**\n\n**Subject:** ${payload.subject}\n\n${payload.body_plain.substring(0, 500)}${payload.body_plain.length > 500 ? "..." : ""}`;

      await supabase.from("comments").insert({
        task_id: primaryTask.id,
        author_type: "system",
        content: emailComment,
        comment_type: "note",
      });

      console.log(`[email-webhook] Added email as comment on task ${primaryTask.id}`);

      // Check if the task was waiting_on (potentially waiting for this email)
      const { data: taskDetails } = await supabase
        .from("tasks")
        .select("id, title, status, agent_run_state, assignee_type")
        .eq("id", primaryTask.id)
        .single();

      if (taskDetails?.status === "waiting_on") {
        console.log("[email-webhook] Task was waiting_on - updating status to in_progress");

        // Update task status back to in_progress
        await supabase.from("tasks").update({
          status: "in_progress",
          agent_run_state: "not_started", // Ready for the task worker to pick up
        }).eq("id", primaryTask.id);

        // Add a status change comment
        await supabase.from("comments").insert({
          task_id: primaryTask.id,
          author_type: "system",
          content: `Task resumed: Email reply received from ${payload.from}`,
          comment_type: "status_change",
        });

        triggeredTaskProcessing = true;

        // Create notification
        await createNotification(
          supabase,
          owner.agentId,
          "task_update",
          `Email received for: ${taskDetails.title}`,
          `Reply from ${payload.from}. Task has been resumed.`,
          "task",
          primaryTask.id
        );
      }

      // Add linked task info for the AI context
      linkedTaskInfo = `\n\n=== LINKED TASK ===\nThis email appears to be related to task: "${primaryTask.title}" (ID: ${primaryTask.id})\nTask Status: ${primaryTask.status}\nSimilarity: ${(primaryTask.similarity * 100).toFixed(0)}%`;

      if (relatedTasks.length > 1) {
        linkedTaskInfo += "\n\nOther potentially related tasks:";
        relatedTasks.slice(1).forEach((t) => {
          linkedTaskInfo += `\n- "${t.title}" (${t.status}, ${(t.similarity * 100).toFixed(0)}% match)`;
        });
      }
      linkedTaskInfo += "\n=== END LINKED TASK ===";
    }

    // Format the email with context for the AI
    const formattedMessage = formatEmailForAI(payload, linkedTaskInfo);

    // Send to chat API for processing
    const response = await sendToChatAPI(
      owner.userId,
      owner.conversationId,
      formattedMessage,
      {
        from: payload.from,
        subject: payload.subject,
        message_id: payload.message_id,
      }
    );

    console.log("[email-webhook] Processing complete");

    return NextResponse.json({
      success: true,
      message: "Email processed",
      linkedTasks: relatedTasks.map((t) => ({ id: t.id, title: t.title, similarity: t.similarity })),
      triggeredTaskProcessing,
      response: response.substring(0, 200) + (response.length > 200 ? "..." : ""),
    });
  } catch (error) {
    console.error("[email-webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "email-webhook",
    description: "Incoming email handler for Zapier webhooks",
  });
}
