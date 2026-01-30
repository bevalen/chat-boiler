import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

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

export const checkEmailTool = tool({
  description:
    "Check the user's email inbox for recent messages. Returns a summary of unread emails.",
  inputSchema: z.object({
    count: z
      .number()
      .optional()
      .describe("Number of recent emails to retrieve (default: 10)"),
    unreadOnly: z
      .boolean()
      .optional()
      .describe("Only show unread emails (default: true)"),
  }),
  execute: async ({ count = 10, unreadOnly = true }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    // TODO: Implement actual Zapier MCP integration
    // For now, return a placeholder response
    const result = {
      success: true,
      message:
        "Email integration not yet configured. Please set up the Zapier MCP endpoint.",
      emails: [] as Array<{
        subject: string;
        from: string;
        date: string;
        snippet: string;
      }>,
    };

    // Log the action
    await logToolAction(
      agentId as string,
      "checkEmail",
      "check_inbox",
      { count, unreadOnly },
      result
    );

    return result;
  },
});

export const sendEmailTool = tool({
  description:
    "Send an email on behalf of the AI assistant (Milo). The email will be sent from the assistant's email address.",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content"),
  }),
  execute: async ({ to, subject, body }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    // TODO: Implement actual Zapier MCP integration
    // For now, return a placeholder response
    const result = {
      success: true,
      message:
        "Email integration not yet configured. Please set up the Zapier MCP endpoint.",
      emailDetails: {
        to,
        subject,
        bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
      },
    };

    // Log the action
    await logToolAction(
      agentId as string,
      "sendEmail",
      "send_email",
      { to, subject, bodyLength: body.length },
      result
    );

    return result;
  },
});

// Export types for UI components
export type CheckEmailToolInvocation = UIToolInvocation<typeof checkEmailTool>;
export type SendEmailToolInvocation = UIToolInvocation<typeof sendEmailTool>;
