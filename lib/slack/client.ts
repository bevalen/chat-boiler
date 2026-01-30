import { WebClient } from "@slack/web-api";
import { SlackSendOptions, SlackSendResult, SlackCredentials } from "./types";

/**
 * Create a Slack WebClient instance from credentials
 */
export function createSlackClient(credentials: SlackCredentials): WebClient {
  return new WebClient(credentials.bot_token);
}

/**
 * Send a message to Slack
 */
export async function sendSlackMessage(
  client: WebClient,
  options: SlackSendOptions
): Promise<SlackSendResult> {
  try {
    const result = await client.chat.postMessage({
      channel: options.channelId,
      text: options.text,
      thread_ts: options.threadTs,
      blocks: options.blocks as never,
      unfurl_links: options.unfurlLinks ?? false,
      unfurl_media: options.unfurlMedia ?? true,
    });

    if (result.ok) {
      return {
        success: true,
        messageTs: result.ts,
        channelId: result.channel,
      };
    } else {
      return {
        success: false,
        error: result.error || "Unknown Slack API error",
      };
    }
  } catch (error) {
    console.error("[slack] Error sending message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send message",
    };
  }
}

/**
 * Send a direct message to a Slack user
 */
export async function sendSlackDirectMessage(
  client: WebClient,
  slackUserId: string,
  text: string,
  threadTs?: string
): Promise<SlackSendResult> {
  try {
    // Open a DM channel with the user if needed
    const conversationResult = await client.conversations.open({
      users: slackUserId,
    });

    if (!conversationResult.ok || !conversationResult.channel?.id) {
      return {
        success: false,
        error: "Failed to open DM channel",
      };
    }

    return sendSlackMessage(client, {
      channelId: conversationResult.channel.id,
      text,
      threadTs,
    });
  } catch (error) {
    console.error("[slack] Error sending direct message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send DM",
    };
  }
}

/**
 * Test Slack connection with given credentials
 */
export async function testSlackConnection(
  credentials: SlackCredentials
): Promise<{ success: boolean; teamName?: string; botName?: string; error?: string }> {
  try {
    const client = createSlackClient(credentials);

    // Test auth
    const authResult = await client.auth.test();

    if (!authResult.ok) {
      return {
        success: false,
        error: authResult.error || "Auth test failed",
      };
    }

    return {
      success: true,
      teamName: authResult.team,
      botName: authResult.user,
    };
  } catch (error) {
    console.error("[slack] Connection test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

/**
 * Get user info from Slack
 */
export async function getSlackUserInfo(
  client: WebClient,
  slackUserId: string
): Promise<{ name?: string; email?: string; error?: string }> {
  try {
    const result = await client.users.info({ user: slackUserId });

    if (!result.ok || !result.user) {
      return { error: result.error || "Failed to get user info" };
    }

    return {
      name: result.user.real_name || result.user.name,
      email: result.user.profile?.email,
    };
  } catch (error) {
    console.error("[slack] Error getting user info:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to get user info",
    };
  }
}

/**
 * Convert markdown to Slack mrkdwn format
 * Handles basic conversions between formats
 */
export function markdownToSlackMrkdwn(text: string): string {
  // Bold: **text** -> *text*
  let converted = text.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // Headers: # Header -> *Header*
  converted = converted.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

  // Bullet points are the same: - item

  // Links: [text](url) -> <url|text>
  converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  // Code blocks: ```lang\ncode\n``` -> ```code```
  converted = converted.replace(/```\w*\n?([\s\S]*?)```/g, "```$1```");

  // Inline code is the same: `code`

  return converted;
}
