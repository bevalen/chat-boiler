import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";

export async function DELETE(
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
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify conversation belongs to user's agent
    const agent = await getAgentForUser(supabase, user.id);
    if (!agent) {
      return Response.json({ error: "No agent configured" }, { status: 400 });
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, agent_id")
      .eq("id", conversationId)
      .single();

    if (!conversation || conversation.agent_id !== agent.id) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Delete the conversation (messages will cascade delete due to FK constraint)
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      console.error("Error deleting conversation:", error);
      return Response.json({ error: "Failed to delete conversation" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[conversation delete] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
