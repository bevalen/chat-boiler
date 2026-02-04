/**
 * Main chat API route (refactored)
 * Clean, focused, and maintainable implementation
 */

import { streamText, convertToModelMessages, UIMessage, gateway, stepCountIs, consumeStream } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser, buildSystemPrompt } from "@/lib/db/agents";
import { getOrCreateDefaultConversation, addMessage } from "@/lib/db/conversations";
import { getAdminClient } from "@/lib/supabase/admin";
import { ChannelType, MessageMetadata } from "@/lib/types/database";
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

    // 4. BUILD MESSAGE HISTORY
    const messagesWithHistory = await buildMessageHistory({
      channelSource,
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
    });

    // 9. SELECT MODEL AND DETERMINE STEP LIMIT
    const selectedModel = gateway("anthropic/claude-sonnet-4.5");
    const maxSteps = 20;

    // Track abort state to prevent saving partial messages
    let wasAborted = false;
    // Track tool calls for this response
    const allToolCalls: Array<{ name: string; timestamp: Date }> = [];

    // 10. STREAM RESPONSE WITH TOOLS
    const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messagesWithHistory),
      tools,
      toolChoice: "auto",
      stopWhen: stepCountIs(maxSteps),
      abortSignal: request.signal,
      onStepFinish: async ({ toolCalls, toolResults }) => {
        if (toolCalls && toolCalls.length > 0) {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            if (!tc) continue;
            console.log(`[chat/route] 🔧 Tool "${tc.toolName}" called`);
            
            // Track this tool call
            allToolCalls.push({ name: tc.toolName, timestamp: new Date() });
            const toolResult = toolResults?.[i];
            const toolInput = (tc as { input?: unknown }).input as
              | Record<string, unknown>
              | undefined;

            if (toolResult) {
              const output = (toolResult as { output?: unknown }).output as
                | Record<string, unknown>
                | undefined;
              const isError = output && output.success === false && output.error;

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
        // Don't save if the stream was aborted
        if (wasAborted) {
          console.log(`[chat/route] ⚠️ Skipping message save due to abort`);
          return;
        }

        const toolCallCount =
          steps?.reduce((acc, step) => acc + (step.toolCalls?.length || 0), 0) || 0;
        if (toolCallCount > 0) {
          console.log(`[chat/route] 📊 Response complete: ${toolCallCount} tool call(s) made`);
        }

        // Persist the assistant's response
        if (text) {
          const assistantMetadata: MessageMetadata = {
            ...(channelSource && channelSource !== "app"
              ? { channel_source: channelSource as ChannelType }
              : {}),
            tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
          };
          await addMessage(
            supabase,
            conversation.id,
            "assistant",
            text,
            assistantMetadata as Record<string, unknown> | undefined
          );
        }
      },
      onAbort: async ({ steps }) => {
        wasAborted = true;
        console.log(`[chat/route] ⚠️ Stream aborted by client after ${steps.length} step(s)`);
        // Do not persist partial results when aborted
      },
    });

    console.log("[chat/route] Streaming response");

    // 11. RETURN RESPONSE WITH HEADERS
    const response = result.toUIMessageStreamResponse({
      consumeSseStream: consumeStream,
    });
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
