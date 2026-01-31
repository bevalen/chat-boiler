import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

// Lead status types
export type LeadStatus = "new" | "qualified" | "meeting_booked" | "closed" | "disqualified";

// BANT score interface
export interface BANTScore {
  budget?: boolean;
  authority?: boolean;
  need?: boolean;
  timing?: boolean;
}

// LinkedIn lead interface
export interface LinkedInLead {
  id: string;
  agentId: string;
  linkedinProfileUrl: string;
  name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  status: LeadStatus;
  bantBudget: boolean | null;
  bantAuthority: boolean | null;
  bantNeed: boolean | null;
  bantTiming: boolean | null;
  notes: string | null;
  lastConversationId: string | null;
  meetingBookedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
 * Create the saveLinkedInLead tool for saving/updating lead information
 */
export function createSaveLinkedInLeadTool(agentId: string, conversationId?: string) {
  return tool({
    description:
      "Save or update a LinkedIn lead after a qualifying conversation. Use this to track leads, their qualification status, and BANT scores. The lead is automatically linked to the current conversation.",
    inputSchema: z.object({
      linkedinProfileUrl: z
        .string()
        .describe("LinkedIn profile URL of the lead (e.g., 'https://www.linkedin.com/in/username/')"),
      name: z.string().describe("Lead's full name"),
      company: z.string().optional().describe("Company name"),
      title: z.string().optional().describe("Job title"),
      email: z.string().optional().describe("Email address if obtained"),
      status: z
        .enum(["new", "qualified", "meeting_booked", "closed", "disqualified"])
        .describe("Lead status: new, qualified, meeting_booked, closed, or disqualified"),
      bantScore: z
        .object({
          budget: z.boolean().optional().describe("Has budget/resources for the solution"),
          authority: z.boolean().optional().describe("Is a decision-maker or has authority"),
          need: z.boolean().optional().describe("Has a genuine pain point you can solve"),
          timing: z.boolean().optional().describe("Timeline is within 1-3 months"),
        })
        .optional()
        .describe("BANT qualification scores"),
      notes: z.string().optional().describe("Notes about the lead, qualification details, or next steps"),
    }),
    execute: async ({
      linkedinProfileUrl,
      name,
      company,
      title,
      email,
      status,
      bantScore,
      notes,
    }: {
      linkedinProfileUrl: string;
      name: string;
      company?: string;
      title?: string;
      email?: string;
      status: LeadStatus;
      bantScore?: BANTScore;
      notes?: string;
    }) => {
      const supabase = getAdminClient();

      try {
        // Normalize the LinkedIn URL (remove query params, trailing slash variations)
        const normalizedUrl = linkedinProfileUrl.split("?")[0].replace(/\/$/, "");

        // Check if lead already exists
        const { data: existingLead } = await supabase
          .from("linkedin_leads")
          .select("id")
          .eq("agent_id", agentId)
          .eq("linkedin_profile_url", normalizedUrl)
          .single();

        const leadData = {
          agent_id: agentId,
          linkedin_profile_url: normalizedUrl,
          name,
          company: company || null,
          title: title || null,
          email: email || null,
          status,
          bant_budget: bantScore?.budget ?? null,
          bant_authority: bantScore?.authority ?? null,
          bant_need: bantScore?.need ?? null,
          bant_timing: bantScore?.timing ?? null,
          notes: notes || null,
          last_conversation_id: conversationId || null,
          updated_at: new Date().toISOString(),
          ...(status === "meeting_booked" && !existingLead
            ? { meeting_booked_at: new Date().toISOString() }
            : {}),
        };

        let result;
        if (existingLead) {
          // Update existing lead
          const { data, error } = await supabase
            .from("linkedin_leads")
            .update(leadData)
            .eq("id", existingLead.id)
            .select()
            .single();

          if (error) throw error;
          result = {
            success: true,
            message: `Lead "${name}" updated successfully`,
            action: "updated",
            lead: data,
          };
        } else {
          // Create new lead
          const { data, error } = await supabase
            .from("linkedin_leads")
            .insert({
              ...leadData,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) throw error;
          result = {
            success: true,
            message: `New lead "${name}" saved successfully`,
            action: "created",
            lead: data,
          };
        }

        await logToolAction(
          agentId,
          "saveLinkedInLead",
          existingLead ? "update_lead" : "create_lead",
          { linkedinProfileUrl: normalizedUrl, name, status },
          { success: true, leadId: result.lead?.id }
        );

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        const result = {
          success: false,
          message: `Failed to save lead: ${errorMessage}`,
          error: errorMessage,
        };

        await logToolAction(
          agentId,
          "saveLinkedInLead",
          "save_lead_error",
          { linkedinProfileUrl, name, status },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

/**
 * Create the getLinkedInLeadHistory tool for retrieving lead context
 */
export function createGetLinkedInLeadHistoryTool(agentId: string) {
  return tool({
    description:
      "Get history and context for a LinkedIn lead. Use this to check if you've interacted with someone before and understand their qualification status before responding to a new message.",
    inputSchema: z.object({
      linkedinProfileUrl: z
        .string()
        .describe("LinkedIn profile URL to look up"),
    }),
    execute: async ({ linkedinProfileUrl }: { linkedinProfileUrl: string }) => {
      const supabase = getAdminClient();

      try {
        // Normalize the LinkedIn URL
        const normalizedUrl = linkedinProfileUrl.split("?")[0].replace(/\/$/, "");

        // Fetch lead record
        const { data: lead, error } = await supabase
          .from("linkedin_leads")
          .select("*")
          .eq("agent_id", agentId)
          .eq("linkedin_profile_url", normalizedUrl)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (!lead) {
          const result = {
            success: true,
            found: false,
            message: "No previous record found for this LinkedIn profile. This appears to be a new lead.",
            lead: null,
          };

          await logToolAction(
            agentId,
            "getLinkedInLeadHistory",
            "lookup_lead",
            { linkedinProfileUrl: normalizedUrl },
            { success: true, found: false }
          );

          return result;
        }

        // Calculate BANT score
        const bantCount = [lead.bant_budget, lead.bant_authority, lead.bant_need, lead.bant_timing]
          .filter(Boolean).length;

        const result = {
          success: true,
          found: true,
          message: `Found existing lead: ${lead.name} from ${lead.company || "unknown company"}`,
          lead: {
            id: lead.id,
            name: lead.name,
            company: lead.company,
            title: lead.title,
            email: lead.email,
            status: lead.status,
            bantScore: {
              budget: lead.bant_budget,
              authority: lead.bant_authority,
              need: lead.bant_need,
              timing: lead.bant_timing,
              total: bantCount,
            },
            notes: lead.notes,
            meetingBookedAt: lead.meeting_booked_at,
            lastUpdated: lead.updated_at,
            createdAt: lead.created_at,
          },
          qualification: bantCount >= 3 ? "qualified" : bantCount >= 2 ? "potentially_qualified" : "needs_discovery",
        };

        await logToolAction(
          agentId,
          "getLinkedInLeadHistory",
          "lookup_lead",
          { linkedinProfileUrl: normalizedUrl },
          { success: true, found: true, status: lead.status }
        );

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        const result = {
          success: false,
          found: false,
          message: `Failed to look up lead: ${errorMessage}`,
          lead: null,
          error: errorMessage,
        };

        await logToolAction(
          agentId,
          "getLinkedInLeadHistory",
          "lookup_lead_error",
          { linkedinProfileUrl },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

/**
 * Create the updateLeadStatus tool for quick status updates
 */
export function createUpdateLeadStatusTool(agentId: string) {
  return tool({
    description:
      "Quickly update the status of an existing LinkedIn lead. Use this when the lead's situation changes (e.g., meeting booked, disqualified, closed).",
    inputSchema: z.object({
      linkedinProfileUrl: z
        .string()
        .describe("LinkedIn profile URL of the lead to update"),
      status: z
        .enum(["new", "qualified", "meeting_booked", "closed", "disqualified"])
        .describe("New status for the lead"),
      notes: z
        .string()
        .optional()
        .describe("Optional notes about the status change"),
    }),
    execute: async ({
      linkedinProfileUrl,
      status,
      notes,
    }: {
      linkedinProfileUrl: string;
      status: LeadStatus;
      notes?: string;
    }) => {
      const supabase = getAdminClient();

      try {
        // Normalize the LinkedIn URL
        const normalizedUrl = linkedinProfileUrl.split("?")[0].replace(/\/$/, "");

        // Update the lead
        const updateData: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        };

        if (notes) {
          // Append notes instead of replacing
          const { data: existingLead } = await supabase
            .from("linkedin_leads")
            .select("notes")
            .eq("agent_id", agentId)
            .eq("linkedin_profile_url", normalizedUrl)
            .single();

          const existingNotes = existingLead?.notes || "";
          const timestamp = new Date().toISOString().split("T")[0];
          updateData.notes = existingNotes
            ? `${existingNotes}\n\n[${timestamp}] ${notes}`
            : `[${timestamp}] ${notes}`;
        }

        if (status === "meeting_booked") {
          updateData.meeting_booked_at = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from("linkedin_leads")
          .update(updateData)
          .eq("agent_id", agentId)
          .eq("linkedin_profile_url", normalizedUrl)
          .select()
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            return {
              success: false,
              message: "Lead not found. Use saveLinkedInLead to create a new lead first.",
            };
          }
          throw error;
        }

        const result = {
          success: true,
          message: `Lead status updated to "${status}"`,
          lead: {
            id: data.id,
            name: data.name,
            status: data.status,
          },
        };

        await logToolAction(
          agentId,
          "updateLeadStatus",
          "update_status",
          { linkedinProfileUrl: normalizedUrl, status },
          { success: true }
        );

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        const result = {
          success: false,
          message: `Failed to update lead status: ${errorMessage}`,
          error: errorMessage,
        };

        await logToolAction(
          agentId,
          "updateLeadStatus",
          "update_status_error",
          { linkedinProfileUrl, status },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

/**
 * Create the listLinkedInLeads tool for viewing all leads
 */
export function createListLinkedInLeadsTool(agentId: string) {
  return tool({
    description:
      "List all LinkedIn leads with optional filtering by status. Use this to get an overview of your lead pipeline or find leads in a specific stage.",
    inputSchema: z.object({
      status: z
        .enum(["new", "qualified", "meeting_booked", "closed", "disqualified"])
        .optional()
        .describe("Filter by status (optional, returns all if not specified)"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of leads to return (default: 20)"),
    }),
    execute: async ({ status, limit }: { status?: LeadStatus; limit?: number }) => {
      const supabase = getAdminClient();
      const maxResults = limit ?? 20;

      try {
        let query = supabase
          .from("linkedin_leads")
          .select("*")
          .eq("agent_id", agentId)
          .order("updated_at", { ascending: false })
          .limit(maxResults);

        if (status) {
          query = query.eq("status", status);
        }

        const { data, error } = await query;

        if (error) throw error;

        const leads = (data || []).map((lead) => ({
          id: lead.id,
          name: lead.name,
          company: lead.company,
          title: lead.title,
          status: lead.status,
          bantScore: [lead.bant_budget, lead.bant_authority, lead.bant_need, lead.bant_timing]
            .filter(Boolean).length,
          linkedinUrl: lead.linkedin_profile_url,
          lastUpdated: lead.updated_at,
        }));

        // Calculate summary stats
        const statusCounts = (data || []).reduce((acc, lead) => {
          acc[lead.status] = (acc[lead.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const result = {
          success: true,
          message: `Found ${leads.length} lead(s)`,
          leads,
          totalCount: leads.length,
          statusSummary: statusCounts,
        };

        await logToolAction(
          agentId,
          "listLinkedInLeads",
          "list_leads",
          { status, limit: maxResults },
          { success: true, count: leads.length }
        );

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        const result = {
          success: false,
          message: `Failed to list leads: ${errorMessage}`,
          leads: [],
          error: errorMessage,
        };

        await logToolAction(
          agentId,
          "listLinkedInLeads",
          "list_leads_error",
          { status, limit: maxResults },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

// Export types for UI components
export type SaveLinkedInLeadTool = ReturnType<typeof createSaveLinkedInLeadTool>;
export type GetLinkedInLeadHistoryTool = ReturnType<typeof createGetLinkedInLeadHistoryTool>;
export type UpdateLeadStatusTool = ReturnType<typeof createUpdateLeadStatusTool>;
export type ListLinkedInLeadsTool = ReturnType<typeof createListLinkedInLeadsTool>;
export type SaveLinkedInLeadToolInvocation = UIToolInvocation<SaveLinkedInLeadTool>;
export type GetLinkedInLeadHistoryToolInvocation = UIToolInvocation<GetLinkedInLeadHistoryTool>;
export type UpdateLeadStatusToolInvocation = UIToolInvocation<UpdateLeadStatusTool>;
export type ListLinkedInLeadsToolInvocation = UIToolInvocation<ListLinkedInLeadsTool>;
