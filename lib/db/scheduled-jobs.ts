import { SupabaseClient } from "@supabase/supabase-js";

interface CreateScheduledJobParams {
  agentId: string;
  jobType: string;
  title: string;
  description?: string;
  scheduleType: string;
  runAt: Date | string;
  actionType: string;
  actionPayload?: Record<string, unknown>;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

interface CreateScheduledJobResult {
  success: boolean;
  job?: {
    id: string;
    title: string;
    scheduled_for: string;
  };
  error?: string;
}

/**
 * Stub implementation for creating scheduled jobs
 * TODO: Implement actual scheduling logic when needed
 */
export async function createScheduledJob(
  _supabase: SupabaseClient,
  _params: CreateScheduledJobParams
): Promise<CreateScheduledJobResult> {
  // Stub implementation - returns success without doing anything
  console.warn("createScheduledJob: Stub implementation called");
  return {
    success: true,
    job: {
      id: "stub-job-id",
      title: _params.title,
      scheduled_for: typeof _params.runAt === "string" ? _params.runAt : _params.runAt.toISOString(),
    },
  };
}
