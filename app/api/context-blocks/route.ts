import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";

// GET - Fetch context blocks for the user's agent
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const alwaysIncludeOnly = searchParams.get("always_include") === "true";
  const category = searchParams.get("category");

  let query = supabase
    .from("context_blocks")
    .select("id, title, content, type, category, always_include, created_at, updated_at")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: true });

  if (alwaysIncludeOnly) {
    query = query.eq("always_include", true);
  }

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocks: data });
}

// POST - Create a new context block
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, content, type = "user_profile", category = "general", alwaysInclude = false } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Generate embedding for the content
  let embedding: number[] | null = null;
  try {
    const textToEmbed = title ? `${title}\n\n${content}` : content;
    embedding = await generateEmbedding(textToEmbed);
  } catch (embeddingError) {
    console.error("Error generating embedding:", embeddingError);
  }

  const { data, error } = await supabase
    .from("context_blocks")
    .insert({
      agent_id: agent.id,
      title: title?.trim() || null,
      content: content.trim(),
      type,
      category,
      always_include: alwaysInclude,
      embedding,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ block: data }, { status: 201 });
}

// PATCH - Update a context block
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();
  const { id, title, content, category, alwaysInclude } = body;

  if (!id) {
    return NextResponse.json({ error: "Block ID is required" }, { status: 400 });
  }

  // Build update object
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title?.trim() || null;
  if (content !== undefined) updates.content = content.trim();
  if (category !== undefined) updates.category = category;
  if (alwaysInclude !== undefined) updates.always_include = alwaysInclude;
  updates.updated_at = new Date().toISOString();

  // Regenerate embedding if content changed
  if (content !== undefined) {
    try {
      const textToEmbed = (title || updates.title) ? `${title || updates.title}\n\n${content}` : content;
      updates.embedding = await generateEmbedding(textToEmbed);
    } catch (embeddingError) {
      console.error("Error generating embedding:", embeddingError);
    }
  }

  const { data, error } = await supabase
    .from("context_blocks")
    .update(updates)
    .eq("id", id)
    .eq("agent_id", agent.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ block: data });
}

// DELETE - Delete a context block
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Block ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("context_blocks")
    .delete()
    .eq("id", id)
    .eq("agent_id", agent.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
