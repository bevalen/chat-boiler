import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { getDueJobs } from "@/lib/db/scheduled-jobs";
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
    // Verify authorization (Vercel Cron sends this automatically)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log("[dispatcher] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getAdminClient();

    // Get all due jobs
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
        console.log(`[dispatcher] Starting workflow for job: ${job.title} (${job.id})`);

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
