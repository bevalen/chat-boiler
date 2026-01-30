import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import {
  getConversationsForAgent,
  createConversation,
} from "@/lib/db/conversations";

export async function GET() {
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
      return new Response(JSON.stringify({ conversations: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const conversations = await getConversationsForAgent(supabase, agent.id);

    return new Response(JSON.stringify({ conversations }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[conversations] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { title } = await request.json();

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
      return new Response(
        JSON.stringify({ error: "No agent configured" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const conversation = await createConversation(supabase, agent.id, title);

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Failed to create conversation" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ conversation }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[conversations] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
