import { App, LogLevel } from "@slack/bolt";
import { SlackBotConfig, SlackMessageContext } from "./types";
import { markdownToSlackMrkdwn } from "./client";

/**
 * Message handler function type
 */
export type SlackMessageHandler = (
  context: SlackMessageContext,
  respond: (text: string) => Promise<void>
) => Promise<void>;

/**
 * Create and configure a Slack Bolt app
 */
export function createSlackBotApp(config: SlackBotConfig): App {
  return new App({
    token: config.botToken,
    socketMode: true,
    appToken: config.appToken,
    logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
  });
}

/**
 * Initialize the Slack bot with message handling
 */
export async function initializeSlackBot(
  config: SlackBotConfig,
  onMessage: SlackMessageHandler
): Promise<App> {
  const app = createSlackBotApp(config);

  // Listen for all messages
  app.message(async ({ message, say, client }) => {
    // Type guard for message with text
    if (!("text" in message) || !message.text) {
      return;
    }

    // Skip bot messages to avoid loops
    if ("bot_id" in message && message.bot_id) {
      return;
    }

    // Determine if this is a DM or channel message
    const channelType = message.channel_type;
    const isDirectMessage = channelType === "im";

    // For channel messages, check if the bot was mentioned
    let isMention = false;
    let messageText = message.text;

    // Check for bot mentions in channel messages
    if (!isDirectMessage && "user" in message) {
      // Get bot's user ID
      const authResult = await client.auth.test();
      const botUserId = authResult.user_id;

      if (botUserId && messageText.includes(`<@${botUserId}>`)) {
        isMention = true;
        // Remove the mention from the message
        messageText = messageText.replace(new RegExp(`<@${botUserId}>`, "g"), "").trim();
      } else {
        // If not a DM and not mentioned, ignore
        return;
      }
    }

    const context: SlackMessageContext = {
      userId: "user" in message ? message.user || "" : "",
      channelId: message.channel,
      teamId: "team" in message ? (message.team as string) || "" : "",
      text: messageText,
      threadTs: "thread_ts" in message ? message.thread_ts : undefined,
      messageTs: message.ts,
      isDirectMessage,
      isMention,
    };

    // Create respond function
    const respond = async (text: string) => {
      const slackText = markdownToSlackMrkdwn(text);
      await say({
        text: slackText,
        thread_ts: context.threadTs || context.messageTs,
      });
    };

    try {
      await onMessage(context, respond);
    } catch (error) {
      console.error("[slack-bot] Error handling message:", error);
      await say({
        text: "Sorry, I encountered an error processing your message. Please try again.",
        thread_ts: context.threadTs || context.messageTs,
      });
    }
  });

  // Handle app mentions (when bot is @mentioned in channels)
  app.event("app_mention", async ({ event, say }) => {
    // Get the text without the mention
    const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

    const context: SlackMessageContext = {
      userId: event.user,
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

    try {
      await onMessage(context, respond);
    } catch (error) {
      console.error("[slack-bot] Error handling app mention:", error);
      await say({
        text: "Sorry, I encountered an error processing your message. Please try again.",
        thread_ts: context.threadTs || context.messageTs,
      });
    }
  });

  return app;
}

/**
 * Start the Slack bot
 */
export async function startSlackBot(app: App): Promise<void> {
  await app.start();
  console.log("[slack-bot] Slack bot is running!");
}

/**
 * Stop the Slack bot
 */
export async function stopSlackBot(app: App): Promise<void> {
  await app.stop();
  console.log("[slack-bot] Slack bot stopped");
}
