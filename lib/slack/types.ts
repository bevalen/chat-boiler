import { SlackCredentials, ChannelType } from "@/lib/types/database";

/**
 * Configuration for the Slack bot
 */
export interface SlackBotConfig {
  botToken: string;
  appToken: string;
  signingSecret?: string;
}

/**
 * Incoming Slack message context
 */
export interface SlackMessageContext {
  userId: string;
  channelId: string;
  teamId: string;
  text: string;
  threadTs?: string;
  messageTs: string;
  isDirectMessage: boolean;
  isMention: boolean;
}

/**
 * Options for sending a Slack message
 */
export interface SlackSendOptions {
  channelId: string;
  text: string;
  threadTs?: string;
  blocks?: unknown[];
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
}

/**
 * Result of a Slack message send operation
 */
export interface SlackSendResult {
  success: boolean;
  messageTs?: string;
  channelId?: string;
  error?: string;
}

/**
 * Channel delivery configuration
 */
export interface ChannelDeliveryConfig {
  preferredChannel: ChannelType;
  slackChannelId?: string;
  slackThreadTs?: string;
  fallbackToApp?: boolean;
}

/**
 * Re-export SlackCredentials for convenience
 */
export type { SlackCredentials };
