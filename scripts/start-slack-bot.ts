/**
 * Slack Bot Entry Point
 * 
 * This script runs the Slack bot as a separate long-running process using Socket Mode.
 * It connects to Slack via WebSocket and routes messages to the MAIA chat API.
 * 
 * Run with: npx tsx scripts/start-slack-bot.ts
 * 
 * Prerequisites:
 * - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * - Configure Slack credentials in MAIA Settings (stored in Supabase)
 * - Have Socket Mode enabled in your Slack app settings
 * - Have Event Subscriptions enabled with message.im and app_mention scopes
 * 
 * NO SLACK TOKENS NEEDED IN ENV - They are pulled from Supabase!
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local (like Next.js does)
config({ path: ".env.local" });
config({ path: ".env" }); // Fallback to .env if .env.local doesn't exist
import { App, LogLevel } from "@slack/bolt";
import { SlackMessageContext } from "../lib/slack/types";
import { markdownToSlackMrkdwn } from "../lib/slack/client";
import { SlackCredentials } from "../lib/types/database";

// Validate environment variables (only Supabase, NOT Slack tokens)
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error("Missing required environment variables:");
  missingVars.forEach((v) => console.error(`  - ${v}`));
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Store active Slack app instances per user
const activeApps: Map<string, { app: App; userId: string; credentials: SlackCredentials }> = new Map();

/**
 * Fetch all active Slack credentials from Supabase
 */
async function fetchActiveSlackCredentials(): Promise<Array<{ userId: string; credentials: SlackCredentials }>> {
  const { data, error } = await supabase
    .from("user_channel_credentials")
    .select("user_id, credentials")
    .eq("channel_type", "slack")
    .eq("is_active", true);

  if (error) {
    console.error("[slack-bot] Error fetching Slack credentials:", error);
    return [];
  }

  return (data || []).map((row) => ({
    userId: row.user_id,
    credentials: row.credentials as SlackCredentials,
  }));
}

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
        userId, // Required for internal API authentication
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
    let isFirstChunk = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      
      // Debug: log first chunk to see stream format
      if (isFirstChunk) {
        console.log("[slack-bot] First chunk (first 300 chars):", chunk.substring(0, 300));
        isFirstChunk = false;
      }
      
      // AI SDK v6 uses SSE format with data: prefix and JSON objects
      // Format: data: {"type":"text-delta","delta":"Hello"}\n\n
      const lines = chunk.split("\n");
      for (const line of lines) {
        // Handle SSE data: prefix format (AI SDK v6)
        if (line.startsWith("data: ")) {
          try {
            const jsonStr = line.slice(6); // Remove "data: " prefix
            if (jsonStr.trim()) {
              const data = JSON.parse(jsonStr);
              if (data.type === "text-delta" && data.delta) {
                fullResponse += data.delta;
              }
            }
          } catch {
            // Ignore parse errors for non-JSON lines
          }
        }
        // Also handle older format with 0: prefix (AI SDK v5 and earlier)
        else if (line.startsWith("0:")) {
          try {
            const textContent = JSON.parse(line.slice(2));
            fullResponse += textContent;
          } catch {
            fullResponse += line.slice(2);
          }
        }
      }
    }

    return fullResponse || "I processed your message but have nothing to say right now.";
  } catch (error) {
    console.error("[slack-bot] Error calling chat API:", error instanceof Error ? error.message : error);
    console.error("[slack-bot] Error stack:", error instanceof Error ? error.stack : "no stack");
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

/**
 * Set up message handlers for a Slack app instance
 */
function setupSlackAppHandlers(app: App, userId: string) {
  // Handle direct messages
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

  console.log(`[slack-bot] Handlers registered for user ${userId}`);
}

/**
 * Create and start a Slack app for a user's credentials
 */
async function startSlackAppForUser(userId: string, credentials: SlackCredentials): Promise<App | null> {
  try {
    if (!credentials.bot_token || !credentials.app_token) {
      console.error(`[slack-bot] Missing tokens for user ${userId}`);
      return null;
    }

    const app = new App({
      token: credentials.bot_token,
      socketMode: true,
      appToken: credentials.app_token,
      logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
    });

    // Set up handlers
    setupSlackAppHandlers(app, userId);

    // Start the app
    await app.start();

    console.log(`[slack-bot] ⚡️ Started Slack bot for user ${userId}`);
    return app;
  } catch (error) {
    console.error(`[slack-bot] Failed to start Slack bot for user ${userId}:`, error);
    return null;
  }
}

/**
 * Stop a Slack app for a user
 */
async function stopSlackAppForUser(userId: string) {
  const entry = activeApps.get(userId);
  if (entry) {
    try {
      await entry.app.stop();
      activeApps.delete(userId);
      console.log(`[slack-bot] Stopped Slack bot for user ${userId}`);
    } catch (error) {
      console.error(`[slack-bot] Error stopping Slack bot for user ${userId}:`, error);
    }
  }
}

/**
 * Sync active Slack apps with database credentials
 * This allows for dynamic updates when users add/remove Slack credentials
 */
async function syncSlackApps() {
  console.log("[slack-bot] Syncing Slack apps with database...");

  const dbCredentials = await fetchActiveSlackCredentials();
  const dbUserIds = new Set(dbCredentials.map((c) => c.userId));
  const activeUserIds = new Set(activeApps.keys());

  // Start apps for new users
  for (const { userId, credentials } of dbCredentials) {
    if (!activeApps.has(userId)) {
      const app = await startSlackAppForUser(userId, credentials);
      if (app) {
        activeApps.set(userId, { app, userId, credentials });
      }
    }
  }

  // Stop apps for users who removed credentials
  for (const userId of activeUserIds) {
    if (!dbUserIds.has(userId)) {
      await stopSlackAppForUser(userId);
    }
  }

  console.log(`[slack-bot] Active Slack bots: ${activeApps.size}`);
}

// Start the bot manager
async function main() {
  console.log("[slack-bot] Starting MAIA Slack bot manager...");
  console.log(`[slack-bot] App base URL: ${appBaseUrl}`);
  console.log("[slack-bot] Credentials are loaded from Supabase (no env vars needed for Slack tokens)");

  // Initial sync
  await syncSlackApps();

  if (activeApps.size === 0) {
    console.log("[slack-bot] No active Slack credentials found in database.");
    console.log("[slack-bot] Configure Slack in MAIA Settings, then restart this bot.");
    console.log("[slack-bot] Waiting for credentials... (checking every 30 seconds)");
  }

  // Periodically check for new/removed credentials
  setInterval(async () => {
    await syncSlackApps();
  }, 30000); // Check every 30 seconds

  console.log("[slack-bot] ⚡️ MAIA Slack bot manager is running!");
  console.log("[slack-bot] Listening for messages...");
}

// Handle shutdown gracefully
async function shutdown() {
  console.log("\n[slack-bot] Shutting down all Slack bots...");
  
  const stopPromises = Array.from(activeApps.keys()).map((userId) => stopSlackAppForUser(userId));
  await Promise.all(stopPromises);
  
  console.log("[slack-bot] All bots stopped. Goodbye!");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main();
