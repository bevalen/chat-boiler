import { streamText, convertToModelMessages, UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser, buildSystemPrompt } from "@/lib/db/agents";
import {
  getOrCreateDefaultConversation,
  addMessage,
} from "@/lib/db/conversations";

export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("[chat/route] POST request received");

  try {
    const {
      messages,
      conversationId,
    }: { messages: UIMessage[]; conversationId?: string } = await request.json();
    console.log("[chat/route] Messages received:", messages.length);

    // Get the authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from("users")
      .select("name, timezone")
      .eq("id", user.id)
      .single();

    // Get the user's agent
    const agent = await getAgentForUser(supabase, user.id);

    if (!agent) {
      return new Response(
        JSON.stringify({ error: "No agent configured. Please set up your assistant in settings." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get or create a conversation
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
      return new Response(
        JSON.stringify({ error: "Failed to create conversation" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build the system prompt from agent configuration
    const systemPrompt = buildSystemPrompt(agent, {
      name: profile?.name || "User",
      timezone: profile?.timezone || undefined,
    });

    console.log("[chat/route] Using agent:", agent.name);
    console.log("[chat/route] Conversation:", conversation.id);

    // Get the last user message to persist
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    if (lastUserMessage) {
      const content = lastUserMessage.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      if (content) {
        await addMessage(supabase, conversation.id, "user", content);
      }
    }

    // Check if this is a new conversation that needs a title
    const needsTitle =
      conversation.title === "New conversation" && messages.length <= 2;

    // Stream the response
    const result = streamText({
      model: openai("gpt-5.2"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      onFinish: async ({ text }) => {
        // Persist the assistant's response
        if (text) {
          await addMessage(supabase, conversation.id, "assistant", text);
        }
      },
    });

    console.log("[chat/route] Streaming response");

    // Return with conversation ID in headers
    const response = result.toUIMessageStreamResponse();

    // Clone response to add headers
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
