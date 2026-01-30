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
        // Call Zapier MCP using proper MCP protocol
        const response = await callZapierMCPTool(credentials, "find_email", {
          Search_String: onlyUnread ? "is:unread" : "",
          Max_Results: String(emailCount),
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
      "Send an email from YOUR (the AI assistant's) email account. This is NOT the user's email - it's your own email address. Use this when the user asks you to send an email, follow up with someone, or reach out to a contact on their behalf. IMPORTANT: Always set signature=true to include your email signature. Do NOT add a sign-off or your name at the end of the email body - the signature handles that automatically.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body content (plain text or markdown). Do NOT include a sign-off or name at the end - the signature handles this."),
      cc: z.string().optional().describe("CC recipient email address (optional)"),
      bcc: z.string().optional().describe("BCC recipient email address (optional)"),
      signature: z.boolean().optional().default(true).describe("Include email signature (always set to true)"),
    }),
    execute: async ({ to, subject, body, cc, bcc, signature }: { 
      to: string; 
      subject: string; 
      body: string; 
      cc?: string; 
      bcc?: string; 
      signature?: boolean;
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
        // Build the email arguments for Zapier MCP Gmail tool
        // Zapier Gmail tools typically use these field names
        const emailArgs: Record<string, string> = {
          To: to,
          Subject: subject,
          Body: body,
          Signature: includeSignature ? "true" : "false",
        };

        if (cc) {
          emailArgs.Cc = cc;
        }
        if (bcc) {
          emailArgs.Bcc = bcc;
        }

        // Call Zapier MCP using proper MCP protocol
        const response = await callZapierMCPTool(credentials, "send_email", emailArgs);

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
          },
        };

        // Log the action
        await logToolAction(
          agentId,
          "sendEmail",
          "send_email",
          { to, subject, bodyLength: body.length, hasCc: !!cc, hasBcc: !!bcc },
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
          { to, subject, bodyLength: body.length },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

// Type helpers for UI components
export type CheckEmailTool = ReturnType<typeof createCheckEmailTool>;
export type SendEmailTool = ReturnType<typeof createSendEmailTool>;
export type CheckEmailToolInvocation = UIToolInvocation<CheckEmailTool>;
export type SendEmailToolInvocation = UIToolInvocation<SendEmailTool>;
