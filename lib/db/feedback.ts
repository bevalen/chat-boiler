import { SupabaseClient } from "@supabase/supabase-js";
import {
  Database,
  FeedbackType,
  FeedbackStatus,
  FeedbackSource,
  FeedbackPriority,
  Json,
} from "@/lib/types/database";

type FeedbackRow = Database["public"]["Tables"]["feedback_items"]["Row"];
type FeedbackInsert = Database["public"]["Tables"]["feedback_items"]["Insert"];
type FeedbackUpdate = Database["public"]["Tables"]["feedback_items"]["Update"];

export interface FeedbackItem {
  id: string;
  agentId: string;
  type: FeedbackType;
  title: string;
  description: string | null;
  problem: string | null;
  proposedSolution: string | null;
  context: Record<string, unknown> | null;
  priority: FeedbackPriority | null;
  status: FeedbackStatus | null;
  source: FeedbackSource | null;
  conversationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function mapFeedbackRow(row: FeedbackRow): FeedbackItem {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type,
    title: row.title,
    description: row.description,
    problem: row.problem,
    proposedSolution: row.proposed_solution,
    context: row.context as Record<string, unknown> | null,
    priority: row.priority,
    status: row.status,
    source: row.source,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new feedback item (feature request or bug report)
 */
export async function createFeedback(
  supabase: SupabaseClient,
  agentId: string,
  input: {
    type: FeedbackType;
    title: string;
    description?: string;
    problem?: string;
    proposedSolution?: string;
    context?: Record<string, unknown>;
    priority?: FeedbackPriority;
    source?: FeedbackSource;
    conversationId?: string;
  }
): Promise<{ feedback: FeedbackItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from("feedback_items")
    .insert({
      agent_id: agentId,
      type: input.type,
      title: input.title,
      description: input.description || null,
      problem: input.problem || null,
      proposed_solution: input.proposedSolution || null,
      context: (input.context as Json) || null,
      priority: input.priority || "medium",
      status: "new",
      source: input.source || "manual",
      conversation_id: input.conversationId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating feedback:", error);
    return { feedback: null, error: error.message };
  }

  return { feedback: mapFeedbackRow(data), error: null };
}

/**
 * Get feedback items for an agent
 */
export async function getFeedbackItems(
  supabase: SupabaseClient,
  agentId: string,
  options: {
    type?: FeedbackType;
    status?: FeedbackStatus | FeedbackStatus[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ items: FeedbackItem[]; error: string | null }> {
  const { type, status, limit = 50, offset = 0 } = options;

  let query = supabase
    .from("feedback_items")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq("type", type);
  }

  if (status) {
    if (Array.isArray(status)) {
      query = query.in("status", status);
    } else {
      query = query.eq("status", status);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching feedback items:", error);
    return { items: [], error: error.message };
  }

  return {
    items: (data || []).map(mapFeedbackRow),
    error: null,
  };
}

/**
 * Get a single feedback item by ID
 */
export async function getFeedbackById(
  supabase: SupabaseClient,
  feedbackId: string
): Promise<{ feedback: FeedbackItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from("feedback_items")
    .select("*")
    .eq("id", feedbackId)
    .single();

  if (error) {
    console.error("Error fetching feedback:", error);
    return { feedback: null, error: error.message };
  }

  return { feedback: mapFeedbackRow(data), error: null };
}

/**
 * Update a feedback item
 */
export async function updateFeedback(
  supabase: SupabaseClient,
  feedbackId: string,
  updates: {
    title?: string;
    description?: string;
    problem?: string;
    proposedSolution?: string;
    context?: Record<string, unknown>;
    priority?: FeedbackPriority;
    status?: FeedbackStatus;
  }
): Promise<{ feedback: FeedbackItem | null; error: string | null }> {
  const dbUpdates: FeedbackUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.problem !== undefined) dbUpdates.problem = updates.problem;
  if (updates.proposedSolution !== undefined) dbUpdates.proposed_solution = updates.proposedSolution;
  if (updates.context !== undefined) dbUpdates.context = updates.context as Json;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.status !== undefined) dbUpdates.status = updates.status;

  const { data, error } = await supabase
    .from("feedback_items")
    .update(dbUpdates)
    .eq("id", feedbackId)
    .select()
    .single();

  if (error) {
    console.error("Error updating feedback:", error);
    return { feedback: null, error: error.message };
  }

  return { feedback: mapFeedbackRow(data), error: null };
}

/**
 * Delete a feedback item
 */
export async function deleteFeedback(
  supabase: SupabaseClient,
  feedbackId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("feedback_items")
    .delete()
    .eq("id", feedbackId);

  if (error) {
    console.error("Error deleting feedback:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Check for duplicate bug reports to prevent spam from automatic submissions
 * Returns true if a similar bug report exists within the time window
 */
export async function checkDuplicateBugReport(
  supabase: SupabaseClient,
  agentId: string,
  toolName: string,
  errorMessage: string,
  windowHours: number = 1
): Promise<{ isDuplicate: boolean; error: string | null }> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - windowHours);

  const { data, error } = await supabase
    .from("feedback_items")
    .select("id, context")
    .eq("agent_id", agentId)
    .eq("type", "bug_report")
    .eq("source", "agent_error")
    .gte("created_at", cutoffTime.toISOString())
    .limit(10);

  if (error) {
    console.error("Error checking for duplicate bug reports:", error);
    return { isDuplicate: false, error: error.message };
  }

  // Check if any existing report has the same tool and similar error
  const isDuplicate = (data || []).some((item) => {
    const ctx = item.context as Record<string, unknown> | null;
    if (!ctx) return false;
    return ctx.tool_name === toolName && ctx.error_message === errorMessage;
  });

  return { isDuplicate, error: null };
}

/**
 * Get count of automatic bug reports in the last hour for rate limiting
 */
export async function getAutomaticBugReportCount(
  supabase: SupabaseClient,
  agentId: string,
  windowHours: number = 1
): Promise<{ count: number; error: string | null }> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - windowHours);

  const { count, error } = await supabase
    .from("feedback_items")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("type", "bug_report")
    .eq("source", "agent_error")
    .gte("created_at", cutoffTime.toISOString());

  if (error) {
    console.error("Error getting automatic bug report count:", error);
    return { count: 0, error: error.message };
  }

  return { count: count || 0, error: null };
}

/**
 * Create an automatic bug report from a tool error
 * Includes deduplication and rate limiting
 */
export async function createAutomaticBugReport(
  supabase: SupabaseClient,
  agentId: string,
  input: {
    toolName: string;
    toolInput: Record<string, unknown>;
    errorMessage: string;
    conversationId?: string;
  }
): Promise<{ feedback: FeedbackItem | null; error: string | null; skipped?: boolean }> {
  // Check rate limit (max 5 per hour)
  const { count: recentCount } = await getAutomaticBugReportCount(supabase, agentId);
  if (recentCount >= 5) {
    console.log("Rate limit reached for automatic bug reports");
    return { feedback: null, error: null, skipped: true };
  }

  // Check for duplicates
  const { isDuplicate } = await checkDuplicateBugReport(
    supabase,
    agentId,
    input.toolName,
    input.errorMessage
  );
  if (isDuplicate) {
    console.log("Duplicate bug report detected, skipping");
    return { feedback: null, error: null, skipped: true };
  }

  // Create the bug report
  return createFeedback(supabase, agentId, {
    type: "bug_report",
    title: `Tool error: ${input.toolName}`,
    problem: input.errorMessage,
    context: {
      tool_name: input.toolName,
      tool_input: input.toolInput,
      error_message: input.errorMessage,
      automatic: true,
    },
    priority: "high",
    source: "agent_error",
    conversationId: input.conversationId,
  });
}

/**
 * Search feedback items using PostgreSQL full-text search
 */
export async function searchFeedback(
  supabase: SupabaseClient,
  agentId: string,
  query: string,
  options: {
    type?: FeedbackType;
    status?: FeedbackStatus | FeedbackStatus[];
    limit?: number;
  } = {}
): Promise<{ items: FeedbackItem[]; error: string | null }> {
  const { type, status, limit = 20 } = options;

  // Build a text search query using PostgreSQL ILIKE for flexible matching
  // Search across title, problem, description, and proposed_solution
  let dbQuery = supabase
    .from("feedback_items")
    .select("*")
    .eq("agent_id", agentId)
    .or(`title.ilike.%${query}%,problem.ilike.%${query}%,description.ilike.%${query}%,proposed_solution.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) {
    dbQuery = dbQuery.eq("type", type);
  }

  if (status) {
    if (Array.isArray(status)) {
      dbQuery = dbQuery.in("status", status);
    } else {
      dbQuery = dbQuery.eq("status", status);
    }
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error("Error searching feedback:", error);
    return { items: [], error: error.message };
  }

  return {
    items: (data || []).map(mapFeedbackRow),
    error: null,
  };
}

/**
 * Get feedback items grouped by status for kanban view
 */
export async function getFeedbackByStatus(
  supabase: SupabaseClient,
  agentId: string,
  type?: FeedbackType
): Promise<{ byStatus: Record<FeedbackStatus, FeedbackItem[]>; error: string | null }> {
  let query = supabase
    .from("feedback_items")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching feedback by status:", error);
    return {
      byStatus: {
        new: [],
        under_review: [],
        planned: [],
        in_progress: [],
        done: [],
        wont_fix: [],
      },
      error: error.message,
    };
  }

  const byStatus: Record<FeedbackStatus, FeedbackItem[]> = {
    new: [],
    under_review: [],
    planned: [],
    in_progress: [],
    done: [],
    wont_fix: [],
  };

  for (const row of data || []) {
    const item = mapFeedbackRow(row);
    const status = item.status || "new";
    byStatus[status].push(item);
  }

  return { byStatus, error: null };
}
