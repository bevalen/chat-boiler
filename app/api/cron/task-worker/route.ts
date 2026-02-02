import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/db/activity-log";
import { inngest } from "@/lib/inngest/client";

export const maxDuration = 60;

/**
 * Task Worker - Polls for agent-assigned tasks and sends them to Inngest for durable processing
 * This endpoint is called by Vercel Cron every 5 minutes
 */
export async function POST(request: Request) {
  console.log("[task-worker] Starting task processing cycle");

  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log("[task-worker] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getAdminClient();

    // Get tasks that need processing:
    // - Assigned to agent
    // - Status is todo or in_progress (not waiting_on or done)
    // - Not currently locked (lock_expires_at is null or expired)
    // - agent_run_state is not 'running'
    const now = new Date().toISOString();

    const { data: tasks, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title, agent_id, status, priority")
      .eq("assignee_type", "agent")
      .in("status", ["todo", "in_progress"])
      .neq("agent_run_state", "running")
      .or(`lock_expires_at.is.null,lock_expires_at.lt.${now}`)
      .order("priority", { ascending: true }) // high priority first
      .order("created_at", { ascending: true })
      .limit(5); // Process up to 5 tasks per cycle

    if (fetchError) {
      console.error("[task-worker] Error fetching tasks:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!tasks || tasks.length === 0) {
      console.log("[task-worker] No tasks to process");
      return NextResponse.json({
        message: "No tasks to process",
        processedCount: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[task-worker] Found ${tasks.length} task(s) to process`);

    const results: Array<{
      taskId: string;
      title: string;
      success: boolean;
      error?: string;
    }> = [];

    // Start a workflow for each task
    for (const task of tasks) {
      try {
        console.log(`[task-worker] Starting workflow for task: ${task.title} (${task.id})`);

        // Log task start
        await logActivity(supabase, {
          agentId: task.agent_id,
          activityType: "task_updated",
          source: "cron",
          title: `Starting background processing: ${task.title}`,
          description: `Processing task with priority: ${task.priority}`,
          metadata: {
            taskId: task.id,
            taskTitle: task.title,
            previousStatus: task.status,
          },
          taskId: task.id,
          status: "started",
        }).catch((err) => console.error("[task-worker] Failed to log task start:", err));

        // Send to Inngest for durable processing
        await inngest.send({
          name: "task/process.start",
          data: {
            taskId: task.id,
            agentId: task.agent_id,
          },
        });

        console.log(`[task-worker] Sent task ${task.id} to Inngest for processing`);

        results.push({
          taskId: task.id,
          title: task.title,
          success: true,
        });
      } catch (error) {
        console.error(`[task-worker] Error starting workflow for task ${task.id}:`, error);
        
        // Mark task as failed
        await supabase.from("tasks").update({
          agent_run_state: "failed",
          failure_reason: error instanceof Error ? error.message : "Unknown error",
        }).eq("id", task.id);

        results.push({
          taskId: task.id,
          title: task.title,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `[task-worker] Completed: ${successCount}/${results.length} workflows started`
    );

    return NextResponse.json({
      message: "Task processing cycle completed",
      processedCount: results.length,
      successCount,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[task-worker] Fatal error:", error);
    return NextResponse.json(
      { error: "Task processing cycle failed" },
      { status: 500 }
    );
  }
}

// Support GET for manual testing
export async function GET(request: Request) {
  return POST(request);
}
