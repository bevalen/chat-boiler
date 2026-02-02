/**
 * Main chat API route (refactored)
 * Clean, focused, and maintainable implementation
 */

import { streamText, convertToModelMessages, UIMessage, gateway, stepCountIs } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser, buildSystemPrompt } from "@/lib/db/agents";
import { getOrCreateDefaultConversation, addMessage } from "@/lib/db/conversations";
import { getAdminClient } from "@/lib/supabase/admin";
import { ChannelType, MessageMetadata } from "@/lib/types/database";
import { logActivity, ActivityType, ActivitySource } from "@/lib/db/activity-log";
import { createAutomaticBugReport } from "@/lib/db/feedback";

// Import refactored modules
import { authenticateRequest } from "./auth";
import { buildMessageHistory, buildMessageMetadata } from "./conversation";
import { createToolRegistry } from "@/lib/tools/registry";

export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("[chat/route] POST request received");

  try {
    const {
      messages,
      conversationId,
      channelSource,
      channelMetadata,
      userId: externalUserId,
      agentId: requestAgentId,
      isBackgroundTask,
    }: {
      messages: UIMessage[];
      conversationId?: string;
      channelSource?: ChannelType | "cron";
      channelMetadata?: {
        slack_channel_id?: string;
        slack_thread_ts?: string;
        slack_user_id?: string;
        email_from?: string;
        email_subject?: string;
        email_message_id?: string;
        linkedin_conversation_id?: string;
        linkedin_profile_url?: string;
        linkedin_message_id?: string;
        linkedin_sender_name?: string;
        linkedin_sender_title?: string;
        linkedin_sender_company?: string;
      };
      userId?: string;
      agentId?: string;
      isBackgroundTask?: boolean;
    } = await request.json();

    console.log("[chat/route] Messages received:", messages.length);
    console.log("[chat/route] Channel source:", channelSource || "app");

    // 1. AUTHENTICATE REQUEST
    const { user, supabase, isExtensionAuth } = await authenticateRequest({
      authHeader: request.headers.get("Authorization"),
      cronHeader: request.headers.get("x-internal-cron"),
      externalUserId,
      requestAgentId,
      isBackgroundTask,
      channelSource,
    });

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (isExtensionAuth) {
      console.log("[chat/route] ✅ Authenticated via extension token");
    }

    // 2. GET USER PROFILE AND AGENT
    const { data: profile } = await supabase
      .from("users")
      .select("name, email, timezone, preferred_notification_channel")
      .eq("id", user.id)
      .single();

    const agent = await getAgentForUser(supabase, user.id);

    if (!agent) {
      return new Response(
        JSON.stringify({
          error: "No agent configured. Please set up your assistant in settings.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. GET OR CREATE CONVERSATION
    let conversation;
    if (conversationId) {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("agent_id", agent.id)
        .single();
      conversation = data;
    }

    if (!conversation) {
      conversation = await getOrCreateDefaultConversation(supabase, agent.id);
    }

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. BUILD MESSAGE HISTORY (includes Slack thread context if applicable)
    const messagesWithHistory = await buildMessageHistory({
      channelSource,
      channelMetadata,
      messages,
      conversationId: conversation.id,
      supabase,
    });

    // 5. BUILD SYSTEM PROMPT
    const systemPrompt = await buildSystemPrompt(
      agent,
      {
        id: user.id,
        name: profile?.name || "User",
        timezone: profile?.timezone || undefined,
        email: profile?.email || undefined,
      },
      channelSource === "cron" ? undefined : channelSource
    );

    console.log("[chat/route] Using agent:", agent.name);
    console.log("[chat/route] Conversation:", conversation.id);

    // 6. PERSIST USER MESSAGE
    const messageMetadata = buildMessageMetadata(channelSource, channelMetadata);
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    if (lastUserMessage) {
      const content = lastUserMessage.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      if (content) {
        await addMessage(
          supabase,
          conversation.id,
          "user",
          content,
          messageMetadata as Record<string, unknown> | undefined
        );
      }
    }

    // 7. CHECK IF CONVERSATION NEEDS TITLE
    const needsTitle = conversation.title === "New conversation" && messages.length <= 2;

    // 8. CREATE TOOL REGISTRY
    const adminSupabase = getAdminClient();
    const tools = createToolRegistry({
      agentId: agent.id,
      userId: user.id,
      supabase: adminSupabase,
      conversationId: conversation.id,
      agentName: agent.name,
      userName: profile?.name || "User",
      userEmail: profile?.email,
      userTitle: agent.identityContext?.owner?.role,
      userCompany: agent.identityContext?.owner?.company,
      userTimezone: profile?.timezone,
      preferredNotificationChannel: profile?.preferred_notification_channel,
    });

    // 9. SELECT MODEL AND DETERMINE STEP LIMIT
    const selectedModel =
      channelSource === "linkedin"
        ? gateway("anthropic/claude-sonnet-4-5-20250514")
        : gateway("anthropic/claude-sonnet-4.5");

    const isBackgroundChannel = channelSource === "cron" || channelSource === "email";
    const maxSteps = isBackgroundChannel ? 20 : 5;

    if (isBackgroundChannel) {
      console.log(
        `[chat/route] 🤖 Background mode: ${maxSteps} steps allowed (channel: ${channelSource})`
      );
    }

    if (channelSource === "linkedin") {
      console.log(`[chat/route] 🔗 LinkedIn SDR Mode - Using Claude Sonnet 4.5`);
      console.log(`[chat/route] 📝 Conversation history count: ${messagesWithHistory.length}`);
    }

    // 10. STREAM RESPONSE WITH TOOLS
    const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messagesWithHistory),
      tools,
      toolChoice: "auto",
      stopWhen: stepCountIs(maxSteps),
      onStepFinish: async ({ toolCalls, toolResults }) => {
        if (toolCalls && toolCalls.length > 0) {
          const activitySource: ActivitySource =
            channelSource === "slack"
              ? "slack"
              : channelSource === "email"
                ? "email"
                : channelSource === "cron"
                  ? "cron"
                  : "chat";

          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            if (!tc) continue;
            console.log(`[chat/route] 🔧 Tool "${tc.toolName}" called`);
            const toolResult = toolResults?.[i];
            const toolInput = (tc as { input?: unknown }).input as
              | Record<string, unknown>
              | undefined;

            if (toolResult) {
              const output = (toolResult as { output?: unknown }).output as
                | Record<string, unknown>
                | undefined;
              const isError = output && output.success === false && output.error;

              // Map tool names to activity types
              const getActivityType = (toolName: string): ActivityType => {
                if (
                  toolName === "sendEmail" ||
                  toolName === "replyToEmail" ||
                  toolName === "forwardEmailToUser"
                )
                  return "email_sent";
                if (toolName === "checkEmail") return "email_received";
                if (toolName === "research") return "research";
                if (toolName === "saveToMemory") return "memory_saved";
                if (toolName === "createTask" || toolName === "createSubtask") return "task_created";
                if (toolName === "updateTask" || toolName === "completeTask") return "task_updated";
                if (toolName === "createProject") return "project_created";
                if (toolName === "updateProject") return "project_updated";
                if (toolName === "scheduleReminder") return "reminder_created";
                if (toolName === "scheduleAgentTask" || toolName === "scheduleTaskFollowUp")
                  return "job_scheduled";
                if (isError) return "error";
                return "tool_call";
              };

              // Log to activity log
              console.log(
                `[chat/route] 📝 Logging activity for tool "${tc.toolName}" (source: ${activitySource})`
              );
              logActivity(adminSupabase, {
                agentId: agent.id,
                activityType: getActivityType(tc.toolName),
                source: activitySource,
                title: `Tool: ${tc.toolName}`,
                description: isError
                  ? String(output?.error)
                  : (output?.message as string) || "Completed",
                metadata: {
                  tool: tc.toolName,
                  params: toolInput,
                  result: output,
                  success: !isError,
                },
                conversationId: conversation.id,
                status: isError ? "failed" : "completed",
              })
                .then(() => {
                  console.log(`[chat/route] ✅ Activity logged for tool "${tc.toolName}"`);
                })
                .catch((err) => console.error("[chat/route] Failed to log activity:", err));

              // Auto-create bug report for tool errors
              if (isError) {
                console.log(`[chat/route] ⚠️ Tool "${tc.toolName}" failed:`, output?.error);
                try {
                  const { skipped } = await createAutomaticBugReport(adminSupabase, agent.id, {
                    toolName: tc.toolName,
                    toolInput: toolInput || {},
                    errorMessage: String(output?.error),
                    conversationId: conversation.id,
                  });
                  if (!skipped) {
                    console.log(`[chat/route] 🐛 Auto-created bug report for tool error`);
                  }
                } catch (bugReportErr) {
                  console.error(`[chat/route] Failed to create auto bug report:`, bugReportErr);
                }
              } else {
                console.log(`[chat/route] ✅ Tool "${tc.toolName}" completed`);
              }
            }
          }
        }
      },
      onFinish: async ({ text, steps }) => {
        const toolCallCount =
          steps?.reduce((acc, step) => acc + (step.toolCalls?.length || 0), 0) || 0;
        if (toolCallCount > 0) {
          console.log(`[chat/route] 📊 Response complete: ${toolCallCount} tool call(s) made`);
        }

        // Persist the assistant's response
        if (text) {
          const assistantMetadata: MessageMetadata | undefined =
            channelSource && channelSource !== "app"
              ? {
                  channel_source: channelSource as ChannelType,
                  slack_channel_id: channelMetadata?.slack_channel_id,
                  slack_thread_ts: channelMetadata?.slack_thread_ts,
                }
              : undefined;
          await addMessage(
            supabase,
            conversation.id,
            "assistant",
            text,
            assistantMetadata as Record<string, unknown> | undefined
          );
        }
      },
    });

    console.log("[chat/route] Streaming response");

    // 11. RETURN RESPONSE WITH HEADERS
    const response = result.toUIMessageStreamResponse();
    const headers = new Headers(response.headers);
    headers.set("X-Conversation-Id", conversation.id);
    headers.set("X-Needs-Title", needsTitle ? "true" : "false");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("[chat/route] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
