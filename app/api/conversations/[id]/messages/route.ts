import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { getMessagesForConversation } from "@/lib/db/conversations";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const body = await request.json();
    const { fromMessageId } = body;

    if (!fromMessageId) {
      return new Response(JSON.stringify({ error: "fromMessageId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

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

    // Get the timestamp of the message to delete from
    const { data: fromMessage } = await supabase
      .from("messages")
      .select("created_at")
      .eq("id", fromMessageId)
      .eq("conversation_id", conversationId)
      .single();

    if (!fromMessage) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Delete all messages after (and including) this message
    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId)
      .gte("created_at", fromMessage.created_at);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[messages DELETE] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

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
