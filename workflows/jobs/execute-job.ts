import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { tool } from "ai";
import { z } from "zod";
import type { UIMessageChunk } from "ai";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt, getAgentById } from "@/lib/db/agents";
import { markJobExecuted, markJobFailed, createJobExecution, updateJobExecution } from "@/lib/db/scheduled-jobs";
import { createNotification } from "@/lib/db/notifications";
import type { Database } from "@/lib/types/database";

// SAFETY LIMITS to prevent runaway API costs
const MAX_TOOL_STEPS = 25; // Maximum tool calls per job
const MAX_TOKENS_PER_JOB = 100000; // Maximum tokens per job run

type ScheduledJob = Database["public"]["Tables"]["scheduled_jobs"]["Row"];
type ActionPayload = {
  message?: string;
  instruction?: string;
  taskId?: string;
  preferred_channel?: string;
};

/**
 * Execute a scheduled job using a durable workflow
 */
export async function executeJobWorkflow(params: { job: ScheduledJob }) {
  "use workflow";

  const { job } = params;
  const supabase = getAdminClient();

  // Create execution record
  const execution = await createExecutionRecord(job);

  try {
    let result: { success: boolean; data?: unknown; error?: string };

    switch (job.action_type) {
      case "notify":
        result = await executeNotifyAction(job);
        break;
      case "agent_task":
        result = await executeAgentTaskAction(job);
        break;
      case "webhook":
        result = await executeWebhookAction(job);
        break;
      default:
        result = { success: false, error: `Unknown action type: ${job.action_type}` };
    }

    // Update execution record
    if (execution) {
      await updateExecutionRecord(execution.id, result.success, result.data, result.error);
    }

    // Mark job as executed
    if (result.success) {
      await markJobAsExecuted(job);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (execution) {
      await updateExecutionRecord(execution.id, false, undefined, errorMessage);
    }
    
    // Use circuit breaker pattern for failed jobs
    await markJobAsFailed(job, errorMessage);
    
    return { success: false, error: errorMessage };
  }
}

async function markJobAsFailed(job: ScheduledJob, errorMessage: string) {
  "use step";
  const supabase = getAdminClient();
  const result = await markJobFailed(supabase, job.id, job, errorMessage);
  if (result.paused) {
    console.log(`[execute-job] Job ${job.id} paused after repeated failures`);
  }
}

async function createExecutionRecord(job: ScheduledJob) {
  "use step";
  const supabase = getAdminClient();
  const { execution } = await createJobExecution(supabase, job.id, job.agent_id, "running");
  return execution;
}

async function updateExecutionRecord(executionId: string, success: boolean, data?: unknown, error?: string) {
  "use step";
  const supabase = getAdminClient();
  await updateJobExecution(supabase, executionId, success ? "success" : "failed", data as Record<string, unknown> | undefined, error);
}

async function markJobAsExecuted(job: ScheduledJob) {
  "use step";
  const supabase = getAdminClient();
  await markJobExecuted(supabase, job.id, job);
}

async function executeNotifyAction(job: ScheduledJob) {
  "use step";

  const supabase = getAdminClient();
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
        .insert({ agent_id: job.agent_id, channel_type: "app", status: "active", title: "Notifications" })
        .select("id")
        .single();
      conversationId = newConv?.id || null;
    }
  }

  if (!conversationId) {
    return { success: false, error: "Could not find or create conversation" };
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

  await createNotification(supabase, job.agent_id, "reminder", job.title, notificationContent.substring(0, 200), "conversation", conversationId);

  return { success: true, data: { conversationId, message: notificationContent } };
}

async function executeAgentTaskAction(job: ScheduledJob) {
  "use step";

  const supabase = getAdminClient();
  const payload = job.action_payload as ActionPayload;
  const instruction = payload?.instruction || "execute_scheduled_task";

  // Get agent
  const agent = await getAgentById(supabase, job.agent_id);
  if (!agent) {
    return { success: false, error: "Agent not found" };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name, timezone, email")
    .eq("user_id", agent.userId)
    .single();

  // Create conversation
  const { data: newConv, error: convError } = await supabase
    .from("conversations")
    .insert({ agent_id: job.agent_id, channel_type: "app", status: "active", title: `Scheduled: ${job.title}` })
    .select("id")
    .single();

  if (convError || !newConv) {
    return { success: false, error: "Could not create conversation" };
  }

  const conversationId = newConv.id;
  const userMessage = `[Scheduled Task: ${job.title}]\n\n${instruction}`;

  // Save user message
  await supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: userMessage });

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(agent, {
    id: agent.userId,
    name: profile?.name || "User",
    timezone: profile?.timezone || undefined,
    email: profile?.email || undefined,
  });

  // Run durable agent with SAFETY LIMITS
  const writable = getWritable<UIMessageChunk>();

  const durableAgent = new DurableAgent({
    model: "anthropic/claude-sonnet-4",
    system: systemPrompt,
    tools: createJobTools(supabase, job.agent_id, payload?.taskId),
  });

  try {
    await durableAgent.stream({
      messages: [{ role: "user", content: userMessage }],
      writable,
      maxSteps: MAX_TOOL_STEPS, // CRITICAL: Prevent infinite tool loops
    });
  } catch (agentError) {
    const errorMsg = agentError instanceof Error ? agentError.message : "Agent execution failed";
    console.error(`[execute-job] Agent error for job ${job.id}:`, errorMsg);
    throw new Error(`Agent failed: ${errorMsg}`);
  }

  await createNotification(supabase, job.agent_id, "reminder", job.title, "Scheduled task completed", "conversation", conversationId);

  return { success: true, data: { conversationId, instruction } };
}

async function executeWebhookAction(job: ScheduledJob) {
  "use step";

  const payload = job.action_payload as { url?: string; body?: unknown; headers?: Record<string, string> };

  if (!payload?.url) {
    return { success: false, error: "No webhook URL specified" };
  }

  const response = await fetch(payload.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(payload.headers || {}) },
    body: JSON.stringify({ job_id: job.id, job_type: job.job_type, title: job.title, ...(payload.body as object || {}) }),
  });

  if (!response.ok) {
    return { success: false, error: `Webhook returned ${response.status}` };
  }

  const responseData = await response.json().catch(() => ({}));
  return { success: true, data: responseData };
}

function createJobTools(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string,
  taskId?: string
) {
  return {
    searchMemory: tool({
      description: "Search memory for relevant information",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        "use step";
        const { semanticSearchAll, formatContextForAI } = await import("@/lib/db/search");
        const results = await semanticSearchAll(supabase, query, agentId, { matchCount: 10, matchThreshold: 0.65 });
        return { success: true, results: formatContextForAI(results), count: results.length };
      },
    }),

    createTask: tool({
      description: "Create a new task",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        assigneeType: z.enum(["user", "agent"]).optional(),
      }),
      execute: async ({ title, description, priority, assigneeType }) => {
        "use step";
        const { generateEmbedding } = await import("@/lib/embeddings");

        let assigneeId: string | null = null;
        if (assigneeType === "agent") {
          assigneeId = agentId;
        } else if (assigneeType === "user") {
          const { data: agentData } = await supabase.from("agents").select("user_id").eq("id", agentId).single();
          assigneeId = agentData?.user_id || null;
        }

        const embedding = await generateEmbedding(title);
        const { data, error } = await supabase
          .from("tasks")
          .insert({ agent_id: agentId, title, description, priority: priority || "medium", status: "todo", assignee_type: assigneeType, assignee_id: assigneeId, embedding })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, task: data };
      },
    }),

    listTasks: tool({
      description: "List tasks",
      inputSchema: z.object({ status: z.string().optional() }),
      execute: async ({ status }) => {
        "use step";
        let query = supabase.from("tasks").select("id, title, status, priority, due_date").eq("agent_id", agentId).order("created_at", { ascending: false });
        if (status && status !== "all") query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, tasks: data, count: data.length };
      },
    }),

    addComment: tool({
      description: "Add a comment to the linked task",
      inputSchema: z.object({ content: z.string(), commentType: z.string().optional() }),
      execute: async ({ content, commentType }) => {
        "use step";
        if (!taskId) return { success: false, error: "No task linked" };
        const { data, error } = await supabase
          .from("comments")
          .insert({ task_id: taskId, author_type: "agent", author_id: agentId, content, comment_type: commentType || "progress" })
          .select()
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, commentId: data.id };
      },
    }),

    scheduleReminder: tool({
      description: "Schedule a reminder",
      inputSchema: z.object({
        title: z.string(),
        message: z.string(),
        runAt: z.string().optional(),
        cronExpression: z.string().optional(),
      }),
      execute: async ({ title, message, runAt, cronExpression }) => {
        "use step";
        const { createScheduledJob } = await import("@/lib/db/scheduled-jobs");
        const { success, job, error } = await createScheduledJob(supabase, {
          agentId,
          jobType: cronExpression ? "recurring" : "one_time",
          title,
          description: message,
          scheduleType: cronExpression ? "cron" : "once",
          runAt,
          cronExpression,
          actionType: "notify",
          actionPayload: { message },
        });
        if (!success || error) return { success: false, error: error || "Failed" };
        return { success: true, jobId: job?.id, nextRunAt: job?.next_run_at };
      },
    }),
  };
}
