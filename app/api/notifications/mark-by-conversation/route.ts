import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { markNotificationsByConversationAsRead } from "@/lib/db/notifications";

export async function POST(request: Request) {
  try {
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

    const agent = await getAgentForUser(supabase, user.id);
    if (!agent) {
      return new Response(JSON.stringify({ error: "No agent configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { conversationId } = await request.json();

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversationId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await markNotificationsByConversationAsRead(
      supabase,
      agent.id,
      conversationId
    );

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notifications] Error marking conversation notifications as read:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
