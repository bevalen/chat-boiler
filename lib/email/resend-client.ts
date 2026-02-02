import { Resend } from "resend";

// Initialize Resend client
// Ensure RESEND_API_KEY is set in environment variables
const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn(
    "[resend] RESEND_API_KEY is not set. Email functionality will be disabled."
  );
}

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Get the configured sending domain
export const RESEND_FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN || "send.maia.madewell.ai";

// Get the webhook secret for signature verification
export const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

/**
 * Check if Resend is properly configured
 */
export function isResendConfigured(): boolean {
  return !!resend && !!resendApiKey;
}

/**
 * Generate the agent's email address based on agent ID
 * Format: agent-{agentId}@{domain}
 */
export function getAgentEmailAddress(agentId: string): string {
  return `agent-${agentId}@${RESEND_FROM_DOMAIN}`;
}

/**
 * Parse agent ID from an email address
 * Returns null if the email doesn't match the expected format
 */
export function parseAgentEmailAddress(email: string): string | null {
  const match = email.match(/^agent-([a-f0-9-]+)@/i);
  return match ? match[1] : null;
}

/**
 * Format the "From" address with agent and user names
 * Format: "Maia (Ben's Assistant) <agent-{agentId}@domain>"
 */
export function formatFromAddress(
  agentName: string,
  userName: string,
  agentId: string
): string {
  const emailAddress = getAgentEmailAddress(agentId);
  const displayName = `${agentName} (${userName}'s Assistant)`;
  return `${displayName} <${emailAddress}>`;
}

// Types for Resend API responses
export interface ResendEmailResponse {
  id: string;
}

export interface ResendError {
  statusCode: number;
  message: string;
  name: string;
}

// Webhook event types
export interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    attachments?: {
      id: string;
      filename: string;
      content_type: string;
    }[];
  };
}

export interface EmailReceivedWebhookData {
  email_id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  attachments?: {
    id: string;
    filename: string;
    content_type: string;
  }[];
}

export interface EmailDeliveredWebhookData {
  email_id: string;
  to: string;
}

export interface EmailBouncedWebhookData {
  email_id: string;
  to: string;
  bounce: {
    type: string;
    message: string;
  };
}
