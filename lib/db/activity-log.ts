import { SupabaseClient } from "@supabase/supabase-js";

export type ActivityType =
  | "tool_call"
  | "cron_execution"
  | "email_sent"
  | "email_received"
  | "research"
  | "memory_saved"
  | "task_created"
  | "task_updated"
  | "project_created"
  | "project_updated"
  | "reminder_created"
  | "job_scheduled"
  | "notification_sent"
  | "slack_message"
  | "webhook_triggered"
  | "error"
  | "system";

export type ActivitySource =
  | "chat"
  | "cron"
  | "webhook"
  | "slack"
  | "email"
  | "system";

export type ActivityStatus = "started" | "completed" | "failed";

export interface ActivityLogEntry {
  id: string;
  agentId: string;
  activityType: ActivityType;
  source: ActivitySource;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  conversationId: string | null;
  taskId: string | null;
  projectId: string | null;
  jobId: string | null;
  status: ActivityStatus;
  durationMs: number | null;
  createdAt: string;
}

export interface LogActivityParams {
  agentId: string;
  activityType: ActivityType;
  source: ActivitySource;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  conversationId?: string;
  taskId?: string;
  projectId?: string;
  jobId?: string;
  status?: ActivityStatus;
  durationMs?: number;
}

/**
 * Log an activity entry
 */
export async function logActivity(
  supabase: SupabaseClient,
  params: LogActivityParams
): Promise<{ success: boolean; activityId?: string; error?: string }> {
  try {
    console.log(`[activity-log] Inserting: ${params.activityType} - ${params.title} (source: ${params.source})`);
    
    const { data, error } = await supabase
      .from("activity_log")
      .insert({
        agent_id: params.agentId,
        activity_type: params.activityType,
        source: params.source,
        title: params.title,
        description: params.description || null,
        metadata: params.metadata || {},
        conversation_id: params.conversationId || null,
        task_id: params.taskId || null,
        project_id: params.projectId || null,
        job_id: params.jobId || null,
        status: params.status || "completed",
        duration_ms: params.durationMs || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[activity-log] Error logging activity:", error);
      return { success: false, error: error.message };
    }

    console.log(`[activity-log] Successfully logged: ${params.title} (id: ${data.id})`);
    return { success: true, activityId: data.id };
  } catch (err) {
    console.error("[activity-log] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Log a tool call with timing
 */
export async function logToolCall(
  supabase: SupabaseClient,
  params: {
    agentId: string;
    source: ActivitySource;
    toolName: string;
    toolParams: Record<string, unknown>;
    result: unknown;
    success: boolean;
    durationMs: number;
    conversationId?: string;
    error?: string;
  }
): Promise<void> {
  await logActivity(supabase, {
    agentId: params.agentId,
    activityType: "tool_call",
    source: params.source,
    title: `Tool: ${params.toolName}`,
    description: params.error || (params.success ? "Completed successfully" : "Failed"),
    metadata: {
      tool: params.toolName,
      params: params.toolParams,
      result: params.result,
      success: params.success,
      error: params.error,
    },
    conversationId: params.conversationId,
    status: params.success ? "completed" : "failed",
    durationMs: params.durationMs,
  });
}

/**
 * Log a cron job execution
 */
export async function logCronExecution(
  supabase: SupabaseClient,
  params: {
    agentId: string;
    jobId: string;
    jobTitle: string;
    jobType: string;
    success: boolean;
    result?: unknown;
    error?: string;
    durationMs?: number;
    conversationId?: string;
  }
): Promise<void> {
  await logActivity(supabase, {
    agentId: params.agentId,
    activityType: "cron_execution",
    source: "cron",
    title: `Scheduled: ${params.jobTitle}`,
    description: params.error || (params.success ? `${params.jobType} executed successfully` : "Execution failed"),
    metadata: {
      jobType: params.jobType,
      result: params.result,
      error: params.error,
    },
    jobId: params.jobId,
    conversationId: params.conversationId,
    status: params.success ? "completed" : "failed",
    durationMs: params.durationMs,
  });
}

/**
 * Get activity log entries for an agent
 */
export async function getActivityLog(
  supabase: SupabaseClient,
  agentId: string,
  options: {
    limit?: number;
    offset?: number;
    activityType?: ActivityType;
    source?: ActivitySource;
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<{ activities: ActivityLogEntry[]; total: number; error?: string }> {
  const { limit = 50, offset = 0, activityType, source, startDate, endDate } = options;

  let query = supabase
    .from("activity_log")
    .select("*", { count: "exact" })
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (activityType) {
    query = query.eq("activity_type", activityType);
  }
  if (source) {
    query = query.eq("source", source);
  }
  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[activity-log] Error fetching activities:", error);
    return { activities: [], total: 0, error: error.message };
  }

  const activities: ActivityLogEntry[] = (data || []).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    activityType: row.activity_type,
    source: row.source,
    title: row.title,
    description: row.description,
    metadata: row.metadata || {},
    conversationId: row.conversation_id,
    taskId: row.task_id,
    projectId: row.project_id,
    jobId: row.job_id,
    status: row.status,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  }));

  return { activities, total: count || 0 };
}

/**
 * Get activity summary/stats for an agent
 */
export async function getActivityStats(
  supabase: SupabaseClient,
  agentId: string,
  days: number = 7
): Promise<{
  totalActivities: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  errorCount: number;
  error?: string;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("activity_log")
    .select("activity_type, source, status")
    .eq("agent_id", agentId)
    .gte("created_at", startDate.toISOString());

  if (error) {
    return { totalActivities: 0, byType: {}, bySource: {}, errorCount: 0, error: error.message };
  }

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let errorCount = 0;

  for (const row of data || []) {
    byType[row.activity_type] = (byType[row.activity_type] || 0) + 1;
    bySource[row.source] = (bySource[row.source] || 0) + 1;
    if (row.status === "failed") errorCount++;
  }

  return {
    totalActivities: data?.length || 0,
    byType,
    bySource,
    errorCount,
  };
}

/**
 * Helper to create a tool call logger that wraps tool execution
 */
export function createToolLogger(
  supabase: SupabaseClient,
  agentId: string,
  source: ActivitySource,
  conversationId?: string
) {
  return async function loggedToolCall<T>(
    toolName: string,
    params: Record<string, unknown>,
    execute: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let success = true;
    let error: string | undefined;

    try {
      result = await execute();
      // Check if result indicates failure
      if (typeof result === "object" && result !== null && "success" in result) {
        success = (result as Record<string, unknown>).success !== false;
        if (!success && "error" in result) {
          error = String((result as Record<string, unknown>).error);
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : "Unknown error";
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;
      // Fire and forget - don't block on logging
      logToolCall(supabase, {
        agentId,
        source,
        toolName,
        toolParams: params,
        result: result!,
        success,
        durationMs,
        conversationId,
        error,
      }).catch(console.error);
    }

    return result;
  };
}
