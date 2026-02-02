/**
 * Conversation management module for chat API
 * Handles conversation retrieval, creation, and message history
 */

import { UIMessage } from "ai";
import { getMessagesForSlackThread } from "@/lib/db/conversations";
import { ChannelType, MessageMetadata } from "@/lib/types/database";

interface ConversationHistoryOptions {
  channelSource?: ChannelType | "cron";
  channelMetadata?: {
    slack_thread_ts?: string;
  };
  messages: UIMessage[];
  conversationId: string;
  supabase: any;
}

/**
 * Build complete message history including thread context for Slack
 */
export async function buildMessageHistory(
  options: ConversationHistoryOptions
): Promise<UIMessage[]> {
  const { channelSource, channelMetadata, messages, conversationId, supabase } = options;

  // For Slack messages with a thread, fetch previous messages from the same thread
  if (channelSource === "slack" && channelMetadata?.slack_thread_ts) {
    const threadTs = channelMetadata.slack_thread_ts;
    console.log("[conversation] Fetching Slack thread history for:", threadTs);

    const threadMessages = await getMessagesForSlackThread(
      supabase,
      conversationId,
      threadTs,
      30 // Limit to last 30 messages in thread
    );

    if (threadMessages.length > 0) {
      console.log(`[conversation] Found ${threadMessages.length} previous messages in thread`);

      // Convert database messages to UIMessage format
      const historyMessages: UIMessage[] = threadMessages.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        parts: [{ type: "text" as const, text: msg.content }],
      }));

      // Get the current message content to check for duplicates
      const currentMessageContent = messages
        .filter((m) => m.role === "user")
        .map((m) =>
          m.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n")
        )
        .join("\n");

      // Filter out the current message from history if it was already saved
      const filteredHistory = historyMessages.filter((msg) => {
        const msgContent = msg.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n");
        if (msg.role === "user" && msgContent === currentMessageContent) {
          return false;
        }
        return true;
      });

      // Prepend history to current messages
      const messagesWithHistory = [...filteredHistory, ...messages];
      console.log(`[conversation] Total messages with history: ${messagesWithHistory.length}`);
      return messagesWithHistory;
    }
  }

  return messages;
}

/**
 * Build message metadata for channel-specific information
 */
export function buildMessageMetadata(
  channelSource?: ChannelType | "cron",
  channelMetadata?: {
    slack_channel_id?: string;
    slack_thread_ts?: string;
    slack_user_id?: string;
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
    slack_channel_id: channelMetadata?.slack_channel_id,
    slack_thread_ts: channelMetadata?.slack_thread_ts,
    slack_user_id: channelMetadata?.slack_user_id,
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
