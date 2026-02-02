/**
 * Conversation management module for chat API
 * Handles conversation retrieval, creation, and message history
 */

import { UIMessage } from "ai";
import { ChannelType, MessageMetadata } from "@/lib/types/database";

interface ConversationHistoryOptions {
  channelSource?: ChannelType | "cron";
  messages: UIMessage[];
  conversationId: string;
  supabase: any;
}

/**
 * Build complete message history
 */
export async function buildMessageHistory(
  options: ConversationHistoryOptions
): Promise<UIMessage[]> {
  const { messages } = options;
  return messages;
}

/**
 * Build message metadata for channel-specific information
 */
export function buildMessageMetadata(
  channelSource?: ChannelType | "cron",
  channelMetadata?: {
    email_from?: string;
    email_subject?: string;
    email_message_id?: string;
    linkedin_conversation_id?: string;
    linkedin_profile_url?: string;
    linkedin_message_id?: string;
    linkedin_sender_name?: string;
    linkedin_sender_title?: string;
    linkedin_sender_company?: string;
  }
): MessageMetadata | undefined {
  if (!channelSource || channelSource === "app") {
    return undefined;
  }

  return {
    channel_source: channelSource as ChannelType,
    email_from: channelMetadata?.email_from,
    email_subject: channelMetadata?.email_subject,
    email_message_id: channelMetadata?.email_message_id,
    linkedin_conversation_id: channelMetadata?.linkedin_conversation_id,
    linkedin_profile_url: channelMetadata?.linkedin_profile_url,
    linkedin_message_id: channelMetadata?.linkedin_message_id,
    linkedin_sender_name: channelMetadata?.linkedin_sender_name,
    linkedin_sender_title: channelMetadata?.linkedin_sender_title,
    linkedin_sender_company: channelMetadata?.linkedin_sender_company,
  };
}
