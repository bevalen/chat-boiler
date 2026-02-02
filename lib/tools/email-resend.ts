/**
 * Resend-based Email Tools for MAIA Agent
 * 
 * Replaces Zapier MCP email tools with direct Resend integration.
 * Features:
 * - Automatic signature injection
 * - Proper email threading
 * - Local inbox queries (instant, no rate limits)
 * - Full audit logging
 */

import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, replyToEmail } from "@/lib/email/send-email";
import { isResendConfigured, getAgentEmailAddress } from "@/lib/email/resend-client";
import { 
  getInboxEmails, 
  markEmailAsRead, 
  getUnreadEmailCount, 
  getEmailById, 
  getEmailThread 
} from "@/lib/db/emails";

/**
 * Create the sendEmail tool with agentId and user context captured in closure
 */
export function createSendEmailTool(
  agentId: string,
  userId: string,
  agentName: string,
  userName: string,
  userEmail?: string,
  userTitle?: string,
  userCompany?: string
) {
  return tool({
    description:
      `Send an email from YOUR (the AI assistant's) email account (${getAgentEmailAddress(agentId)}). ` +
      "This is NOT the user's email - it's your own dedicated email address. " +
      "Use this when the user asks you to send an email, follow up with someone, or reach out to a contact on their behalf. " +
      "IMPORTANT: Write the email body in HTML format using <p> tags for paragraphs, <br> for line breaks, <strong> for bold, <ul>/<li> for lists. " +
      "Your professional email signature will be automatically appended - do NOT add a sign-off or your name at the end.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe(
        "Email body in HTML format. Use <p> tags for paragraphs, <br> for line breaks, <strong> for bold, <em> for italic, " +
        "<ul>/<ol> with <li> for lists. Example: '<p>Hi John,</p><p>I wanted to follow up on our conversation.</p>'. " +
        "Do NOT include a sign-off or name - your signature is automatically appended."
      ),
      cc: z.string().optional().describe("CC recipient email address (optional)"),
      bcc: z.string().optional().describe("BCC recipient email address (optional)"),
    }),
    execute: async ({ to, subject, body, cc, bcc }) => {
      // Check if Resend is configured
      if (!isResendConfigured()) {
        return {
          success: false,
          message: "Email service is not configured. Please contact the administrator to set up Resend.",
        };
      }

      const result = await sendEmail({
        to,
        subject,
        htmlBody: body,
        cc,
        bcc,
        agentId,
        userId,
        agentName,
        userName,
        userEmail,
        userTitle,
        userCompany,
        includeSignature: true,
      });

      if (!result.success) {
        return {
          success: false,
          message: `Failed to send email: ${result.error}`,
        };
      }

      return {
        success: true,
        message: `Email sent successfully to ${to}`,
        emailId: result.storedEmailId,
        details: {
          to,
          subject,
          bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
        },
      };
    },
  });
}

/**
 * Create the replyToEmail tool
 */
export function createReplyToEmailTool(
  agentId: string,
  userId: string,
  agentName: string,
  userName: string,
  userEmail?: string,
  userTitle?: string,
  userCompany?: string
) {
  return tool({
    description:
      "Reply to an existing email thread. This maintains proper email threading so the reply appears in the same conversation. " +
      "Use this instead of sendEmail when responding to an email you received. " +
      "IMPORTANT: Write the reply body in HTML format. Your signature will be automatically appended.",
    inputSchema: z.object({
      emailId: z.string().describe("The ID of the email to reply to (from the email's id field when checking inbox)"),
      body: z.string().describe(
        "Reply body in HTML format. Use <p> tags for paragraphs, <br> for line breaks. " +
        "Example: '<p>Thank you for your email.</p><p>I will look into this and get back to you.</p>'. " +
        "Do NOT include a sign-off - your signature is automatically appended."
      ),
      subject: z.string().optional().describe("Override the subject line (optional - defaults to 'Re: [original subject]')"),
    }),
    execute: async ({ emailId, body, subject }) => {
      if (!isResendConfigured()) {
        return {
          success: false,
          message: "Email service is not configured. Please contact the administrator to set up Resend.",
        };
      }

      const supabase = getAdminClient();

      // Get the original email to find recipient
      const { email: originalEmail, error: fetchError } = await getEmailById(supabase, emailId);

      if (fetchError || !originalEmail) {
        return {
          success: false,
          message: `Could not find the original email: ${fetchError || "Not found"}`,
        };
      }

      // Reply to the sender of the original email
      const replyTo = originalEmail.from_address;

      const result = await replyToEmail({
        originalEmailId: emailId,
        to: replyTo,
        subject: subject || `Re: ${originalEmail.subject}`,
        htmlBody: body,
        agentId,
        userId,
        agentName,
        userName,
        userEmail,
        userTitle,
        userCompany,
        includeSignature: true,
      });

      if (!result.success) {
        return {
          success: false,
          message: `Failed to send reply: ${result.error}`,
        };
      }

      return {
        success: true,
        message: `Reply sent successfully to ${replyTo}`,
        emailId: result.storedEmailId,
        details: {
          to: replyTo,
          subject: subject || `Re: ${originalEmail.subject}`,
          inReplyTo: originalEmail.message_id,
        },
      };
    },
  });
}

/**
 * Create the checkInbox tool - queries local database for speed
 */
export function createCheckEmailTool(agentId: string) {
  return tool({
    description:
      "Check your email inbox for recent messages. Returns a summary of emails. " +
      "Use this when the user asks about their emails, inbox, or wants to know if they have any messages. " +
      "This checks YOUR (the agent's) inbox, not the user's personal email.",
    inputSchema: z.object({
      count: z
        .number()
        .optional()
        .default(10)
        .describe("Number of recent emails to retrieve (default: 10, max: 50)"),
      unreadOnly: z
        .boolean()
        .optional()
        .default(false)
        .describe("Only show unread emails (default: false)"),
    }),
    execute: async ({ count, unreadOnly }) => {
      const emailCount = Math.min(count ?? 10, 50);
      const onlyUnread = unreadOnly ?? false;

      const supabase = getAdminClient();

      // Query our local database - instant, no rate limits!
      const { emails, error } = await getInboxEmails(supabase, agentId, {
        unreadOnly: onlyUnread,
        limit: emailCount,
        direction: "inbound", // Only show received emails in inbox
      });

      if (error) {
        return {
          success: false,
          message: `Failed to check inbox: ${error}`,
          emails: [],
        };
      }

      // Get unread count
      const { count: unreadCount } = await getUnreadEmailCount(supabase, agentId);

      // Format emails for response
      const formattedEmails = emails.map((email) => ({
        id: email.id,
        from: email.from_name 
          ? `${email.from_name} <${email.from_address}>`
          : email.from_address,
        subject: email.subject,
        preview: email.text_body?.substring(0, 150) || 
                 email.html_body?.replace(/<[^>]+>/g, "").substring(0, 150) || 
                 "(No preview available)",
        receivedAt: email.received_at || email.created_at,
        isRead: email.is_read,
        hasAttachments: false, // TODO: Add attachment check
      }));

      return {
        success: true,
        message: onlyUnread 
          ? `Found ${emails.length} unread email(s)`
          : `Found ${emails.length} email(s)`,
        totalUnread: unreadCount,
        emails: formattedEmails,
      };
    },
  });
}

/**
 * Create the markAsRead tool
 */
export function createMarkEmailAsReadTool(agentId: string) {
  return tool({
    description:
      "Mark an email as read. Use this after you've processed or discussed an email with the user.",
    inputSchema: z.object({
      emailId: z.string().describe("The ID of the email to mark as read"),
    }),
    execute: async ({ emailId }) => {
      const supabase = getAdminClient();

      const { success, error } = await markEmailAsRead(supabase, emailId);

      if (!success) {
        return {
          success: false,
          message: `Failed to mark email as read: ${error}`,
        };
      }

      return {
        success: true,
        message: "Email marked as read",
      };
    },
  });
}

/**
 * Create the getEmailDetails tool - for reading full email content
 */
export function createGetEmailDetailsTool(agentId: string) {
  return tool({
    description:
      "Get the full details of a specific email including the complete body content. " +
      "Use this when you need to read the full content of an email.",
    inputSchema: z.object({
      emailId: z.string().describe("The ID of the email to retrieve"),
    }),
    execute: async ({ emailId }) => {
      const supabase = getAdminClient();

      const { email, error } = await getEmailById(supabase, emailId);

      if (error || !email) {
        return {
          success: false,
          message: `Could not find email: ${error || "Not found"}`,
        };
      }

      // Verify this email belongs to the agent
      if (email.agent_id !== agentId) {
        return {
          success: false,
          message: "You don't have access to this email",
        };
      }

      return {
        success: true,
        email: {
          id: email.id,
          from: email.from_name 
            ? `${email.from_name} <${email.from_address}>`
            : email.from_address,
          to: email.to_addresses.join(", "),
          cc: email.cc_addresses?.join(", ") || null,
          subject: email.subject,
          body: email.text_body || email.html_body?.replace(/<[^>]+>/g, "") || "(No content)",
          htmlBody: email.html_body,
          receivedAt: email.received_at || email.created_at,
          isRead: email.is_read,
          threadId: email.thread_id,
        },
      };
    },
  });
}

/**
 * Create the getEmailThread tool - for viewing conversation history
 */
export function createGetEmailThreadTool(agentId: string) {
  return tool({
    description:
      "Get all emails in a conversation thread. Use this to see the full email conversation history.",
    inputSchema: z.object({
      threadId: z.string().describe("The thread ID to retrieve (from an email's threadId field)"),
    }),
    execute: async ({ threadId }) => {
      const supabase = getAdminClient();

      const { emails, error } = await getEmailThread(supabase, threadId);

      if (error) {
        return {
          success: false,
          message: `Failed to get thread: ${error}`,
          emails: [],
        };
      }

      // Verify emails belong to the agent
      const authorizedEmails = emails.filter((e) => e.agent_id === agentId);

      if (authorizedEmails.length === 0) {
        return {
          success: false,
          message: "No emails found in this thread",
          emails: [],
        };
      }

      const formattedEmails = authorizedEmails.map((email) => ({
        id: email.id,
        direction: email.direction,
        from: email.from_name 
          ? `${email.from_name} <${email.from_address}>`
          : email.from_address,
        to: email.to_addresses.join(", "),
        subject: email.subject,
        preview: email.text_body?.substring(0, 200) || 
                 email.html_body?.replace(/<[^>]+>/g, "").substring(0, 200) || 
                 "(No preview)",
        timestamp: email.direction === "inbound" 
          ? (email.received_at || email.created_at)
          : (email.sent_at || email.created_at),
      }));

      return {
        success: true,
        threadId,
        emailCount: formattedEmails.length,
        emails: formattedEmails,
      };
    },
  });
}

/**
 * Create the forwardEmail tool
 */
export function createForwardEmailTool(
  agentId: string,
  userId: string,
  agentName: string,
  userName: string,
  userEmail?: string,
  userTitle?: string,
  userCompany?: string
) {
  return tool({
    description:
      "Forward an email to another recipient. Use this when you need to share an email with someone else, " +
      "or when the user asks you to forward something to them.",
    inputSchema: z.object({
      emailId: z.string().describe("The ID of the email to forward"),
      to: z.string().describe("Email address to forward to"),
      additionalMessage: z.string().optional().describe(
        "Optional message to add before the forwarded content (in HTML format)"
      ),
    }),
    execute: async ({ emailId, to, additionalMessage }) => {
      if (!isResendConfigured()) {
        return {
          success: false,
          message: "Email service is not configured. Please contact the administrator to set up Resend.",
        };
      }

      const supabase = getAdminClient();

      // Get the original email
      const { email: originalEmail, error: fetchError } = await getEmailById(supabase, emailId);

      if (fetchError || !originalEmail) {
        return {
          success: false,
          message: `Could not find the original email: ${fetchError || "Not found"}`,
        };
      }

      // Verify ownership
      if (originalEmail.agent_id !== agentId) {
        return {
          success: false,
          message: "You don't have access to this email",
        };
      }

      // Build forwarded email body
      const forwardedBody = `
${additionalMessage ? `<div>${additionalMessage}</div><hr style="margin: 20px 0;">` : ""}
<div style="color: #666; font-size: 14px; margin-bottom: 16px;">
  <strong>Forwarded message</strong><br>
  From: ${originalEmail.from_name ? `${originalEmail.from_name} <${originalEmail.from_address}>` : originalEmail.from_address}<br>
  Date: ${originalEmail.received_at || originalEmail.created_at}<br>
  Subject: ${originalEmail.subject}<br>
  To: ${originalEmail.to_addresses.join(", ")}
</div>
<div>
  ${originalEmail.html_body || originalEmail.text_body?.split("\n").map((line) => `<p>${line}</p>`).join("") || "(No content)"}
</div>
      `.trim();

      const result = await sendEmail({
        to,
        subject: `Fwd: ${originalEmail.subject}`,
        htmlBody: forwardedBody,
        agentId,
        userId,
        agentName,
        userName,
        userEmail,
        userTitle,
        userCompany,
        includeSignature: true,
      });

      if (!result.success) {
        return {
          success: false,
          message: `Failed to forward email: ${result.error}`,
        };
      }

      return {
        success: true,
        message: `Email forwarded to ${to}`,
        emailId: result.storedEmailId,
      };
    },
  });
}

// Type helpers for UI components
export type SendEmailToolResend = ReturnType<typeof createSendEmailTool>;
export type ReplyToEmailToolResend = ReturnType<typeof createReplyToEmailTool>;
export type CheckEmailToolResend = ReturnType<typeof createCheckEmailTool>;
export type MarkEmailAsReadTool = ReturnType<typeof createMarkEmailAsReadTool>;
export type GetEmailDetailsTool = ReturnType<typeof createGetEmailDetailsTool>;
export type GetEmailThreadTool = ReturnType<typeof createGetEmailThreadTool>;
export type ForwardEmailTool = ReturnType<typeof createForwardEmailTool>;

export type SendEmailToolInvocationResend = UIToolInvocation<SendEmailToolResend>;
export type ReplyToEmailToolInvocationResend = UIToolInvocation<ReplyToEmailToolResend>;
export type CheckEmailToolInvocationResend = UIToolInvocation<CheckEmailToolResend>;
