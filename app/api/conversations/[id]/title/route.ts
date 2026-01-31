import { generateText, Output, gateway } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser } from "@/lib/db/agents";
import { updateConversationTitle } from "@/lib/db/conversations";

const titleSchema = z.object({
  title: z.string().describe("A short 2-5 word title for the conversation"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { messages } = await request.json();

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

    // Build a simple prompt from messages
    const messageText = messages
      .slice(0, 4) // Just use first few messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    const { output } = await generateText({
      model: gateway("openai/gpt-4o-mini"),
      output: Output.object({ schema: titleSchema }),
      prompt: `Generate a short 2-5 word title for this conversation. Be concise and descriptive.

Conversation:
${messageText}

Examples of good titles:
- "Project status update"
- "Q1 marketing plan"
- "Calendar review"
- "Email to Chris"`,
    });

    if (output?.title) {
      await updateConversationTitle(supabase, conversationId, output.title);
      return Response.json({ title: output.title });
    }

    return Response.json({ error: "Failed to generate title" }, { status: 500 });
  } catch (error) {
    console.error("[title] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Allow manual title updates via PATCH
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { title } = await request.json();

    if (!title || typeof title !== "string") {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

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

    const success = await updateConversationTitle(supabase, conversationId, title);

    if (success) {
      return Response.json({ title });
    }

    return Response.json({ error: "Failed to update title" }, { status: 500 });
  } catch (error) {
    console.error("[title] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
