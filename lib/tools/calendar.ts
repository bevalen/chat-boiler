import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { getZapierMCPCredentialsByAgent } from "@/lib/db/channel-credentials";
import { ZapierMCPCredentials } from "@/lib/types/database";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

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
 * Get calendar credentials for an agent
 */
async function getCalendarCredentials(agentId: string): Promise<{
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
      name: "maia-calendar-client",
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
    console.log("[calendar] Available MCP tools:", toolsList.tools.map((t: { name: string }) => t.name));

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
        `google_calendar_${toolName}`,
        `google-calendar-${toolName}`,
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

    console.log(`[calendar] Calling MCP tool: ${actualToolName} with args:`, args);

    // Call the tool
    const result = await client.callTool({
      name: actualToolName,
      arguments: args,
    });

    console.log("[calendar] MCP tool result:", result);

    // Close the connection
    await client.close();
    client = null;

    return {
      success: true,
      result: result.structuredContent || result.content,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[calendar] MCP tool error:", errorMessage);
    
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
 * Create the checkCalendar tool with agentId captured in closure
 */
export function createCheckCalendarTool(agentId: string) {
  return tool({
    description:
      "Check the user's calendar for events. Can retrieve events for today, tomorrow, or a specific date range. Use this to see what's on the schedule before suggesting meeting times.",
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
        .default(1)
        .describe("Number of days to look ahead (default: 1)"),
    }),
    execute: async ({ date, days }: { date?: string; days?: number }) => {
      const daysToCheck = days ?? 1;
      const targetDate = date || new Date().toISOString().split("T")[0];
      
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getCalendarCredentials(agentId);

      // Check if calendar integration is configured
      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching calendar configuration: ${credError}`
            : !credentials 
              ? "Calendar integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Calendar integration is disabled. Please enable it in Settings > Channels.",
          date: targetDate,
          daysChecked: daysToCheck,
          events: [],
        };

        await logToolAction(agentId, "checkCalendar", "check_events", { date: targetDate, days: daysToCheck }, result);
        return result;
      }

      // Check if check_calendar capability is enabled
      if (!credentials.capabilities?.check_calendar) {
        const result = {
          success: false,
          message: "Calendar capability is not enabled for this integration. Please enable it in Settings > Channels.",
          date: targetDate,
          daysChecked: daysToCheck,
          events: [],
        };

        await logToolAction(agentId, "checkCalendar", "check_events", { date: targetDate, days: daysToCheck }, result);
        return result;
      }

      try {
        // Calculate date range
        const startDate = new Date(targetDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + daysToCheck);

        const instruction = `Find all calendar events between ${startDate.toISOString().split("T")[0]} and ${endDate.toISOString().split("T")[0]}`;

        const response = await callZapierMCPTool(credentials, "google_calendar_find_event", {
          instructions: instruction,
        });

        if (!response.success) {
          throw new Error(response.error || "Failed to check calendar");
        }

        const result = {
          success: true,
          message: "Calendar events retrieved",
          date: targetDate,
          daysChecked: daysToCheck,
          events: response.result,
        };

        await logToolAction(agentId, "checkCalendar", "check_events", { date: targetDate, days: daysToCheck }, { success: true });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to check calendar: ${errorMessage}`,
          date: targetDate,
          daysChecked: daysToCheck,
          events: [],
          error: errorMessage,
        };

        await logToolAction(agentId, "checkCalendar", "check_events_error", { date: targetDate, days: daysToCheck }, { success: false, error: errorMessage });
        return result;
      }
    },
  });
}

/**
 * Create the checkAvailability tool for finding free time slots
 */
export function createCheckAvailabilityTool(agentId: string) {
  return tool({
    description:
      "Check calendar availability to find free time slots for booking meetings. Returns available slots for the next several days. Use this before proposing meeting times to ensure the times are actually available.",
    inputSchema: z.object({
      daysAhead: z
        .number()
        .optional()
        .default(7)
        .describe("Number of days to look ahead for availability (default: 7)"),
      duration: z
        .number()
        .optional()
        .default(30)
        .describe("Meeting duration in minutes (default: 30)"),
      preferredTimes: z
        .array(z.string())
        .optional()
        .describe("Preferred time ranges like '10am-12pm', '2pm-5pm'. If not provided, uses business hours."),
    }),
    execute: async ({ daysAhead, duration, preferredTimes }: { 
      daysAhead?: number; 
      duration?: number; 
      preferredTimes?: string[];
    }) => {
      const days = daysAhead ?? 7;
      const meetingDuration = duration ?? 30;
      
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getCalendarCredentials(agentId);

      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching calendar configuration: ${credError}`
            : !credentials 
              ? "Calendar integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Calendar integration is disabled. Please enable it in Settings > Channels.",
          availableSlots: [],
        };

        await logToolAction(agentId, "checkAvailability", "find_free_time", { daysAhead: days, duration: meetingDuration }, result);
        return result;
      }

      if (!credentials.capabilities?.check_calendar) {
        const result = {
          success: false,
          message: "Calendar capability is not enabled for this integration.",
          availableSlots: [],
        };

        await logToolAction(agentId, "checkAvailability", "find_free_time", { daysAhead: days, duration: meetingDuration }, result);
        return result;
      }

      try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        let instruction = `Find available time slots of at least ${meetingDuration} minutes between ${startDate.toISOString().split("T")[0]} and ${endDate.toISOString().split("T")[0]}`;
        
        if (preferredTimes && preferredTimes.length > 0) {
          instruction += `. Preferred times: ${preferredTimes.join(", ")}`;
        } else {
          instruction += `. Look for times during business hours (9am-5pm).`;
        }

        const response = await callZapierMCPTool(credentials, "google_calendar_find_free_time", {
          instructions: instruction,
        });

        if (!response.success) {
          throw new Error(response.error || "Failed to check availability");
        }

        const result = {
          success: true,
          message: "Available time slots found",
          daysChecked: days,
          duration: meetingDuration,
          availableSlots: response.result,
        };

        await logToolAction(agentId, "checkAvailability", "find_free_time", { daysAhead: days, duration: meetingDuration }, { success: true });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to check availability: ${errorMessage}`,
          availableSlots: [],
          error: errorMessage,
        };

        await logToolAction(agentId, "checkAvailability", "find_free_time_error", { daysAhead: days, duration: meetingDuration }, { success: false, error: errorMessage });
        return result;
      }
    },
  });
}

/**
 * Create the bookMeeting tool for creating calendar events
 */
export function createBookMeetingTool(agentId: string) {
  return tool({
    description:
      "Book a meeting on the calendar by creating a calendar event. Use this after confirming a meeting time with a prospect. Automatically adds a video conferencing link (Google Meet or Zoom) if enabled.",
    inputSchema: z.object({
      title: z.string().describe("Meeting title (e.g., 'Intro Call: [Their Company] ↔ [Your Company]')"),
      attendeeEmail: z.string().describe("Attendee email address for the calendar invite"),
      attendeeName: z.string().describe("Attendee name for personalization"),
      startTime: z.string().describe("Meeting start time in ISO format (e.g., '2025-01-31T14:00:00-05:00')"),
      duration: z
        .number()
        .optional()
        .default(30)
        .describe("Meeting duration in minutes (default: 30)"),
      description: z
        .string()
        .optional()
        .describe("Meeting description or agenda to include in the invite"),
      addVideoConference: z
        .boolean()
        .optional()
        .default(true)
        .describe("Add a video conferencing link (Google Meet) to the meeting (default: true)"),
    }),
    execute: async ({ title, attendeeEmail, attendeeName, startTime, duration, description, addVideoConference }: {
      title: string;
      attendeeEmail: string;
      attendeeName: string;
      startTime: string;
      duration?: number;
      description?: string;
      addVideoConference?: boolean;
    }) => {
      const meetingDuration = duration ?? 30;
      const includeVideo = addVideoConference ?? true;
      
      // Get credentials from database
      const { credentials, isActive, error: credError } = await getCalendarCredentials(agentId);

      if (credError || !credentials || !isActive) {
        const result = {
          success: false,
          message: credError 
            ? `Error fetching calendar configuration: ${credError}`
            : !credentials 
              ? "Calendar integration is not configured. Please set up Zapier MCP in Settings > Channels."
              : "Calendar integration is disabled. Please enable it in Settings > Channels.",
          meetingDetails: { title, attendeeEmail, startTime },
        };

        await logToolAction(agentId, "bookMeeting", "create_event", { title, attendeeEmail, startTime, duration: meetingDuration }, result);
        return result;
      }

      if (!credentials.capabilities?.check_calendar) {
        const result = {
          success: false,
          message: "Calendar capability is not enabled for this integration.",
          meetingDetails: { title, attendeeEmail, startTime },
        };

        await logToolAction(agentId, "bookMeeting", "create_event", { title, attendeeEmail, startTime, duration: meetingDuration }, result);
        return result;
      }

      try {
        // Calculate end time
        const start = new Date(startTime);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + meetingDuration);

        let instruction = `Create a calendar event titled "${title}" starting at ${start.toISOString()} and ending at ${end.toISOString()}. Add ${attendeeName} (${attendeeEmail}) as an attendee and send them an invite.`;
        
        if (description) {
          instruction += ` Description: ${description}`;
        }
        
        if (includeVideo) {
          instruction += ` Add a Google Meet video conferencing link to the meeting.`;
        }

        const response = await callZapierMCPTool(credentials, "google_calendar_create_event", {
          instructions: instruction,
        });

        if (!response.success) {
          throw new Error(response.error || "Failed to book meeting");
        }

        const result = {
          success: true,
          message: `Meeting booked successfully with ${attendeeName}. Calendar invite sent to ${attendeeEmail}.`,
          result: response.result,
          meetingDetails: {
            title,
            attendeeEmail,
            attendeeName,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            duration: meetingDuration,
            hasVideoConference: includeVideo,
          },
        };

        await logToolAction(agentId, "bookMeeting", "create_event", { title, attendeeEmail, startTime, duration: meetingDuration }, { success: true });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        
        const result = {
          success: false,
          message: `Failed to book meeting: ${errorMessage}`,
          meetingDetails: { title, attendeeEmail, startTime },
          error: errorMessage,
        };

        await logToolAction(agentId, "bookMeeting", "create_event_error", { title, attendeeEmail, startTime, duration: meetingDuration }, { success: false, error: errorMessage });
        return result;
      }
    },
  });
}

// Legacy export for backward compatibility
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
export type CheckCalendarTool = ReturnType<typeof createCheckCalendarTool>;
export type CheckAvailabilityTool = ReturnType<typeof createCheckAvailabilityTool>;
export type BookMeetingTool = ReturnType<typeof createBookMeetingTool>;
export type CheckCalendarToolInvocation = UIToolInvocation<typeof checkCalendarTool>;
export type CheckAvailabilityToolInvocation = UIToolInvocation<CheckAvailabilityTool>;
export type BookMeetingToolInvocation = UIToolInvocation<BookMeetingTool>;
