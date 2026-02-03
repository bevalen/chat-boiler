/**
 * Email conversation management
 * Handles finding or creating conversations for email threads
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createConversation } from "@/lib/db/conversations";

export interface EmailConversation {
  id: string;
  agentId: string;
  title: string;
  channelType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get or create an email conversation for a given email thread
 */
export async function getOrCreateEmailConversation(
  supabase: SupabaseClient<any>,
  agentId: string,
  emailId: string,
  subject: string | null,
  threadId: string | null,
  inReplyTo: string | null
): Promise<EmailConversation> {
  // Try to find existing email conversation by thread_id or in_reply_to
  let existingConv = null;

  if (threadId || inReplyTo) {
    const { data: existingEmails } = await supabase
      .from("emails")
      .select("id")
      .eq("agent_id", agentId)
      .or(
        threadId
          ? `thread_id.eq.${threadId}`
          : `message_id.eq.${inReplyTo}`
      )
      .neq("id", emailId)
      .limit(1);

    if (existingEmails && existingEmails.length > 0) {
      // Find conversation that has messages referencing this email thread
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id")
        .or(`metadata->>email_id.eq.${existingEmails[0].id}`)
        .limit(1);

      if (messages && messages.length > 0) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("*")
          .eq("id", messages[0].conversation_id)
          .eq("status", "active")
          .single();

        if (conv) existingConv = conv;
      }
    }
  }

  // If no existing conversation, create a new one for this email thread
  if (!existingConv) {
    const conv = await createConversation(supabase, agentId, `Email: ${subject || "No subject"}`);

    if (!conv) {
      throw new Error("Failed to create conversation");
    }

    // Update to email channel type
    await supabase.from("conversations").update({ channel_type: "email" }).eq("id", conv.id);

    return {
      id: conv.id,
      agentId: conv.agent_id,
      title: conv.title,
      channelType: "email",
      status: conv.status,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    };
  }

  return {
    id: existingConv.id,
    agentId: existingConv.agent_id,
    title: existingConv.title,
    channelType: existingConv.channel_type,
    status: existingConv.status,
    createdAt: existingConv.created_at,
    updatedAt: existingConv.updated_at,
  };
}
