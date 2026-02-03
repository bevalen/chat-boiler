import { resend, isResendConfigured, formatFromAddress, getAgentEmailAddress } from "./resend-client";
import {
  generateEmailSignature,
  generateTextSignature,
  appendSignatureToHtml,
  appendSignatureToText,
  SignatureParams,
} from "./signature-template";
import { getAdminClient } from "@/lib/supabase/admin";

export interface SendEmailParams {
  // Recipient information
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  
  // Email content
  subject: string;
  htmlBody?: string;
  textBody?: string;
  
  // Threading
  inReplyTo?: string; // Message-ID of email being replied to
  references?: string[]; // Array of Message-IDs in thread
  threadId?: string; // Internal thread ID for grouping
  
  // Agent context (required for signature)
  agentId: string;
  userId: string;
  agentName: string;
  userName: string;
  userEmail?: string;
  userTitle?: string;
  userCompany?: string;
  
  // Options
  includeSignature?: boolean;
  tags?: { name: string; value: string }[];
  idempotencyKey?: string;
}

export interface SendEmailResult {
  success: boolean;
  emailId?: string; // Resend email ID
  messageId?: string; // RFC 2822 Message-ID
  error?: string;
  storedEmailId?: string; // Our database email ID
}

export interface ReplyToEmailParams extends Omit<SendEmailParams, "inReplyTo" | "references"> {
  // The email ID (from our database) being replied to
  originalEmailId: string;
}

/**
 * Send an email via Resend with automatic signature injection
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!isResendConfigured() || !resend) {
    return {
      success: false,
      error: "Resend is not configured. Please set RESEND_API_KEY environment variable.",
    };
  }

  const {
    to,
    cc,
    bcc,
    replyTo,
    subject,
    htmlBody,
    textBody,
    inReplyTo,
    references,
    threadId,
    agentId,
    userId,
    agentName,
    userName,
    userEmail,
    userTitle,
    userCompany,
    includeSignature = true,
    tags,
    idempotencyKey,
  } = params;

  try {
    // Build signature parameters
    const signatureParams: SignatureParams = {
      agentName,
      userName,
      userTitle,
      userCompany,
      userEmail,
      agentEmail: getAgentEmailAddress(agentId),
    };

    // Generate signatures
    const htmlSignature = includeSignature ? generateEmailSignature(signatureParams) : "";
    const textSignature = includeSignature ? generateTextSignature(signatureParams) : "";

    // Build email body with signature
    let finalHtmlBody = htmlBody || "";
    let finalTextBody = textBody || "";

    // Convert relative URLs to absolute URLs before sending
    if (finalHtmlBody) {
      finalHtmlBody = convertRelativeUrlsToAbsolute(finalHtmlBody);
    }

    if (includeSignature) {
      if (finalHtmlBody) {
        finalHtmlBody = appendSignatureToHtml(finalHtmlBody, htmlSignature);
      }
      if (finalTextBody) {
        finalTextBody = appendSignatureToText(finalTextBody, textSignature);
      }
      // If only HTML provided, generate text version
      if (finalHtmlBody && !finalTextBody) {
        finalTextBody = stripHtmlForText(finalHtmlBody) + "\n\n\n" + textSignature;
      }
    }

    // Build headers for threading
    const headers: Record<string, string> = {};
    if (inReplyTo) {
      headers["In-Reply-To"] = inReplyTo;
    }
    if (references && references.length > 0) {
      headers["References"] = references.join(" ");
    }

    // Format the from address
    const fromAddress = formatFromAddress(agentName, userName, agentId);
    const agentEmailAddress = getAgentEmailAddress(agentId);

    // Normalize recipients to arrays
    const toAddresses = Array.isArray(to) ? to : [to];
    const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;
    const bccAddresses = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;

    // Send via Resend
    const sendOptions = {
      from: fromAddress,
      to: toAddresses,
      subject,
      html: finalHtmlBody || undefined,
      text: finalTextBody || undefined,
      cc: ccAddresses,
      bcc: bccAddresses,
      replyTo: replyTo || agentEmailAddress,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      tags,
    };

    const idempotencyOptions = idempotencyKey 
      ? { idempotencyKey } 
      : undefined;

    const { data, error } = await resend.emails.send(sendOptions as any, idempotencyOptions);

    if (error) {
      console.error("[send-email] Resend error:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Store the sent email in our database
    const supabase = getAdminClient();
    
    // Generate a thread ID if not provided
    const emailThreadId = threadId || `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const { data: storedEmail, error: dbError } = await supabase
      .from("emails")
      .insert({
        user_id: userId,
        agent_id: agentId,
        resend_email_id: data?.id,
        direction: "outbound",
        status: "sent",
        message_id: data?.id ? `<${data.id}@resend.dev>` : null, // Resend generates Message-ID
        in_reply_to: inReplyTo || null,
        thread_id: emailThreadId,
        references_ids: references || null,
        from_address: agentEmailAddress,
        from_name: `${agentName} (${userName}'s Assistant)`,
        to_addresses: toAddresses,
        cc_addresses: ccAddresses || null,
        bcc_addresses: bccAddresses || null,
        reply_to_address: replyTo || agentEmailAddress || null,
        subject,
        html_body: finalHtmlBody || null,
        text_body: finalTextBody || null,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("[send-email] Database error storing email:", dbError);
      // Don't fail the whole operation if storage fails
    }

    // Log the action
    await supabase.from("action_log").insert({
      agent_id: agentId,
      tool_name: "sendEmail",
      action: "send_email",
      params: {
        to: toAddresses,
        subject,
        isReply: !!inReplyTo,
      },
      result: {
        success: true,
        resend_email_id: data?.id,
      },
    });

    return {
      success: true,
      emailId: data?.id,
      messageId: data?.id ? `<${data.id}@resend.dev>` : undefined,
      storedEmailId: storedEmail?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-email] Error:", errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Reply to an existing email with proper threading
 */
export async function replyToEmail(params: ReplyToEmailParams): Promise<SendEmailResult> {
  const { originalEmailId, ...sendParams } = params;
  
  const supabase = getAdminClient();
  
  // Fetch the original email to get threading information
  const { data: originalEmail, error } = await supabase
    .from("emails")
    .select("message_id, thread_id, references_ids, from_address, subject")
    .eq("id", originalEmailId)
    .single();

  if (error || !originalEmail) {
    return {
      success: false,
      error: `Could not find original email: ${error?.message || "Not found"}`,
    };
  }

  // Build references chain
  const references: string[] = [];
  if (originalEmail.references_ids) {
    references.push(...originalEmail.references_ids);
  }
  if (originalEmail.message_id && !references.includes(originalEmail.message_id)) {
    references.push(originalEmail.message_id);
  }

  // Ensure subject starts with "Re:" if it doesn't already
  let subject = sendParams.subject;
  if (!subject.toLowerCase().startsWith("re:")) {
    subject = `Re: ${originalEmail.subject || subject}`;
  }

  return sendEmail({
    ...sendParams,
    subject,
    inReplyTo: originalEmail.message_id || undefined,
    references: references.length > 0 ? references : undefined,
    threadId: originalEmail.thread_id || undefined,
  });
}

/**
 * Convert relative URLs in HTML to absolute URLs
 * This ensures all links in emails work properly
 */
function convertRelativeUrlsToAbsolute(html: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://madewell-maia.vercel.app";
  
  return html
    // Convert relative hrefs to absolute
    .replace(/href=["'](\/)([^"']*)["']/gi, `href="${baseUrl}$1$2"`)
    // Convert relative src to absolute (for images)
    .replace(/src=["'](\/)([^"']*)["']/gi, `src="${baseUrl}$1$2"`)
    // Handle href without leading slash but clearly internal (e.g., href="tasks/123")
    .replace(/href=["'](?!https?:\/\/|mailto:|tel:|#)([^"']*)["']/gi, (match, path) => {
      // If it starts with these patterns, it's likely internal
      if (path.startsWith('tasks') || path.startsWith('projects') || 
          path.startsWith('dashboard') || path.startsWith('settings') ||
          path.startsWith('activity') || path.startsWith('feedback')) {
        return `href="${baseUrl}/${path}"`;
      }
      return match;
    });
}

/**
 * Simple HTML stripper for generating plain text version
 */
function stripHtmlForText(html: string): string {
  return html
    // Remove script and style elements
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    // Replace common block elements with newlines
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, "\n")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}
