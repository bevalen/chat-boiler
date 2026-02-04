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
  }
): MessageMetadata | undefined {
  if (!channelSource || channelSource === "app" || channelSource === "cron") {
    return undefined;
  }

  return {
    channel_source: channelSource as ChannelType,
    email_from: channelMetadata?.email_from,
    email_subject: channelMetadata?.email_subject,
    email_message_id: channelMetadata?.email_message_id,
  };
}
