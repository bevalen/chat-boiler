import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/database";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export interface Conversation {
  id: string;
  agentId: string;
  title: string | null;
  channelType: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

function mapConversationRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    channelType: row.channel_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.created_at,
  };
}

/**
 * Get all conversations for an agent, ordered by most recent
 */
export async function getConversationsForAgent(
  supabase: SupabaseClient,
  agentId: string,
  limit = 50
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("agent_id", agentId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }

  return (data || []).map(mapConversationRow);
}

/**
 * Get or create a default conversation for an agent
 */
export async function getOrCreateDefaultConversation(
  supabase: SupabaseClient,
  agentId: string
): Promise<Conversation | null> {
  // First try to get the most recent active conversation
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("agent_id", agentId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return mapConversationRow(existing);
  }

  // Create a new conversation
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      agent_id: agentId,
      title: "New conversation",
      channel_type: "app",
      status: "active",
    })
    .select()
    .single();

  if (error || !created) {
    console.error("Error creating conversation:", error);
    return null;
  }

  return mapConversationRow(created);
}

/**
 * Create a new conversation for an agent
 */
export async function createConversation(
  supabase: SupabaseClient,
  agentId: string,
  title?: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      agent_id: agentId,
      title: title || "New conversation",
      channel_type: "app",
      status: "active",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating conversation:", error);
    return null;
  }

  return mapConversationRow(data);
}

/**
 * Update a conversation's title
 */
export async function updateConversationTitle(
  supabase: SupabaseClient,
  conversationId: string,
  title: string
): Promise<boolean> {
  const { error } = await supabase
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    console.error("Error updating conversation title:", error);
    return false;
  }

  return true;
}

/**
 * Get messages for a conversation
 */
export async function getMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 100
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  return (data || []).map(mapMessageRow);
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  supabase: SupabaseClient,
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata?: Record<string, unknown>
): Promise<Message | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error adding message:", error);
    return null;
  }

  // Update conversation's updated_at timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return mapMessageRow(data);
}

/**
 * Add multiple messages to a conversation (for batching)
 */
export async function addMessages(
  supabase: SupabaseClient,
  conversationId: string,
  messages: { role: "user" | "assistant" | "system"; content: string; metadata?: Record<string, unknown> }[]
): Promise<Message[]> {
  const inserts = messages.map((msg) => ({
    conversation_id: conversationId,
    role: msg.role,
    content: msg.content,
    metadata: msg.metadata || {},
  }));

  const { data, error } = await supabase
    .from("messages")
    .insert(inserts)
    .select();

  if (error || !data) {
    console.error("Error adding messages:", error);
    return [];
  }

  // Update conversation's updated_at timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data.map(mapMessageRow);
}

/**
 * Get a conversation by ID
 */
export async function getConversationById(
  supabase: SupabaseClient,
  conversationId: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (error || !data) {
    console.error("Error fetching conversation:", error);
    return null;
  }

  return mapConversationRow(data);
}
