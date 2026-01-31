import { createAgentUIStreamResponse, convertToModelMessages, UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { createFeedbackAgent } from "@/lib/agents/feedback-agent";

export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("[feedback/chat] POST request received");

  try {
    const { messages, conversationId }: { messages: UIMessage[]; conversationId?: string } = await request.json();
    console.log("[feedback/chat] Messages received:", messages.length);

    // Authenticate user
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the user's agent
    const agent = await getAgentForUser(supabase, user.id);

    if (!agent) {
      return new Response(
        JSON.stringify({ error: "No agent configured. Please set up your assistant in settings." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[feedback/chat] Using agent:", agent.name, "for feedback collection");

    // Create the feedback agent with database context
    const feedbackAgent = createFeedbackAgent(supabase, agent.id, conversationId);

    // Use createAgentUIStreamResponse for streaming
    return createAgentUIStreamResponse({
      agent: feedbackAgent,
      uiMessages: messages,
    });
  } catch (error) {
    console.error("[feedback/chat] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
