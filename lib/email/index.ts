// Resend Email Integration for MAIA
// Exports all email-related functionality

export {
  resend,
  isResendConfigured,
  getAgentEmailAddress,
  parseAgentEmailAddress,
  formatFromAddress,
  RESEND_FROM_DOMAIN,
  RESEND_WEBHOOK_SECRET,
  type ResendEmailResponse,
  type ResendError,
  type ResendWebhookEvent,
  type EmailReceivedWebhookData,
  type EmailDeliveredWebhookData,
  type EmailBouncedWebhookData,
} from "./resend-client";

export {
  generateEmailSignature,
  generateTextSignature,
  appendSignatureToHtml,
  appendSignatureToText,
  type SignatureParams,
} from "./signature-template";

export {
  sendEmail,
  replyToEmail,
  type SendEmailParams,
  type SendEmailResult,
  type ReplyToEmailParams,
} from "./send-email";
