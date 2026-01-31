import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getDueJobs,
  markJobExecuted,
  createJobExecution,
  updateJobExecution,
} from "@/lib/db/scheduled-jobs";
import { createNotification } from "@/lib/db/notifications";
import { getSlackCredentials } from "@/lib/db/channel-credentials";
import { createSlackClient, sendSlackDirectMessage, sendSlackMessage } from "@/lib/slack";
import { Database, ActionPayload, ChannelType } from "@/lib/types/database";

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
 * Send notification via Slack channel
 */
async function sendViaSlack(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
  message: string,
  slackChannelId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { credentials, isActive, error } = await getSlackCredentials(supabase, userId);

    if (error || !credentials || !isActive) {
      return { success: false, error: error || "Slack not configured or inactive" };
    }

    const client = createSlackClient(credentials);

    let result;
    if (slackChannelId) {
      result = await sendSlackMessage(client, { channelId: slackChannelId, text: message });
    } else if (credentials.user_slack_id) {
      result = await sendSlackDirectMessage(client, credentials.user_slack_id, message);
    } else if (credentials.default_channel_id) {
      result = await sendSlackMessage(client, { channelId: credentials.default_channel_id, text: message });
    } else {
      return { success: false, error: "No Slack channel or user ID configured" };
    }

    return result;
  } catch (error) {
    console.error("[dispatcher] Error sending via Slack:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send via Slack",
    };
  }
}

/**
 * Execute a notification action - posts a message to the conversation and/or external channels
 */
async function executeNotifyAction(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const payload = job.action_payload as ActionPayload;
    const message = payload?.message || job.title;
    const preferredChannel: ChannelType = payload?.preferred_channel || "app";
    const slackChannelId = payload?.slack_channel_id;

    // Get the user ID from the agent
    const { data: agent } = await supabase
      .from("agents")
      .select("user_id")
      .eq("id", job.agent_id)
      .single();

    const userId = agent?.user_id;

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

    let sentViaSlack = false;
    let slackError: string | undefined;

    // Try to send via preferred channel
    if (preferredChannel === "slack" && userId) {
      const slackResult = await sendViaSlack(supabase, userId, notificationContent, slackChannelId);
      sentViaSlack = slackResult.success;
      slackError = slackResult.error;

      if (sentViaSlack) {
        console.log(`[dispatcher] Notification sent via Slack for job ${job.id}`);
      } else {
        console.log(`[dispatcher] Slack delivery failed: ${slackError}, falling back to app`);
      }
    }

    // Always store in app conversation (as fallback or in addition)
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
      // If Slack succeeded but we couldn't save to app, still consider it a success
      if (sentViaSlack) {
        return { success: true, data: { sentViaSlack: true, message: notificationContent } };
      }
      return { success: false, error: "Could not find or create conversation" };
    }

    // Insert message to app conversation
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: notificationContent,
      metadata: {
        type: "scheduled_notification",
        job_id: job.id,
        job_type: job.job_type,
        preferred_channel: preferredChannel,
        sent_via_slack: sentViaSlack,
      },
    });

    if (msgError) {
      // If Slack succeeded but app storage failed, still consider it a partial success
      if (sentViaSlack) {
        return { success: true, data: { sentViaSlack: true, appStoreFailed: true, message: notificationContent } };
      }
      return { success: false, error: msgError.message };
    }

    // Create a notification for the user (in-app notification)
    await createNotification(
      supabase,
      job.agent_id,
      "reminder",
      job.title,
      notificationContent.substring(0, 200),
      "conversation",
      conversationId
    );

    return {
      success: true,
      data: {
        conversationId,
        message: notificationContent,
        preferredChannel,
        sentViaSlack,
        slackError: sentViaSlack ? undefined : slackError,
      },
    };
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
    const payload = job.action_payload as ActionPayload;
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
    const payload = job.action_payload as ActionPayload;
    const preferredChannel: ChannelType = payload?.preferred_channel || "app";
    const slackChannelId = payload?.slack_channel_id;

    // Get agent info
    const { data: agent } = await supabase
      .from("agents")
      .select("id, name, user_id")
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

    // Try to send via Slack if preferred
    let sentViaSlack = false;
    if (preferredChannel === "slack" && agent.user_id) {
      const slackResult = await sendViaSlack(supabase, agent.user_id, briefContent, slackChannelId);
      sentViaSlack = slackResult.success;
      if (sentViaSlack) {
        console.log(`[dispatcher] Daily brief sent via Slack for agent ${agent.id}`);
      }
    }

    // Store in app conversation
    if (conversationId) {
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: briefContent,
        metadata: {
          type: "daily_brief",
          date: today.toISOString().split("T")[0],
          job_id: job.id,
          preferred_channel: preferredChannel,
          sent_via_slack: sentViaSlack,
        },
      });

      if (msgError) {
        console.error("[dispatcher] Error storing daily brief:", msgError);
      }

      // Create a notification for the daily brief
      await createNotification(
        supabase,
        job.agent_id,
        "reminder",
        `Daily Brief for ${dateStr}`,
        `Your daily summary is ready with ${projects?.length || 0} active projects and ${tasks?.length || 0} pending tasks.`,
        "conversation",
        conversationId
      );
    }

    return {
      success: true,
      data: {
        conversationId,
        briefDate: dateStr,
        sentViaSlack,
        preferredChannel,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Trigger agent with a custom instruction - calls the chat API to execute the agent
 */
async function triggerAgentWithInstruction(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob,
  instruction: string
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const payload = job.action_payload as ActionPayload;
  const preferredChannel: ChannelType = payload?.preferred_channel || "app";
  const slackChannelId = payload?.slack_channel_id;

  // Get user_id from agent
  const { data: agent } = await supabase
    .from("agents")
    .select("user_id")
    .eq("id", job.agent_id)
    .single();

  if (!agent?.user_id) {
    return { success: false, error: "Agent or user not found" };
  }

  // Create a NEW conversation for this scheduled task
  const { data: newConv, error: convError } = await supabase
    .from("conversations")
    .insert({
      agent_id: job.agent_id,
      channel_type: preferredChannel === "slack" ? "slack" : "app",
      status: "active",
      title: `Scheduled: ${job.title}`,
    })
    .select("id")
    .single();

  if (convError || !newConv) {
    console.error("[dispatcher] Error creating conversation:", convError);
    return { success: false, error: "Could not create conversation for scheduled task" };
  }

  const conversationId = newConv.id;
  console.log(`[dispatcher] Created new conversation ${conversationId} for scheduled job ${job.id}`);

  // Build the user message that will trigger the agent
  const userMessage = `[Scheduled Task: ${job.title}]\n\n${instruction}`;

  try {
    // Get the app base URL
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return { success: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" };
    }

    // Call the chat API to execute the agent (similar to Slack bot pattern)
    const response = await fetch(`${appBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: userMessage,
            parts: [{ type: "text", text: userMessage }],
          },
        ],
        conversationId,
        userId: agent.user_id,
        channelSource: preferredChannel === "slack" ? "slack" : "cron",
        channelMetadata: {
          job_id: job.id,
          job_type: job.job_type,
          scheduled_task: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[dispatcher] Chat API error:", response.status, errorText);
      return { success: false, error: `Chat API returned ${response.status}` };
    }

    // Read the streaming response to get the agent's output
    const reader = response.body?.getReader();
    if (!reader) {
      return { success: false, error: "Could not read chat API response" };
    }

    let fullResponse = "";
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        // Handle SSE data: prefix format (AI SDK)
        if (line.startsWith("data: ")) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr.trim()) {
              const data = JSON.parse(jsonStr);
              if (data.type === "text-delta" && data.delta) {
                fullResponse += data.delta;
              }
            }
          } catch {
            // Ignore parse errors for non-JSON lines
          }
        }
        // Handle older format with 0: prefix
        else if (line.startsWith("0:")) {
          try {
            const textContent = JSON.parse(line.slice(2));
            fullResponse += textContent;
          } catch {
            fullResponse += line.slice(2);
          }
        }
      }
    }

    console.log(`[dispatcher] Agent executed for job ${job.id}, response length: ${fullResponse.length}`);

    // Send the agent's response to Slack if preferred
    let sentViaSlack = false;
    if (preferredChannel === "slack" && agent.user_id && fullResponse) {
      const slackMessage = `**${job.title}**\n\n${fullResponse}`;
      const slackResult = await sendViaSlack(supabase, agent.user_id, slackMessage, slackChannelId);
      sentViaSlack = slackResult.success;
      if (sentViaSlack) {
        console.log(`[dispatcher] Agent response sent via Slack for job ${job.id}`);
      }
    }

    // Create a notification for the completed task
    await createNotification(
      supabase,
      job.agent_id,
      "reminder",
      job.title,
      fullResponse.substring(0, 200) || "Scheduled task completed",
      "conversation",
      conversationId
    );

    return {
      success: true,
      data: {
        conversationId,
        instruction,
        responseLength: fullResponse.length,
        sentViaSlack,
        preferredChannel,
      },
    };
  } catch (error) {
    console.error("[dispatcher] Error executing agent task:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error executing agent",
    };
  }
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
