import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { getZapierMCPCredentialsByAgent } from "@/lib/db/channel-credentials";
import { ZapierMCPCredentials } from "@/lib/types/database";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Email types
interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to?: string;
  date: string;
  snippet: string;
  isUnread?: boolean;
}

// Log tool action to the action_log table
async function logToolAction(
  agentId: string,
  toolName: string,
  action: string,
  params: Record<string, unknown>,
  result: Record<string, unknown>
) {
  const supabase = getAdminClient();
  await supabase.from("action_log").insert({
    agent_id: agentId,
    tool_name: toolName,
    action,
    params,
    result,
  });
}

/**
 * Get Zapier MCP credentials for an agent
 */
async function getEmailCredentials(agentId: string): Promise<{
  credentials: ZapierMCPCredentials | null;
  isActive: boolean;
  error: string | null;
}> {
  const supabase = getAdminClient();
  return getZapierMCPCredentialsByAgent(supabase, agentId);
}

/**
 * Create an MCP client and call a tool on the Zapier MCP server
 */
async function callZapierMCPTool(
  credentials: ZapierMCPCredentials,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  let client: Client | null = null;
  
  try {
    // Create MCP client
    client = new Client({
      name: "maia-email-client",
      version: "1.0.0",
    });

    // Build the URL with authentication
    const url = new URL(credentials.endpoint_url);
    
    // Create transport with auth headers if API key is provided
    const transportOptions: { requestInit?: RequestInit } = {};
    if (credentials.api_key) {
      transportOptions.requestInit = {
        headers: {
          "Authorization": `Bearer ${credentials.api_key}`,
        },
      };
    }
    
    const transport = new StreamableHTTPClientTransport(url, transportOptions);
    
    // Connect to the server
    await client.connect(transport);

    // List available tools to find the right one
    const toolsList = await client.listTools();
    console.log("[email] Available MCP tools:", toolsList.tools.map((t: { name: string }) => t.name));

    // Find the matching tool (Zapier tools might have different naming)
    const availableToolNames = toolsList.tools.map((t: { name: string }) => t.name);
    let actualToolName = toolName;
    
    // Try to find a matching tool
    if (!availableToolNames.includes(toolName)) {
      // Try common variations
      const variations = [
        toolName,
        toolName.toLowerCase(),
        toolName.replace(/_/g, "-"),
        `gmail_${toolName}`,
        `gmail-${toolName}`,
      ];
      
      for (const variation of variations) {
        const match = availableToolNames.find((name: string) => 
          name.toLowerCase().includes(variation.toLowerCase()) ||
          variation.toLowerCase().includes(name.toLowerCase())
        );
        if (match) {
          actualToolName = match;
          break;
        }
      }
    }

    console.log(`[email] Calling MCP tool: ${actualToolName} with args:`, args);

    // Call the tool
    const result = await client.callTool({
      name: actualToolName,
      arguments: args,
    });

    console.log("[email] MCP tool result:", result);

    // Close the connection
    await client.close();
    client = null;

    return {
      success: true,
      result: result.structuredContent || result.content,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[email] MCP tool error:", errorMessage);
    
    // Try to close the client if it exists
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Create the checkEmail tool with agentId captured in closure
 */
export function createCheckEmailTool(agentId: string) {
  return tool({
    description:
      "Check the user's email inbox for recent messages. Returns a summary of unread emails. Use this when the user asks about their emails, inbox, or wants to know if they have any messages.",
    inputSchema: z.object({
      count: z
        .number()
        .optional()
        .default(10)
        .describe("Number of recent emails to retrieve (default: 10)"),
      unreadOnly: z
        .boolean()
        .optional()
        .default(true)
        .describe("Only show unread emails (default: true)"),
    }),
    execute: async ({ count, unreadOnly }: { count?: number; unreadOnly?: boolean }) => {
      const emailCount = count ?? 10;
      const onlyUnread = unreadOnly ?? true;
      
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getEmailCredentials(agentId);

      // Check if email integration is configured
      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching email configuration: ${credError}`
            : !credentials 
              ? "Email integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Email integration is disabled. Please enable it in Settings > Channels.",
          emails: [] as EmailMessage[],
        };

        await logToolAction(
          agentId,
          "checkEmail",
          "check_inbox",
          { count: emailCount, unreadOnly: onlyUnread },
          result
        );

        return result;
      }

      // Check if check_email capability is enabled
      if (!credentials.capabilities?.check_email) {
        const result = {
          success: false,
          message: "Check email capability is not enabled for this integration. Please enable it in Settings > Channels.",
          emails: [] as EmailMessage[],
        };

        await logToolAction(
          agentId,
          "checkEmail",
          "check_inbox",
          { count: emailCount, unreadOnly: onlyUnread },
          result
        );

        return result;
      }

      try {
        // Zapier MCP expects natural language instructions
        const instruction = onlyUnread 
          ? `Find my ${emailCount} most recent unread emails`
          : `Find my ${emailCount} most recent emails`;

        // Call Zapier MCP using proper MCP protocol with instructions parameter
        const response = await callZapierMCPTool(credentials, "gmail_find_email", {
          instructions: instruction,
        });

        if (!response.success) {
          throw new Error(response.error || "Failed to check emails");
        }

        const result = {
          success: true,
          message: `Email check completed`,
          emails: response.result,
          emailCount: Array.isArray(response.result) ? response.result.length : 0,
        };

        // Log the action
        await logToolAction(
          agentId,
          "checkEmail",
          "check_inbox",
          { count: emailCount, unreadOnly: onlyUnread },
          { success: result.success, emailCount: result.emailCount }
        );

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to check emails: ${errorMessage}`,
          emails: [] as EmailMessage[],
          error: errorMessage,
        };

        // Log the error
        await logToolAction(
          agentId,
          "checkEmail",
          "check_inbox_error",
          { count: emailCount, unreadOnly: onlyUnread },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

/**
 * Create the sendEmail tool with agentId captured in closure
 */
export function createSendEmailTool(agentId: string) {
  return tool({
    description:
      "Send an email from YOUR (the AI assistant's) email account. This is NOT the user's email - it's your own email address. Use this when the user asks you to send an email, follow up with someone, or reach out to a contact on their behalf. IMPORTANT: Write the email body in HTML format using <p> tags for paragraphs, <br> for line breaks, <strong> for bold, <ul>/<li> for lists, etc. Your HTML email signature will be automatically appended. Do NOT add a sign-off or your name at the end - the signature handles that automatically.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body in HTML format. Use <p> tags for paragraphs, <br> for line breaks within paragraphs, <strong> for bold, <em> for italic, <ul>/<ol> with <li> for lists. Example: '<p>Hi John,</p><p>I wanted to follow up on our conversation.</p><p>Best regards</p>'. Do NOT include a sign-off or name - your HTML signature is automatically appended."),
      cc: z.string().optional().describe("CC recipient email address (optional)"),
      bcc: z.string().optional().describe("BCC recipient email address (optional)"),
      signature: z.boolean().optional().default(true).describe("Include email signature (default: true)"),
      replyTo: z.string().optional().describe("Reply-To header for the email (optional, use when responding to an incoming email)"),
      inReplyTo: z.string().optional().describe("In-Reply-To message ID for email threading (optional, use the message_id from the original email)"),
    }),
    execute: async ({ to, subject, body, cc, bcc, signature, replyTo, inReplyTo }: { 
      to: string; 
      subject: string; 
      body: string; 
      cc?: string; 
      bcc?: string; 
      signature?: boolean;
      replyTo?: string;
      inReplyTo?: string;
    }) => {
      const includeSignature = signature ?? true;
      
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getEmailCredentials(agentId);

      // Check if email integration is configured
      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching email configuration: ${credError}`
            : !credentials 
              ? "Email integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Email integration is disabled. Please enable it in Settings > Channels.",
          emailDetails: {
            to,
            subject,
            bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
          },
        };

        await logToolAction(
          agentId,
          "sendEmail",
          "send_email",
          { to, subject, bodyLength: body.length },
          result
        );

        return result;
      }

      // Check if send_email capability is enabled
      if (!credentials.capabilities?.send_email) {
        const result = {
          success: false,
          message: "Send email capability is not enabled for this integration. Please enable it in Settings > Channels.",
          emailDetails: {
            to,
            subject,
            bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
          },
        };

        await logToolAction(
          agentId,
          "sendEmail",
          "send_email",
          { to, subject, bodyLength: body.length },
          result
        );

        return result;
      }

      try {
        // Convert plain text line breaks to HTML for proper email formatting
        // This ensures paragraph breaks are preserved in the recipient's email client
        const formatBodyAsHtml = (text: string): string => {
          // If body already contains HTML tags, assume it's already formatted
          if (/<[a-z][\s\S]*>/i.test(text)) {
            return text;
          }
          // Convert double line breaks to paragraph breaks, single to <br>
          return text
            .split(/\n\n+/)
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
        };

        // Build the full email body with signature if configured
        let fullBody = formatBodyAsHtml(body);
        
        // Append the custom HTML signature if enabled and configured
        if (includeSignature && credentials.email_signature) {
          // Add spacing before the signature
          fullBody = `${fullBody}<br><br><br>${credentials.email_signature}`;
        }

        // Zapier MCP expects natural language instructions for the main content
        // Explicitly mention this is HTML content so Zapier MCP sets Body_Type correctly
        let instruction = `Send an HTML email to ${to} with subject "${subject}" and the following HTML body (use the body exactly as provided, it is already formatted as HTML and includes the signature): "${fullBody}"`;
        
        if (cc) {
          instruction += ` CC: ${cc}`;
        }
        if (bcc) {
          instruction += ` BCC: ${bcc}`;
        }
        if (replyTo) {
          instruction += ` Reply-To: ${replyTo}`;
        }
        if (inReplyTo) {
          instruction += ` This is a reply to message ID: ${inReplyTo}`;
        }

        // Build the arguments - instructions is required
        // We include the signature in the body directly, so don't use Gmail's built-in signature
        // Body_Type must be set to "html" to preserve HTML formatting
        const args: Record<string, string | boolean> = {
          instructions: instruction,
          // Disable Gmail's built-in signature since we're including our own
          Signature: false,
          // Explicitly set body type to HTML to preserve formatting
          Body_Type: "html",
        };

        // Call Zapier MCP using proper MCP protocol
        const response = await callZapierMCPTool(credentials, "gmail_send_email", args);

        if (!response.success) {
          throw new Error(response.error || "Failed to send email");
        }

        const result = {
          success: true,
          message: `Email sent successfully to ${to}`,
          result: response.result,
          emailDetails: {
            to,
            subject,
            bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
            cc,
            bcc,
            isReply: !!inReplyTo,
          },
        };

        // Log the action
        await logToolAction(
          agentId,
          "sendEmail",
          "send_email",
          { to, subject, bodyLength: body.length, hasCc: !!cc, hasBcc: !!bcc, hasReplyTo: !!replyTo, hasInReplyTo: !!inReplyTo },
          { success: result.success }
        );

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to send email: ${errorMessage}`,
          emailDetails: {
            to,
            subject,
            bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
          },
          error: errorMessage,
        };

        // Log the error
        await logToolAction(
          agentId,
          "sendEmail",
          "send_email_error",
          { to, subject, bodyLength: body.length, hasReplyTo: !!replyTo, hasInReplyTo: !!inReplyTo },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

/**
 * Create the forwardEmailToUser tool with agentId captured in closure
 * Used when the agent receives an incoming email but is uncertain how to respond
 */
export function createForwardEmailToUserTool(agentId: string, userEmail: string) {
  return tool({
    description:
      "Forward an incoming email to your user when you're uncertain how to respond, need their input, or the email requires their personal attention. Include a brief note in HTML format explaining why you're forwarding it.",
    inputSchema: z.object({
      originalFrom: z.string().describe("The original sender's email address"),
      originalSubject: z.string().describe("The original email subject"),
      originalBody: z.string().describe("The original email body content"),
      originalDate: z.string().optional().describe("The original email date"),
      agentNote: z.string().describe("Your note to the user in HTML format explaining why you're forwarding this email. Use <p> for paragraphs, <strong> for emphasis. Example: '<p>I received this email but need your input on how to respond.</p>'"),
    }),
    execute: async ({ originalFrom, originalSubject, originalBody, originalDate, agentNote }: {
      originalFrom: string;
      originalSubject: string;
      originalBody: string;
      originalDate?: string;
      agentNote: string;
    }) => {
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getEmailCredentials(agentId);

      // Check if email integration is configured
      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching email configuration: ${credError}`
            : !credentials 
              ? "Email integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Email integration is disabled. Please enable it in Settings > Channels.",
        };

        await logToolAction(
          agentId,
          "forwardEmailToUser",
          "forward_email",
          { originalFrom, originalSubject },
          result
        );

        return result;
      }

      // Check if send_email capability is enabled
      if (!credentials.capabilities?.send_email) {
        const result = {
          success: false,
          message: "Send email capability is not enabled for this integration. Please enable it in Settings > Channels.",
        };

        await logToolAction(
          agentId,
          "forwardEmailToUser",
          "forward_email",
          { originalFrom, originalSubject },
          result
        );

        return result;
      }

      try {
        // Build the forwarded email body with HTML formatting
        const forwardedSubject = `Fwd: ${originalSubject}`;
        
        // Format the original body - convert line breaks to HTML if it's plain text
        const formatAsHtml = (text: string): string => {
          if (/<[a-z][\s\S]*>/i.test(text)) {
            return text;
          }
          return text
            .split(/\n\n+/)
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
        };

        const forwardedBody = `
<p>${formatAsHtml(agentNote)}</p>
<hr>
<p><strong>Forwarded Email</strong><br>
<strong>From:</strong> ${originalFrom}<br>
<strong>Date:</strong> ${originalDate || "Unknown"}<br>
<strong>Subject:</strong> ${originalSubject}</p>
${formatAsHtml(originalBody)}`;

        // Append signature if configured
        let fullBody = forwardedBody;
        if (credentials.email_signature) {
          fullBody = `${forwardedBody}<br><br><br>${credentials.email_signature}`;
        }

        // Build the instruction for Zapier MCP - explicitly mention HTML formatting
        const instruction = `Send an HTML email to ${userEmail} with subject "${forwardedSubject}" and the following HTML body (use the body exactly as provided, it is already formatted as HTML): "${fullBody}"`;

        const args: Record<string, string | boolean> = {
          instructions: instruction,
          Signature: false,
          // Explicitly set body type to HTML to preserve formatting
          Body_Type: "html",
        };

        // Call Zapier MCP
        const response = await callZapierMCPTool(credentials, "gmail_send_email", args);

        if (!response.success) {
          throw new Error(response.error || "Failed to forward email");
        }

        const result = {
          success: true,
          message: `Email forwarded to your user at ${userEmail}`,
          forwardDetails: {
            to: userEmail,
            originalFrom,
            originalSubject,
            agentNotePreview: agentNote.substring(0, 100) + (agentNote.length > 100 ? "..." : ""),
          },
        };

        // Log the action
        await logToolAction(
          agentId,
          "forwardEmailToUser",
          "forward_email",
          { originalFrom, originalSubject, userEmail },
          { success: result.success }
        );

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to forward email: ${errorMessage}`,
          error: errorMessage,
        };

        // Log the error
        await logToolAction(
          agentId,
          "forwardEmailToUser",
          "forward_email_error",
          { originalFrom, originalSubject, userEmail },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

/**
 * Create the replyToEmail tool with agentId captured in closure
 * Uses Gmail's Reply to Email action for proper threading
 */
export function createReplyToEmailTool(agentId: string) {
  return tool({
    description:
      "Reply to an existing email thread. This maintains proper email threading so the reply appears in the same conversation. Use this instead of sendEmail when responding to an email you received. IMPORTANT: Write the reply body in HTML format using <p> tags for paragraphs, <br> for line breaks, <strong> for bold, etc. Your HTML signature will be automatically appended.",
    inputSchema: z.object({
      messageId: z.string().describe("The message ID of the email to reply to (from the original email's id or message_id field)"),
      body: z.string().describe("Reply body in HTML format. Use <p> tags for paragraphs, <br> for line breaks. Example: '<p>Thank you for your email.</p><p>I will look into this and get back to you.</p>'. Do NOT include a sign-off - your HTML signature is automatically appended."),
      replyAll: z.boolean().optional().default(false).describe("Reply to all recipients (default: false, reply only to sender)"),
    }),
    execute: async ({ messageId, body, replyAll }: { 
      messageId: string; 
      body: string; 
      replyAll?: boolean;
    }) => {
      const shouldReplyAll = replyAll ?? false;
      
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getEmailCredentials(agentId);

      // Check if email integration is configured
      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching email configuration: ${credError}`
            : !credentials 
              ? "Email integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Email integration is disabled. Please enable it in Settings > Channels.",
        };

        await logToolAction(agentId, "replyToEmail", "reply_email", { messageId }, result);
        return result;
      }

      // Check if send_email capability is enabled (reuse same capability)
      if (!credentials.capabilities?.send_email) {
        const result = {
          success: false,
          message: "Send email capability is not enabled for this integration. Please enable it in Settings > Channels.",
        };

        await logToolAction(agentId, "replyToEmail", "reply_email", { messageId }, result);
        return result;
      }

      try {
        // Convert plain text to HTML if needed
        const formatBodyAsHtml = (text: string): string => {
          if (/<[a-z][\s\S]*>/i.test(text)) {
            return text;
          }
          return text
            .split(/\n\n+/)
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
        };

        let fullBody = formatBodyAsHtml(body);
        
        // Append signature if configured
        if (credentials.email_signature) {
          fullBody = `${fullBody}<br><br><br>${credentials.email_signature}`;
        }

        const replyType = shouldReplyAll ? "reply all" : "reply";
        const instruction = `Send an HTML ${replyType} to the email with message ID "${messageId}" with the following HTML body (use exactly as provided): "${fullBody}"`;

        const args: Record<string, string | boolean> = {
          instructions: instruction,
          Signature: false,
          Body_Type: "html",
        };

        const response = await callZapierMCPTool(credentials, "gmail_reply_to_email", args);

        if (!response.success) {
          throw new Error(response.error || "Failed to reply to email");
        }

        const result = {
          success: true,
          message: `Reply sent successfully`,
          result: response.result,
          replyDetails: {
            messageId,
            replyAll: shouldReplyAll,
            bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
          },
        };

        await logToolAction(agentId, "replyToEmail", "reply_email", { messageId, replyAll: shouldReplyAll }, { success: true });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to reply to email: ${errorMessage}`,
          error: errorMessage,
        };

        await logToolAction(agentId, "replyToEmail", "reply_email_error", { messageId }, { success: false, error: errorMessage });
        return result;
      }
    },
  });
}

/**
 * Create the archiveEmail tool with agentId captured in closure
 * Archives an email to clean up the inbox after handling
 */
export function createArchiveEmailTool(agentId: string) {
  return tool({
    description:
      "Archive an email message to remove it from the inbox. Use this after you've handled an email to keep the inbox clean. The email can still be found in 'All Mail'.",
    inputSchema: z.object({
      messageId: z.string().describe("The message ID of the email to archive (from the email's id or message_id field)"),
    }),
    execute: async ({ messageId }: { messageId: string }) => {
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getEmailCredentials(agentId);

      // Check if email integration is configured
      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching email configuration: ${credError}`
            : !credentials 
              ? "Email integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Email integration is disabled. Please enable it in Settings > Channels.",
        };

        await logToolAction(agentId, "archiveEmail", "archive_email", { messageId }, result);
        return result;
      }

      // Check if check_email capability is enabled (reuse for inbox management)
      if (!credentials.capabilities?.check_email) {
        const result = {
          success: false,
          message: "Email management capability is not enabled for this integration. Please enable it in Settings > Channels.",
        };

        await logToolAction(agentId, "archiveEmail", "archive_email", { messageId }, result);
        return result;
      }

      try {
        const instruction = `Archive the email with message ID "${messageId}"`;

        const args: Record<string, string> = {
          instructions: instruction,
        };

        const response = await callZapierMCPTool(credentials, "gmail_archive_email", args);

        if (!response.success) {
          throw new Error(response.error || "Failed to archive email");
        }

        const result = {
          success: true,
          message: `Email archived successfully`,
          result: response.result,
        };

        await logToolAction(agentId, "archiveEmail", "archive_email", { messageId }, { success: true });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to archive email: ${errorMessage}`,
          error: errorMessage,
        };

        await logToolAction(agentId, "archiveEmail", "archive_email_error", { messageId }, { success: false, error: errorMessage });
        return result;
      }
    },
  });
}

/**
 * Create the createEmailDraft tool with agentId captured in closure
 * Creates a draft email for review before sending
 */
export function createEmailDraftTool(agentId: string) {
  return tool({
    description:
      "Create a draft email that the user can review before sending. Use this for sensitive emails, important communications, or when the user should review the content first. IMPORTANT: Write the draft body in HTML format using <p> tags for paragraphs, <br> for line breaks, <strong> for bold, etc. Your HTML signature will be automatically appended.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Draft body in HTML format. Use <p> tags for paragraphs, <br> for line breaks. Example: '<p>Dear Client,</p><p>I wanted to discuss...</p>'. Do NOT include a sign-off - your HTML signature is automatically appended."),
      cc: z.string().optional().describe("CC recipient email address (optional)"),
      bcc: z.string().optional().describe("BCC recipient email address (optional)"),
    }),
    execute: async ({ to, subject, body, cc, bcc }: { 
      to: string; 
      subject: string; 
      body: string; 
      cc?: string; 
      bcc?: string;
    }) => {
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getEmailCredentials(agentId);

      // Check if email integration is configured
      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching email configuration: ${credError}`
            : !credentials 
              ? "Email integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Email integration is disabled. Please enable it in Settings > Channels.",
        };

        await logToolAction(agentId, "createEmailDraft", "create_draft", { to, subject }, result);
        return result;
      }

      // Check if send_email capability is enabled
      if (!credentials.capabilities?.send_email) {
        const result = {
          success: false,
          message: "Send email capability is not enabled for this integration. Please enable it in Settings > Channels.",
        };

        await logToolAction(agentId, "createEmailDraft", "create_draft", { to, subject }, result);
        return result;
      }

      try {
        // Convert plain text to HTML if needed
        const formatBodyAsHtml = (text: string): string => {
          if (/<[a-z][\s\S]*>/i.test(text)) {
            return text;
          }
          return text
            .split(/\n\n+/)
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
        };

        let fullBody = formatBodyAsHtml(body);
        
        // Append signature if configured
        if (credentials.email_signature) {
          fullBody = `${fullBody}<br><br><br>${credentials.email_signature}`;
        }

        let instruction = `Create a draft HTML email to ${to} with subject "${subject}" and the following HTML body (use exactly as provided): "${fullBody}"`;
        
        if (cc) {
          instruction += ` CC: ${cc}`;
        }
        if (bcc) {
          instruction += ` BCC: ${bcc}`;
        }

        const args: Record<string, string | boolean> = {
          instructions: instruction,
          Signature: false,
          Body_Type: "html",
        };

        const response = await callZapierMCPTool(credentials, "gmail_create_draft", args);

        if (!response.success) {
          throw new Error(response.error || "Failed to create email draft");
        }

        const result = {
          success: true,
          message: `Draft created successfully. The user can review and send it from their Gmail drafts folder.`,
          result: response.result,
          draftDetails: {
            to,
            subject,
            bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
            cc,
            bcc,
          },
        };

        await logToolAction(agentId, "createEmailDraft", "create_draft", { to, subject }, { success: true });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to create email draft: ${errorMessage}`,
          error: errorMessage,
        };

        await logToolAction(agentId, "createEmailDraft", "create_draft_error", { to, subject }, { success: false, error: errorMessage });
        return result;
      }
    },
  });
}

// Type helpers for UI components
export type CheckEmailTool = ReturnType<typeof createCheckEmailTool>;
export type SendEmailTool = ReturnType<typeof createSendEmailTool>;
export type ForwardEmailToUserTool = ReturnType<typeof createForwardEmailToUserTool>;
export type ReplyToEmailTool = ReturnType<typeof createReplyToEmailTool>;
export type ArchiveEmailTool = ReturnType<typeof createArchiveEmailTool>;
export type CreateEmailDraftTool = ReturnType<typeof createEmailDraftTool>;
export type CheckEmailToolInvocation = UIToolInvocation<CheckEmailTool>;
export type SendEmailToolInvocation = UIToolInvocation<SendEmailTool>;
export type ForwardEmailToUserToolInvocation = UIToolInvocation<ForwardEmailToUserTool>;
export type ReplyToEmailToolInvocation = UIToolInvocation<ReplyToEmailTool>;
export type ArchiveEmailToolInvocation = UIToolInvocation<ArchiveEmailTool>;
export type CreateEmailDraftToolInvocation = UIToolInvocation<CreateEmailDraftTool>;
