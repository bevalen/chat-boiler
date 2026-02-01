import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { getDueJobs, lockJobForExecution, unlockJobAfterFailure } from "@/lib/db/scheduled-jobs";
import { logActivity } from "@/lib/db/activity-log";
import { executeJobWorkflow } from "@/workflows/jobs/execute-job";
import { Database } from "@/lib/types/database";

type ScheduledJob = Database["public"]["Tables"]["scheduled_jobs"]["Row"];

export const maxDuration = 60;

/**
 * Master dispatcher endpoint called by Vercel Cron every minute
 * Starts Vercel Workflows for each due scheduled job
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

    // Get all due jobs (excludes jobs that are currently locked)
    const { jobs, error: fetchError } = await getDueJobs(supabase, 50);

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
        const lockResult = await lockJobForExecution(supabase, job.id);
        if (!lockResult.success) {
          console.log(`[dispatcher] Job ${job.id} already locked, skipping`);
          continue;
        }

        // Log job start to activity log
        logActivity(supabase, {
          agentId: job.agent_id,
          activityType: "cron_execution",
          source: "cron",
          title: `Starting workflow: ${job.title}`,
          description: `Executing ${job.job_type} (${job.action_type}) via Vercel Workflow`,
          metadata: {
            jobType: job.job_type,
            actionType: job.action_type,
          },
          jobId: job.id,
          status: "started",
        }).catch((err) => console.error("[dispatcher] Failed to log job start:", err));

        // Start the workflow
        await start(executeJobWorkflow, [{ job }]);

        console.log(`[dispatcher] Workflow started for job ${job.id}`);

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
      `[dispatcher] Completed: ${successCount}/${results.length} workflows started`
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
