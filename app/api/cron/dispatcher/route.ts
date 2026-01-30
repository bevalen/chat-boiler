import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getDueJobs,
  markJobExecuted,
  createJobExecution,
  updateJobExecution,
} from "@/lib/db/scheduled-jobs";
import { Database } from "@/lib/types/database";

type ScheduledJob = Database["public"]["Tables"]["scheduled_jobs"]["Row"];

export const maxDuration = 60;

/**
 * Master dispatcher endpoint called by pg_cron every minute
 * Processes all due scheduled jobs
 */
export async function POST(request: Request) {
  console.log("[dispatcher] Starting job dispatch cycle");

  try {
    // Verify authorization
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

    // Process each job
    for (const job of jobs) {
      try {
        console.log(`[dispatcher] Processing job: ${job.title} (${job.id})`);

        // Create execution record
        const { execution } = await createJobExecution(
          supabase,
          job.id,
          job.agent_id,
          "running"
        );

        // Execute based on action type
        let result: { success: boolean; error?: string; data?: unknown };

        switch (job.action_type) {
          case "notify":
            result = await executeNotifyAction(supabase, job);
            break;
          case "agent_task":
            result = await executeAgentTaskAction(supabase, job);
            break;
          case "webhook":
            result = await executeWebhookAction(job);
            break;
          default:
            result = { success: false, error: `Unknown action type: ${job.action_type}` };
        }

        // Update execution record
        if (execution) {
          await updateJobExecution(
            supabase,
            execution.id,
            result.success ? "success" : "failed",
            result.data as Record<string, unknown> | undefined,
            result.error
          );
        }

        // Mark job as executed (updates next_run_at for recurring, marks complete for one-time)
        if (result.success) {
          await markJobExecuted(supabase, job.id, job);
        }

        results.push({
          jobId: job.id,
          title: job.title,
          success: result.success,
          error: result.error,
        });

        console.log(
          `[dispatcher] Job ${job.title}: ${result.success ? "SUCCESS" : "FAILED"}${result.error ? ` - ${result.error}` : ""}`
        );
      } catch (error) {
        console.error(`[dispatcher] Error processing job ${job.id}:`, error);
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
      `[dispatcher] Completed: ${successCount}/${results.length} jobs successful`
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

/**
 * Execute a notification action - posts a message to the conversation
 */
async function executeNotifyAction(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const payload = job.action_payload as { message?: string };
    const message = payload?.message || job.title;

    // Get or create conversation for the agent
    let conversationId = job.conversation_id;

    if (!conversationId) {
      // Find or create default conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("agent_id", job.agent_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            agent_id: job.agent_id,
            channel_type: "app",
            status: "active",
            title: "Notifications",
          })
          .select("id")
          .single();
        conversationId = newConv?.id || null;
      }
    }

    if (!conversationId) {
      return { success: false, error: "Could not find or create conversation" };
    }

    // Build notification message
    let notificationContent = `**Reminder:** ${message}`;

    // Add task context if linked
    if (job.task_id) {
      const { data: task } = await supabase
        .from("tasks")
        .select("title, description, priority, due_date")
        .eq("id", job.task_id)
        .single();

      if (task) {
        notificationContent = `**Reminder:** ${job.title}\n\n`;
        notificationContent += `**Task:** ${task.title}\n`;
        if (task.description) {
          notificationContent += `${task.description}\n`;
        }
        if (task.due_date) {
          notificationContent += `**Due:** ${new Date(task.due_date).toLocaleDateString()}\n`;
        }
      }
    }

    // Insert message
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: notificationContent,
      metadata: {
        type: "scheduled_notification",
        job_id: job.id,
        job_type: job.job_type,
      },
    });

    if (msgError) {
      return { success: false, error: msgError.message };
    }

    return { success: true, data: { conversationId, message: notificationContent } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Execute an agent task - triggers the agent to perform a specific action
 */
async function executeAgentTaskAction(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const payload = job.action_payload as { instruction?: string };
    const instruction = payload?.instruction || "execute_scheduled_task";

    // Handle specific built-in instructions
    switch (instruction) {
      case "generate_daily_brief":
        return await generateDailyBrief(supabase, job);
      default:
        // For custom instructions, we'll post a system message that the agent should respond to
        return await triggerAgentWithInstruction(supabase, job, instruction);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate daily brief for an agent (migrated from daily-brief route)
 */
async function generateDailyBrief(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    // Get agent info
    const { data: agent } = await supabase
      .from("agents")
      .select("id, name")
      .eq("id", job.agent_id)
      .single();

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    // Get or create conversation
    let conversationId = job.conversation_id;

    if (!conversationId) {
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("agent_id", job.agent_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            agent_id: job.agent_id,
            channel_type: "app",
            status: "active",
          })
          .select("id")
          .single();
        conversationId = newConv?.id || null;
      }
    }

    if (!conversationId) {
      return { success: false, error: "Could not find or create conversation" };
    }

    // Get today's date info
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Get active projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, status, priority")
      .eq("agent_id", job.agent_id)
      .eq("status", "active");

    // Get pending tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, priority, due_date, project_id")
      .eq("agent_id", job.agent_id)
      .in("status", ["pending", "in_progress"])
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true });

    // Get upcoming scheduled jobs (reminders)
    const { data: upcomingJobs } = await supabase
      .from("scheduled_jobs")
      .select("id, title, job_type, next_run_at")
      .eq("agent_id", job.agent_id)
      .eq("status", "active")
      .neq("id", job.id) // Exclude this job
      .gt("next_run_at", today.toISOString())
      .order("next_run_at", { ascending: true })
      .limit(5);

    // Build the daily brief
    let briefContent = `Good morning! Here's your daily brief for ${dateStr}.\n\n`;

    // Calendar section (placeholder)
    briefContent += `**CALENDAR TODAY**\n`;
    briefContent += `Calendar integration not yet configured. Once set up, your events will appear here.\n\n`;

    // Projects section
    briefContent += `**ACTIVE PROJECTS (${projects?.length || 0})**\n`;
    if (projects && projects.length > 0) {
      for (const project of projects) {
        briefContent += `- ${project.title} (${project.priority} priority)\n`;
      }
    } else {
      briefContent += `No active projects.\n`;
    }
    briefContent += `\n`;

    // Tasks section
    briefContent += `**PENDING TASKS (${tasks?.length || 0})**\n`;
    if (tasks && tasks.length > 0) {
      const highPriority = tasks.filter((t) => t.priority === "high");
      const mediumPriority = tasks.filter((t) => t.priority === "medium");
      const lowPriority = tasks.filter((t) => t.priority === "low");

      if (highPriority.length > 0) {
        briefContent += `\n*High Priority:*\n`;
        for (const task of highPriority) {
          const dueStr = task.due_date
            ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})`
            : "";
          briefContent += `- ${task.title}${dueStr}\n`;
        }
      }

      if (mediumPriority.length > 0) {
        briefContent += `\n*Medium Priority:*\n`;
        for (const task of mediumPriority.slice(0, 5)) {
          briefContent += `- ${task.title}\n`;
        }
        if (mediumPriority.length > 5) {
          briefContent += `  ...and ${mediumPriority.length - 5} more\n`;
        }
      }

      if (lowPriority.length > 0) {
        briefContent += `\n*Low Priority:*\n`;
        for (const task of lowPriority.slice(0, 3)) {
          briefContent += `- ${task.title}\n`;
        }
        if (lowPriority.length > 3) {
          briefContent += `  ...and ${lowPriority.length - 3} more\n`;
        }
      }
    } else {
      briefContent += `No pending tasks. Great job staying on top of things!\n`;
    }

    // Upcoming reminders section
    if (upcomingJobs && upcomingJobs.length > 0) {
      briefContent += `\n**UPCOMING REMINDERS**\n`;
      for (const reminder of upcomingJobs) {
        const runAt = reminder.next_run_at
          ? new Date(reminder.next_run_at).toLocaleString()
          : "Unknown";
        briefContent += `- ${reminder.title} (${runAt})\n`;
      }
    }

    briefContent += `\n---\nAnything you'd like me to help you focus on today?`;

    // Insert the brief as a message
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: briefContent,
      metadata: {
        type: "daily_brief",
        date: today.toISOString().split("T")[0],
        job_id: job.id,
      },
    });

    if (msgError) {
      return { success: false, error: msgError.message };
    }

    return { success: true, data: { conversationId, briefDate: dateStr } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Trigger agent with a custom instruction
 */
async function triggerAgentWithInstruction(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob,
  instruction: string
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  // For now, post the instruction as a system message
  // In the future, this could call the chat API to get an actual agent response
  
  let conversationId = job.conversation_id;

  if (!conversationId) {
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("agent_id", job.agent_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    conversationId = existingConv?.id || null;
  }

  if (!conversationId) {
    return { success: false, error: "No conversation found for agent task" };
  }

  const message = `**Scheduled Task:** ${job.title}\n\n${instruction}`;

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: message,
    metadata: {
      type: "scheduled_agent_task",
      job_id: job.id,
      instruction,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { conversationId, instruction } };
}

/**
 * Execute a webhook action - makes an HTTP POST to a URL
 */
async function executeWebhookAction(
  job: ScheduledJob
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const payload = job.action_payload as { url?: string; body?: unknown; headers?: Record<string, string> };

    if (!payload?.url) {
      return { success: false, error: "No webhook URL specified" };
    }

    const response = await fetch(payload.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(payload.headers || {}),
      },
      body: JSON.stringify({
        job_id: job.id,
        job_type: job.job_type,
        title: job.title,
        agent_id: job.agent_id,
        ...(payload.body as object || {}),
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Webhook returned ${response.status}: ${response.statusText}`,
      };
    }

    const responseData = await response.json().catch(() => ({}));
    return { success: true, data: responseData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Support GET for manual testing
export async function GET(request: Request) {
  return POST(request);
}
