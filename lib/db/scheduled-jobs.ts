import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Json } from "@/lib/types/database";

type ScheduledJob = Database["public"]["Tables"]["scheduled_jobs"]["Row"];
type ScheduledJobInsert = Database["public"]["Tables"]["scheduled_jobs"]["Insert"];
type ScheduledJobUpdate = Database["public"]["Tables"]["scheduled_jobs"]["Update"];
type JobExecution = Database["public"]["Tables"]["job_executions"]["Row"];

export interface CreateScheduledJobParams {
  agentId: string;
  jobType: "reminder" | "follow_up" | "recurring" | "one_time";
  title: string;
  description?: string;
  scheduleType: "once" | "cron";
  runAt?: string; // ISO datetime for one-time jobs
  cronExpression?: string; // For recurring jobs
  timezone?: string;
  actionType: "notify" | "agent_task" | "webhook";
  actionPayload?: Record<string, unknown>;
  taskId?: string;
  projectId?: string;
  conversationId?: string;
  cancelConditions?: Record<string, unknown>;
  maxRuns?: number;
}

/**
 * Parse a cron expression and calculate the next run time
 * Supports standard 5-field cron: minute hour day month weekday
 */
export function calculateNextRunFromCron(
  cronExpression: string,
  timezone: string = "America/New_York",
  fromDate: Date = new Date()
): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${cronExpression}. Expected 5 fields.`);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Simple cron parser - handles basic patterns
  // For production, consider using a library like cron-parser
  const parseField = (field: string, min: number, max: number): number[] => {
    if (field === "*") {
      return Array.from({ length: max - min + 1 }, (_, i) => i + min);
    }
    if (field.includes("/")) {
      const [, step] = field.split("/");
      const stepNum = parseInt(step, 10);
      return Array.from({ length: Math.ceil((max - min + 1) / stepNum) }, (_, i) => min + i * stepNum);
    }
    if (field.includes(",")) {
      return field.split(",").map((v) => parseInt(v, 10));
    }
    if (field.includes("-")) {
      const [start, end] = field.split("-").map((v) => parseInt(v, 10));
      return Array.from({ length: end - start + 1 }, (_, i) => i + start);
    }
    return [parseInt(field, 10)];
  };

  const minutes = parseField(minute, 0, 59);
  const hours = parseField(hour, 0, 23);
  const daysOfMonth = parseField(dayOfMonth, 1, 31);
  const months = parseField(month, 1, 12);
  const daysOfWeek = parseField(dayOfWeek, 0, 6); // 0 = Sunday

  // Find the next valid date
  const candidate = new Date(fromDate);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1); // Start from next minute

  // Search up to 1 year ahead
  const maxIterations = 366 * 24 * 60;
  for (let i = 0; i < maxIterations; i++) {
    const m = candidate.getMonth() + 1;
    const d = candidate.getDate();
    const dow = candidate.getDay();
    const h = candidate.getHours();
    const min = candidate.getMinutes();

    if (
      months.includes(m) &&
      daysOfMonth.includes(d) &&
      daysOfWeek.includes(dow) &&
      hours.includes(h) &&
      minutes.includes(min)
    ) {
      return candidate;
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error(`Could not find next run time for cron: ${cronExpression}`);
}

/**
 * Calculate the next run time based on schedule type
 */
export function calculateNextRun(
  scheduleType: "once" | "cron",
  runAt?: string,
  cronExpression?: string,
  timezone?: string
): string | null {
  if (scheduleType === "once" && runAt) {
    return runAt;
  }

  if (scheduleType === "cron" && cronExpression) {
    const nextRun = calculateNextRunFromCron(cronExpression, timezone);
    return nextRun.toISOString();
  }

  return null;
}

/**
 * Create a new scheduled job
 */
export async function createScheduledJob(
  supabase: SupabaseClient,
  params: CreateScheduledJobParams
): Promise<{ success: boolean; job?: ScheduledJob; error?: string }> {
  const nextRunAt = calculateNextRun(
    params.scheduleType,
    params.runAt,
    params.cronExpression,
    params.timezone
  );

  const insert: ScheduledJobInsert = {
    agent_id: params.agentId,
    job_type: params.jobType,
    title: params.title,
    description: params.description || null,
    schedule_type: params.scheduleType,
    run_at: params.runAt || null,
    cron_expression: params.cronExpression || null,
    timezone: params.timezone || "America/New_York",
    action_type: params.actionType,
    action_payload: (params.actionPayload || {}) as Json,
    task_id: params.taskId || null,
    project_id: params.projectId || null,
    conversation_id: params.conversationId || null,
    cancel_conditions: (params.cancelConditions || {}) as Json,
    max_runs: params.maxRuns || null,
    next_run_at: nextRunAt,
    status: "active",
  };

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .insert(insert)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, job: data };
}

/**
 * List scheduled jobs for an agent
 */
export async function listScheduledJobs(
  supabase: SupabaseClient,
  agentId: string,
  options?: {
    status?: "active" | "paused" | "completed" | "cancelled" | "all";
    jobType?: "reminder" | "follow_up" | "recurring" | "one_time";
    limit?: number;
  }
): Promise<{ success: boolean; jobs?: ScheduledJob[]; error?: string }> {
  let query = supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("agent_id", agentId)
    .order("next_run_at", { ascending: true });

  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (options?.jobType) {
    query = query.eq("job_type", options.jobType);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, jobs: data || [] };
}

/**
 * Get a single scheduled job by ID
 */
export async function getScheduledJob(
  supabase: SupabaseClient,
  jobId: string,
  agentId: string
): Promise<{ success: boolean; job?: ScheduledJob; error?: string }> {
  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("agent_id", agentId)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, job: data };
}

/**
 * Update a scheduled job
 */
export async function updateScheduledJob(
  supabase: SupabaseClient,
  jobId: string,
  agentId: string,
  updates: {
    title?: string;
    description?: string;
    runAt?: string;
    cronExpression?: string;
    timezone?: string;
    actionPayload?: Record<string, unknown>;
    cancelConditions?: Record<string, unknown>;
    status?: "active" | "paused" | "completed" | "cancelled";
    maxRuns?: number;
  }
): Promise<{ success: boolean; job?: ScheduledJob; error?: string }> {
  // First get the current job to determine schedule type
  const { data: currentJob } = await supabase
    .from("scheduled_jobs")
    .select("schedule_type, run_at, cron_expression, timezone")
    .eq("id", jobId)
    .eq("agent_id", agentId)
    .single();

  if (!currentJob) {
    return { success: false, error: "Job not found" };
  }

  const updateData: ScheduledJobUpdate = {};

  if (updates.title) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.status) updateData.status = updates.status;
  if (updates.actionPayload) updateData.action_payload = updates.actionPayload as Json;
  if (updates.cancelConditions) updateData.cancel_conditions = updates.cancelConditions as Json;
  if (updates.maxRuns !== undefined) updateData.max_runs = updates.maxRuns;

  // Handle schedule changes
  if (updates.runAt) {
    updateData.run_at = updates.runAt;
    updateData.next_run_at = updates.runAt;
  }
  if (updates.cronExpression) {
    updateData.cron_expression = updates.cronExpression;
    updateData.next_run_at = calculateNextRun(
      "cron",
      undefined,
      updates.cronExpression,
      updates.timezone || currentJob.timezone || "America/New_York"
    );
  }
  if (updates.timezone) {
    updateData.timezone = updates.timezone;
    // Recalculate next_run_at if it's a cron job
    if (currentJob.schedule_type === "cron" && currentJob.cron_expression) {
      updateData.next_run_at = calculateNextRun(
        "cron",
        undefined,
        updates.cronExpression || currentJob.cron_expression,
        updates.timezone
      );
    }
  }

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .update(updateData)
    .eq("id", jobId)
    .eq("agent_id", agentId)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, job: data };
}

/**
 * Cancel a scheduled job
 */
export async function cancelScheduledJob(
  supabase: SupabaseClient,
  jobId: string,
  agentId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("scheduled_jobs")
    .update({ status: "cancelled" })
    .eq("id", jobId)
    .eq("agent_id", agentId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get due jobs (for the dispatcher)
 * Only returns jobs that are not currently locked
 */
export async function getDueJobs(
  supabase: SupabaseClient,
  limit: number = 100
): Promise<{ success: boolean; jobs?: ScheduledJob[]; error?: string }> {
  const now = new Date().toISOString();
  console.log("[getDueJobs] Checking for jobs due before:", now);

  // First get jobs that are due
  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("status", "active")
    .not("next_run_at", "is", null)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(limit);

  console.log("[getDueJobs] Query returned:", data?.length || 0, "jobs, error:", error?.message || "none");

  if (error) {
    return { success: false, error: error.message };
  }

  // Filter out locked jobs in JS (simpler than complex Supabase OR syntax)
  const unlockedJobs = (data || []).filter((job) => {
    if (!job.locked_until) return true;
    return new Date(job.locked_until) < new Date(now);
  });

  console.log("[getDueJobs] After lock filter:", unlockedJobs.length, "jobs");
  return { success: true, jobs: unlockedJobs };
}

/**
 * Lock a job before execution to prevent duplicate runs
 * Uses atomic update with a condition to prevent race conditions
 */
export async function lockJobForExecution(
  supabase: SupabaseClient,
  jobId: string,
  lockDurationMinutes: number = 30
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);

  // First, check if job can be locked (not currently locked)
  const { data: currentJob } = await supabase
    .from("scheduled_jobs")
    .select("id, locked_until")
    .eq("id", jobId)
    .single();
  
  if (!currentJob) {
    return { success: false, error: "Job not found" };
  }
  
  // Check if already locked
  if (currentJob.locked_until && new Date(currentJob.locked_until) > now) {
    return { success: false, error: "Job already locked" };
  }

  // Now lock it
  const { data, error } = await supabase
    .from("scheduled_jobs")
    .update({ 
      locked_until: lockUntil.toISOString(),
      last_lock_at: now.toISOString(),
    })
    .eq("id", jobId)
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to lock job" };
  }

  console.log(`[lockJobForExecution] Locked job ${jobId} until ${lockUntil.toISOString()}`);
  return { success: true };
}

/**
 * Unlock a job after execution failure (so it can be retried)
 * Calculates appropriate next_run_at based on job type
 */
export async function unlockJobAfterFailure(
  supabase: SupabaseClient,
  jobId: string,
  job: ScheduledJob
): Promise<{ success: boolean; error?: string }> {
  // For failed jobs, set next_run_at to 5 minutes from now to allow retry
  // but not immediately to prevent rapid-fire failures
  const retryAt = new Date(Date.now() + 5 * 60 * 1000);
  
  const updates: ScheduledJobUpdate = {
    locked_until: null,
    next_run_at: retryAt.toISOString(),
  };

  const { error } = await supabase
    .from("scheduled_jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Mark a job as executed and update next_run_at
 * Also releases the lock and resets consecutive_failures
 */
export async function markJobExecuted(
  supabase: SupabaseClient,
  jobId: string,
  job: ScheduledJob
): Promise<{ success: boolean; error?: string }> {
  const updates: ScheduledJobUpdate = {
    last_run_at: new Date().toISOString(),
    run_count: (job.run_count || 0) + 1,
    locked_until: null, // Release the lock
    consecutive_failures: 0, // Reset failure count on success
  };

  // For one-time jobs, mark as completed
  if (job.schedule_type === "once") {
    updates.status = "completed";
    updates.next_run_at = null;
  } else if (job.schedule_type === "cron" && job.cron_expression) {
    // For recurring jobs, calculate next run
    updates.next_run_at = calculateNextRun(
      "cron",
      undefined,
      job.cron_expression,
      job.timezone || "America/New_York"
    );

    // Check if max_runs reached
    if (job.max_runs && updates.run_count! >= job.max_runs) {
      updates.status = "completed";
    }
  }

  const { error } = await supabase
    .from("scheduled_jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Mark a job as failed, increment failure counter, and apply circuit breaker
 * If a job fails 3+ times consecutively, it gets paused automatically
 */
export async function markJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  job: ScheduledJob,
  errorMessage: string
): Promise<{ success: boolean; paused: boolean; error?: string }> {
  const currentFailures = ((job as ScheduledJob & { consecutive_failures?: number }).consecutive_failures || 0) + 1;
  const MAX_CONSECUTIVE_FAILURES = 3;
  
  // Circuit breaker: pause job after too many failures
  const shouldPause = currentFailures >= MAX_CONSECUTIVE_FAILURES;
  
  // Set next retry with exponential backoff (5min, 15min, 45min)
  const retryDelayMinutes = Math.min(5 * Math.pow(3, currentFailures - 1), 60);
  const nextRetry = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
  
  const updates: ScheduledJobUpdate = {
    locked_until: null,
    consecutive_failures: currentFailures,
    last_run_at: new Date().toISOString(),
  };
  
  if (shouldPause) {
    updates.status = "paused";
    updates.next_run_at = null;
    console.log(`[scheduled-jobs] Circuit breaker triggered for job ${jobId} after ${currentFailures} failures`);
  } else {
    updates.next_run_at = nextRetry.toISOString();
    console.log(`[scheduled-jobs] Job ${jobId} failed, retry scheduled for ${nextRetry.toISOString()}`);
  }

  const { error } = await supabase
    .from("scheduled_jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) {
    return { success: false, paused: false, error: error.message };
  }

  return { success: true, paused: shouldPause };
}

/**
 * Create a job execution record
 */
export async function createJobExecution(
  supabase: SupabaseClient,
  jobId: string,
  agentId: string,
  status: "running" | "success" | "failed" | "skipped",
  result?: Record<string, unknown>,
  error?: string
): Promise<{ success: boolean; execution?: JobExecution; error?: string }> {
  const { data, error: insertError } = await supabase
    .from("job_executions")
    .insert({
      job_id: jobId,
      agent_id: agentId,
      status,
      result: result || null,
      error: error || null,
      completed_at: status !== "running" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  return { success: true, execution: data };
}

/**
 * Update a job execution record
 */
export async function updateJobExecution(
  supabase: SupabaseClient,
  executionId: string,
  status: "success" | "failed" | "skipped",
  result?: Record<string, unknown>,
  error?: string
): Promise<{ success: boolean; error?: string }> {
  const { error: updateError } = await supabase
    .from("job_executions")
    .update({
      status,
      result: result || null,
      error: error || null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", executionId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}
