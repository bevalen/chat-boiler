/**
 * Slack Bot Entry Point
 * 
 * This script runs the Slack bot as a separate long-running process using Socket Mode.
 * It connects to Slack via WebSocket and routes messages to the MAIA chat API.
 * 
 * Run with: npx tsx scripts/start-slack-bot.ts
 * 
 * Prerequisites:
 * - Set SLACK_BOT_TOKEN (xoxb-...) in .env.local
 * - Set SLACK_APP_TOKEN (xapp-...) in .env.local
 * - Have Socket Mode enabled in your Slack app settings
 * - Have Event Subscriptions enabled with message.im and app_mention scopes
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { App, LogLevel } from "@slack/bolt";
import { SlackMessageContext } from "../lib/slack/types";
import { markdownToSlackMrkdwn } from "../lib/slack/client";

// Validate environment variables
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error("Missing required environment variables:");
  missingVars.forEach((v) => console.error(`  - ${v}`));
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const slackBotToken = process.env.SLACK_BOT_TOKEN!;
const slackAppToken = process.env.SLACK_APP_TOKEN!;
const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create Slack Bolt app
const app = new App({
  token: slackBotToken,
  socketMode: true,
  appToken: slackAppToken,
  logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
});

/**
 * Look up MAIA user and agent from Slack user ID
 */
async function lookupUser(slackUserId: string): Promise<{
  userId: string;
  agentId: string;
  conversationId: string | null;
} | null> {
  // Find user_channel_credentials with this Slack user ID
  const { data: creds, error: credsError } = await supabase
    .from("user_channel_credentials")
    .select("user_id")
    .eq("channel_type", "slack")
    .eq("is_active", true);

  if (credsError || !creds?.length) {
    console.log("[slack-bot] No Slack credentials found");
    return null;
  }

  // Find the credential that matches this Slack user ID
  for (const cred of creds) {
    const { data: fullCred } = await supabase
      .from("user_channel_credentials")
      .select("credentials")
      .eq("user_id", cred.user_id)
      .eq("channel_type", "slack")
      .single();

    const credentials = fullCred?.credentials as { user_slack_id?: string } | undefined;
    if (credentials?.user_slack_id === slackUserId) {
      // Found matching user, get their agent
      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", cred.user_id)
        .single();

      if (!agent) {
        console.log("[slack-bot] No agent found for user");
        return null;
      }

      // Get or create a Slack conversation
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("agent_id", agent.id)
        .eq("channel_type", "slack")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      let conversationId = conv?.id || null;

      if (!conversationId) {
        // Create a new Slack conversation
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            agent_id: agent.id,
            channel_type: "slack",
            status: "active",
            title: "Slack Conversation",
          })
          .select("id")
          .single();
        conversationId = newConv?.id || null;
      }

      return {
        userId: cred.user_id,
        agentId: agent.id,
        conversationId,
      };
    }
  }

  console.log(`[slack-bot] No matching user found for Slack user ${slackUserId}`);
  return null;
}

/**
 * Send message to MAIA chat API and get response
 */
async function sendToMaia(
  userId: string,
  agentId: string,
  conversationId: string | null,
  text: string,
  slackContext: {
    channelId: string;
    threadTs?: string;
    slackUserId: string;
  }
): Promise<string> {
  try {
    // Build the message in UIMessage format
    const messages = [
      {
        role: "user",
        content: text,
        parts: [{ type: "text", text }],
      },
    ];

    const response = await fetch(`${appBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Use service role key for internal API access
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        messages,
        conversationId,
        channelSource: "slack",
        channelMetadata: {
          slack_channel_id: slackContext.channelId,
          slack_thread_ts: slackContext.threadTs,
          slack_user_id: slackContext.slackUserId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[slack-bot] Chat API error:", response.status, errorText);
      return "Sorry, I encountered an error processing your message. Please try again.";
    }

    // The response is a stream, so we need to read it
    const reader = response.body?.getReader();
    if (!reader) {
      return "Sorry, I couldn't get a response. Please try again.";
    }

    let fullResponse = "";
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      // The AI SDK streams in a specific format, parse it
      // Each line is prefixed with data type
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("0:")) {
          // Text content - remove the prefix and parse JSON string
          try {
            const textContent = JSON.parse(line.slice(2));
            fullResponse += textContent;
          } catch {
            // Not valid JSON, might be raw text
            fullResponse += line.slice(2);
          }
        }
      }
    }

    return fullResponse || "I processed your message but have nothing to say right now.";
  } catch (error) {
    console.error("[slack-bot] Error calling chat API:", error);
    return "Sorry, I encountered an error. Please try again later.";
  }
}

/**
 * Handle incoming Slack messages
 */
async function handleMessage(context: SlackMessageContext, respond: (text: string) => Promise<void>) {
  console.log(`[slack-bot] Received message from ${context.userId}: ${context.text.substring(0, 50)}...`);

  // Look up the MAIA user
  const user = await lookupUser(context.userId);

  if (!user) {
    await respond(
      "Hi! I don't recognize your Slack account. Please connect Slack in your MAIA settings first."
    );
    return;
  }

  // Send to MAIA and get response
  const response = await sendToMaia(
    user.userId,
    user.agentId,
    user.conversationId,
    context.text,
    {
      channelId: context.channelId,
      threadTs: context.threadTs,
      slackUserId: context.userId,
    }
  );

  // Send response back to Slack
  await respond(response);
}

// Set up message handlers
app.message(async ({ message, say, client }) => {
  // Type guard for message with text
  if (!("text" in message) || !message.text) {
    return;
  }

  // Skip bot messages to avoid loops
  if ("bot_id" in message && message.bot_id) {
    return;
  }

  // Only handle DMs
  const channelType = message.channel_type;
  if (channelType !== "im") {
    // For channel messages, check if the bot was mentioned
    const authResult = await client.auth.test();
    const botUserId = authResult.user_id;

    if (!botUserId || !message.text.includes(`<@${botUserId}>`)) {
      return; // Ignore channel messages where bot isn't mentioned
    }
  }

  const context: SlackMessageContext = {
    userId: "user" in message ? message.user || "" : "",
    channelId: message.channel,
    teamId: "team" in message ? (message.team as string) || "" : "",
    text: message.text,
    threadTs: "thread_ts" in message ? message.thread_ts : undefined,
    messageTs: message.ts,
    isDirectMessage: channelType === "im",
    isMention: message.text.includes("<@"),
  };

  const respond = async (text: string) => {
    const slackText = markdownToSlackMrkdwn(text);
    await say({
      text: slackText,
      thread_ts: context.threadTs || context.messageTs,
    });
  };

  await handleMessage(context, respond);
});

// Handle app mentions
app.event("app_mention", async ({ event, say }) => {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

  const context: SlackMessageContext = {
    userId: event.user || "",
    channelId: event.channel,
    teamId: event.team || "",
    text,
    threadTs: event.thread_ts,
    messageTs: event.ts,
    isDirectMessage: false,
    isMention: true,
  };

  const respond = async (responseText: string) => {
    const slackText = markdownToSlackMrkdwn(responseText);
    await say({
      text: slackText,
      thread_ts: context.threadTs || context.messageTs,
    });
  };

  await handleMessage(context, respond);
});

// Start the bot
async function main() {
  console.log("[slack-bot] Starting MAIA Slack bot...");
  console.log(`[slack-bot] App base URL: ${appBaseUrl}`);

  try {
    await app.start();
    console.log("[slack-bot] ⚡️ MAIA Slack bot is running!");
    console.log("[slack-bot] Listening for messages...");
  } catch (error) {
    console.error("[slack-bot] Failed to start:", error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on("SIGINT", async () => {
  console.log("\n[slack-bot] Shutting down...");
  await app.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[slack-bot] Shutting down...");
  await app.stop();
  process.exit(0);
});

main();
