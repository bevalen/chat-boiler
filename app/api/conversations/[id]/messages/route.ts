import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getMessagesForConversation } from "@/lib/db/conversations";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

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

    // Verify conversation belongs to user's agent
    const agent = await getAgentForUser(supabase, user.id);
    if (!agent) {
      return new Response(JSON.stringify({ error: "No agent configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, agent_id")
      .eq("id", conversationId)
      .single();

    if (!conversation || conversation.agent_id !== agent.id) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = await getMessagesForConversation(supabase, conversationId);

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[messages] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
