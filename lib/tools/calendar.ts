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

export const checkCalendarTool = tool({
  description:
    "Check the user's calendar for events. Can retrieve events for today, tomorrow, or a specific date range.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Specific date to check (ISO format: YYYY-MM-DD). If not provided, defaults to today."
      ),
    days: z
      .number()
      .optional()
      .describe("Number of days to look ahead (default: 1)"),
  }),
  execute: async ({ date, days = 1 }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    // TODO: Implement actual Zapier MCP integration
    // For now, return a placeholder response
    const targetDate = date || new Date().toISOString().split("T")[0];

    const result = {
      success: true,
      message:
        "Calendar integration not yet configured. Please set up the Zapier MCP endpoint.",
      date: targetDate,
      daysChecked: days,
      events: [] as Array<{
        title: string;
        startTime: string;
        endTime: string;
        location?: string;
        description?: string;
      }>,
    };

    // Log the action
    await logToolAction(
      agentId as string,
      "checkCalendar",
      "check_events",
      { date: targetDate, days },
      result
    );

    return result;
  },
});

// Export types for UI components
export type CheckCalendarToolInvocation = UIToolInvocation<
  typeof checkCalendarTool
>;
