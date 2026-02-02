import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { getDueJobs, lockJobForExecution, unlockJobAfterFailure, markJobExecuted, markJobFailed } from "@/lib/db/scheduled-jobs";
import { logActivity } from "@/lib/db/activity-log";
import { createNotification } from "@/lib/db/notifications";
import { Database } from "@/lib/types/database";

type ScheduledJob = Database["public"]["Tables"]["scheduled_jobs"]["Row"];
type ActionPayload = {
  message?: string;
  instruction?: string;
  taskId?: string;
  preferred_channel?: string;
};

export const maxDuration = 60;

/**
 * Master dispatcher endpoint called by Vercel Cron every minute
 * Dispatches agent_task jobs to Inngest for durable execution
 * Executes lightweight jobs (notify, webhook) directly
 */
export async function POST(request: Request) {
  console.log("[dispatcher] Starting job dispatch cycle");

  try {
    // Check for test mode via query param (for debugging)
    const url = new URL(request.url);
    const isTestMode = url.searchParams.get("test") === "true";
    
    // Verify authorization for production cron calls
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Allow requests if:
    // 1. No CRON_SECRET configured (dev mode)
    // 2. Valid Bearer token provided
    // 3. Test mode enabled (for debugging - remove in production if needed)
    const isAuthorized = 
      !cronSecret || 
      authHeader === `Bearer ${cronSecret}` ||
      isTestMode;

    if (!isAuthorized) {
      console.log("[dispatcher] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getAdminClient();
    
    // Debug mode - return raw query results
    const debugMode = url.searchParams.get("debug") === "true";

    // Get all due jobs (excludes jobs that are currently locked)
    const { jobs, error: fetchError } = await getDueJobs(supabase, 50);
    
    if (debugMode) {
      // Return debug info without executing jobs
      const now = new Date().toISOString();
      const { data: allActive } = await supabase
        .from("scheduled_jobs")
        .select("id, title, status, next_run_at, locked_until")
        .eq("status", "active")
        .order("next_run_at", { ascending: true })
        .limit(10);
      
      return NextResponse.json({
        debug: true,
        serverTime: now,
        activeJobs: allActive,
        dueJobsFound: jobs?.length || 0,
        dueJobs: jobs?.map(j => ({ id: j.id, title: j.title, next_run_at: j.next_run_at })),
        fetchError,
      });
    }

    if (fetchError) {
      console.error("[dispatcher] Error fetching due jobs:", fetchError);
      return NextResponse.json({ error: fetchError }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      console.log("[dispatcher] No due jobs found");
      return NextResponse.json({
        message: "No jobs due",
        processedCount: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[dispatcher] Found ${jobs.length} due job(s)`);

    const results: Array<{
      jobId: string;
      title: string;
      success: boolean;
      error?: string;
    }> = [];

    // Start a workflow for each job
    for (const job of jobs) {
      try {
        console.log(`[dispatcher] Locking and starting workflow for job: ${job.title} (${job.id})`);

        // Lock the job BEFORE starting the workflow to prevent re-picking
        const lockMinutes = job.action_type === "agent_task" ? 240 : 30;
        const lockResult = await lockJobForExecution(supabase, job.id, lockMinutes);
        if (!lockResult.success) {
          console.log(`[dispatcher] Job ${job.id} already locked, skipping`);
          continue;
        }

        // Log job start to activity log
        logActivity(supabase, {
          agentId: job.agent_id,
          activityType: "cron_execution",
          source: "cron",
          title: `Starting: ${job.title}`,
          description: `Executing ${job.job_type} (${job.action_type})`,
          metadata: {
            jobType: job.job_type,
            actionType: job.action_type,
          },
          jobId: job.id,
          status: "started",
        }).catch((err) => console.error("[dispatcher] Failed to log job start:", err));

        if (job.action_type === "agent_task") {
          // Durable execution via Inngest for long-running agent work
          await inngest.send({
            name: "job/scheduled.execute",
            data: { job },
          });
          console.log(`[dispatcher] Sent job ${job.id} to Inngest for durable execution`);
          results.push({
            jobId: job.id,
            title: job.title,
            success: true,
          });
          continue;
        }

        // Execute lightweight jobs directly
        const result = await executeJobDirectly(supabase, job);

        if (!result.success) {
          throw new Error(result.error || "Job execution failed");
        }

        // Mark job as executed
        await markJobExecuted(supabase, job.id, job);

        // Log completion
        await logActivity(supabase, {
          agentId: job.agent_id,
          activityType: "cron_execution",
          source: "cron",
          title: `Completed: ${job.title}`,
          description: `${job.job_type} executed successfully`,
          metadata: {
            jobType: job.job_type,
            result: result.data,
          },
          conversationId: (result.data as { conversationId?: string })?.conversationId,
          jobId: job.id,
          status: "completed",
        });

        console.log(`[dispatcher] Job executed successfully: ${job.id}`);

        results.push({
          jobId: job.id,
          title: job.title,
          success: true,
        });
      } catch (error) {
        console.error(`[dispatcher] Error starting workflow for job ${job.id}:`, error);
        
        // Unlock the job if workflow failed to start
        await unlockJobAfterFailure(supabase, job.id, job).catch((err) =>
          console.error(`[dispatcher] Failed to unlock job ${job.id}:`, err)
        );
        
        results.push({
          jobId: job.id,
          title: job.title,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `[dispatcher] Completed: ${successCount}/${results.length} jobs executed`
    );

    return NextResponse.json({
      message: "Dispatch cycle completed",
      processedCount: results.length,
      successCount,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[dispatcher] Fatal error:", error);
    return NextResponse.json(
      { error: "Dispatch cycle failed" },
      { status: 500 }
    );
  }
}

// Support GET for manual testing
export async function GET(request: Request) {
  return POST(request);
}

/**
 * Execute a job directly (for lightweight jobs like notify and webhook)
 * Agent tasks are handled by Inngest for durable execution
 */
async function executeJobDirectly(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  switch (job.action_type) {
    case "notify":
      return executeNotifyAction(supabase, job);
    case "webhook":
      return executeWebhookAction(job);
    default:
      // agent_task is handled by Inngest before reaching here
      return { success: false, error: `Unknown action type: ${job.action_type}` };
  }
}

/**
 * Execute a notification action - send a reminder message
 */
async function executeNotifyAction(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const payload = job.action_payload as ActionPayload;
  const message = payload?.message || job.title;

  // Build notification content
  let notificationContent = `**Reminder:** ${message}`;

  if (job.task_id) {
    const { data: task } = await supabase
      .from("tasks")
      .select("title, description, due_date")
      .eq("id", job.task_id)
      .single();

    if (task) {
      notificationContent = `**Reminder:** ${job.title}\n**Task:** ${task.title}`;
      if (task.due_date) {
        notificationContent += `\n**Due:** ${new Date(task.due_date).toLocaleDateString()}`;
      }
    }
  }

  // Always create a NEW conversation for scheduled tasks
  const { data: newConv } = await supabase
    .from("conversations")
    .insert({
      agent_id: job.agent_id,
      channel_type: "app",
      status: "active",
      title: `Scheduled: ${job.title}`,
    })
    .select("id")
    .single();
  
  const conversationId = newConv?.id || null;

  if (!conversationId) {
    return { success: false, error: "Could not create conversation" };
  }

  // Insert message
  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: notificationContent,
    metadata: { type: "scheduled_notification", job_id: job.id },
  });

  if (msgError) {
    return { success: false, error: msgError.message };
  }

  // Create notification
  await createNotification(
    supabase,
    job.agent_id,
    "reminder",
    job.title,
    notificationContent.substring(0, 200),
    "conversation",
    conversationId
  );

  return { success: true, data: { conversationId, message: notificationContent } };
}

/**
 * Execute a webhook action
 */
async function executeWebhookAction(
  job: ScheduledJob
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const payload = job.action_payload as { url?: string; body?: unknown; headers?: Record<string, string> };

  if (!payload?.url) {
    return { success: false, error: "No webhook URL specified" };
  }

  try {
    const response = await fetch(payload.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(payload.headers || {}) },
      body: JSON.stringify({
        job_id: job.id,
        job_type: job.job_type,
        title: job.title,
        ...(payload.body as object || {}),
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Webhook returned ${response.status}` };
    }

    const responseData = await response.json().catch(() => ({}));
    return { success: true, data: responseData };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Webhook failed" };
  }
}
