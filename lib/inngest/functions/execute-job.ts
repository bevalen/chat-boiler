import { inngest } from "../client";
import { tool, generateText, stepCountIs, gateway } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt, getAgentById } from "@/lib/db/agents";
import {
  markJobExecuted,
  markJobFailed,
  createJobExecution,
  updateJobExecution,
} from "@/lib/db/scheduled-jobs";
import { createNotification } from "@/lib/db/notifications";
import { logActivity } from "@/lib/db/activity-log";
import type { Database } from "@/lib/types/database";
import {
  createCheckEmailTool,
  createSendEmailTool,
  createReplyToEmailTool,
  createResearchTool,
} from "@/lib/tools";

// SAFETY LIMITS to prevent runaway API costs
const MAX_TOOL_STEPS = 25;

type ScheduledJob = Database["public"]["Tables"]["scheduled_jobs"]["Row"];
type ActionPayload = {
  message?: string;
  instruction?: string;
  taskId?: string;
  preferred_channel?: string;
};

/**
 * Execute a scheduled job using Inngest for durable execution
 * Replaces the broken Vercel Workflow implementation
 */
export const executeScheduledJob = inngest.createFunction(
  {
    id: "execute-scheduled-job",
    retries: 3,
    concurrency: {
      limit: 5, // Prevent too many concurrent AI calls
    },
  },
  { event: "job/scheduled.execute" },
  async ({ event, step }) => {
    const { job } = event.data as { job: ScheduledJob };
    const supabase = getAdminClient();

    console.log(`[inngest:execute-job] Starting job ${job.id}: ${job.title}`);

    // Step 1: Create execution record
    const execution = await step.run("create-execution-record", async () => {
      const { execution } = await createJobExecution(
        supabase,
        job.id,
        job.agent_id,
        "running"
      );
      return execution;
    });

    try {
      let result: { success: boolean; data?: unknown; error?: string };

      // Step 2: Execute based on action type
      switch (job.action_type) {
        case "notify":
          result = await step.run("execute-notify", async () => {
            return await executeNotifyAction(supabase, job);
          });
          break;

        case "agent_task":
          result = await step.run("execute-agent-task", async () => {
            return await executeAgentTaskAction(supabase, job);
          });
          break;

        case "webhook":
          result = await step.run("execute-webhook", async () => {
            return await executeWebhookAction(job);
          });
          break;

        default:
          result = {
            success: false,
            error: `Unknown action type: ${job.action_type}`,
          };
      }

      // Step 3: Update execution record
      if (execution) {
        await step.run("update-execution-success", async () => {
          await updateJobExecution(
            supabase,
            execution.id,
            result.success ? "success" : "failed",
            result.data as Record<string, unknown> | undefined,
            result.error
          );
        });
      }

      // Step 4: Mark job as executed
      if (result.success) {
        await step.run("mark-job-executed", async () => {
          await markJobExecuted(supabase, job.id, job);
        });
      } else {
        await step.run("mark-job-failed", async () => {
          await markJobFailed(supabase, job.id, job, result.error || "Unknown error");
        });
      }

      console.log(`[inngest:execute-job] Completed job ${job.id}: ${result.success ? "success" : "failed"}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[inngest:execute-job] Error in job ${job.id}:`, errorMessage);

      // Update execution record with failure
      if (execution) {
        await step.run("update-execution-failed", async () => {
          await updateJobExecution(supabase, execution.id, "failed", undefined, errorMessage);
        });
      }

      // Use circuit breaker pattern
      await step.run("apply-circuit-breaker", async () => {
        const result = await markJobFailed(supabase, job.id, job, errorMessage);
        if (result.paused) {
          console.log(`[inngest:execute-job] Job ${job.id} paused after repeated failures`);
        }
      });

      throw error; // Re-throw so Inngest can retry if needed
    }
  }
);

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
 * Execute an agent task action - runs the AI agent with full tool access
 */
async function executeAgentTaskAction(
  supabase: ReturnType<typeof getAdminClient>,
  job: ScheduledJob
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const payload = job.action_payload as ActionPayload;
  const instruction = payload?.instruction || job.description || "Execute scheduled task";

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
    .insert({
      agent_id: job.agent_id,
      channel_type: "app",
      status: "active",
      title: `Scheduled: ${job.title}`,
    })
    .select("id")
    .single();

  if (convError || !newConv) {
    return { success: false, error: "Could not create conversation" };
  }

  const conversationId = newConv.id;
  const userMessage = `[Scheduled Task: ${job.title}]\n\n${instruction}`;

  // Save user message
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: userMessage,
    metadata: { type: "scheduled_agent_task", job_id: job.id },
  });

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(agent, {
    id: agent.userId,
    name: profile?.name || "User",
    timezone: profile?.timezone || undefined,
    email: profile?.email || undefined,
  });

  // Create comprehensive tools for the agent
  const tools = createAgentTools(supabase, job.agent_id, payload?.taskId, conversationId);

  let finalResponse = "";

  try {
    // Use generateText for background jobs (returns complete result with tool calls)
    const result = await generateText({
      model: gateway("openai/gpt-4o"),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools,
      toolChoice: "auto",
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
    });

    // Extract the final text response
    finalResponse = result.text || "Task completed.";
    
    console.log(`[inngest:execute-job] Agent completed job ${job.id}`);
  } catch (agentError) {
    const errorMsg = agentError instanceof Error ? agentError.message : "Agent execution failed";
    console.error(`[inngest:execute-job] Agent error for job ${job.id}:`, errorMsg);

    // Save error message to conversation
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: `I encountered an error while executing this scheduled task: ${errorMsg}`,
      metadata: { type: "scheduled_agent_task", job_id: job.id, error: true },
    });

    throw new Error(`Agent failed: ${errorMsg}`);
  }

  // Save the agent's response to the database
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: finalResponse,
    metadata: { type: "scheduled_agent_task", job_id: job.id },
  });

  // Log activity
  await logActivity(supabase, {
    agentId: job.agent_id,
    activityType: "cron_execution",
    source: "cron",
    title: `Completed: ${job.title}`,
    description: finalResponse.substring(0, 200),
    conversationId,
    jobId: job.id,
    status: "completed",
  });

  // Create notification
  await createNotification(
    supabase,
    job.agent_id,
    "task_update",
    `Scheduled task completed: ${job.title}`,
    finalResponse.substring(0, 200),
    "conversation",
    conversationId
  );

  return {
    success: true,
    data: { conversationId, instruction, response: finalResponse.substring(0, 500) },
  };
}

/**
 * Execute a webhook action
 */
async function executeWebhookAction(
  job: ScheduledJob
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const payload = job.action_payload as {
    url?: string;
    body?: unknown;
    headers?: Record<string, string>;
  };

  if (!payload?.url) {
    return { success: false, error: "No webhook URL specified" };
  }

  const response = await fetch(payload.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(payload.headers || {}) },
    body: JSON.stringify({
      job_id: job.id,
      job_type: job.job_type,
      title: job.title,
      ...((payload.body as object) || {}),
    }),
  });

  if (!response.ok) {
    return { success: false, error: `Webhook returned ${response.status}` };
  }

  const responseData = await response.json().catch(() => ({}));
  return { success: true, data: responseData };
}

/**
 * Create all tools available to the agent during scheduled task execution
 */
function createAgentTools(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string,
  taskId?: string,
  conversationId?: string
) {
  return {
    // Email tools from lib/tools
    checkEmail: createCheckEmailTool(agentId),
    sendEmail: createSendEmailTool(agentId),
    replyToEmail: createReplyToEmailTool(agentId),

    // Research tool
    research: createResearchTool(agentId),

    // Task management tools
    createTask: tool({
      description: "Create a new task",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        assigneeType: z.enum(["user", "agent"]).optional(),
      }),
      execute: async ({ title, description, priority, assigneeType }: { title: string; description?: string; priority?: "high" | "medium" | "low"; assigneeType?: "user" | "agent" }) => {
        const { generateEmbedding } = await import("@/lib/embeddings");

        let assigneeId: string | null = null;
        if (assigneeType === "agent") {
          assigneeId = agentId;
        } else if (assigneeType === "user") {
          const { data: agentData } = await supabase
            .from("agents")
            .select("user_id")
            .eq("id", agentId)
            .single();
          assigneeId = agentData?.user_id || null;
        }

        const embedding = await generateEmbedding(title);
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            title,
            description,
            priority: priority || "medium",
            status: "todo",
            assignee_type: assigneeType,
            assignee_id: assigneeId,
            embedding,
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, task: data };
      },
    }),

    updateTask: tool({
      description: "Update an existing task's status, priority, or details",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to update"),
        status: z.enum(["todo", "in_progress", "waiting_on", "done"]).optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ taskId: tid, status, priority, title, description }: { taskId: string; status?: "todo" | "in_progress" | "waiting_on" | "done"; priority?: "high" | "medium" | "low"; title?: string; description?: string }) => {
        const updates: Record<string, unknown> = {};
        if (status) updates.status = status;
        if (priority) updates.priority = priority;
        if (title) updates.title = title;
        if (description) updates.description = description;
        if (status === "done") updates.completed_at = new Date().toISOString();

        const { data, error } = await supabase
          .from("tasks")
          .update(updates)
          .eq("id", tid)
          .eq("agent_id", agentId)
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, task: data };
      },
    }),

    addComment: tool({
      description: "Add a comment to a task to log progress or notes",
      inputSchema: z.object({
        targetTaskId: z
          .string()
          .optional()
          .describe("Task ID to comment on. If not provided, uses the linked task."),
        content: z.string(),
        commentType: z
          .enum(["progress", "note", "question", "resolution"])
          .optional()
          .default("progress"),
      }),
      execute: async ({ targetTaskId, content, commentType }: { targetTaskId?: string; content: string; commentType?: "progress" | "note" | "question" | "resolution" }) => {
        const tid = targetTaskId || taskId;
        if (!tid) return { success: false, error: "No task specified" };

        const { data, error } = await supabase
          .from("comments")
          .insert({
            task_id: tid,
            author_type: "agent",
            author_id: agentId,
            content,
            comment_type: commentType || "progress",
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, commentId: data.id };
      },
    }),

    scheduleReminder: tool({
      description: "Schedule a reminder for later",
      inputSchema: z.object({
        title: z.string(),
        message: z.string(),
        runAt: z.string().optional().describe("ISO datetime for one-time reminders"),
        cronExpression: z.string().optional().describe("Cron expression for recurring reminders"),
      }),
      execute: async ({ title, message, runAt, cronExpression }: { title: string; message: string; runAt?: string; cronExpression?: string }) => {
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

    scheduleAgentTask: tool({
      description: "Schedule the agent to perform a task later with full tool access",
      inputSchema: z.object({
        title: z.string().describe("Name for the scheduled task"),
        instruction: z.string().describe("What the agent should do when the task runs"),
        runAt: z.string().optional().describe("ISO datetime for one-time tasks"),
        cronExpression: z.string().optional().describe("Cron expression for recurring tasks"),
      }),
      execute: async ({ title, instruction, runAt, cronExpression }: { title: string; instruction: string; runAt?: string; cronExpression?: string }) => {
        if (!runAt && !cronExpression) {
          return {
            success: false,
            error: "Must provide either 'runAt' for one-time or 'cronExpression' for recurring tasks",
          };
        }

        const { createScheduledJob } = await import("@/lib/db/scheduled-jobs");
        const { success, job, error } = await createScheduledJob(supabase, {
          agentId,
          jobType: cronExpression ? "recurring" : "one_time",
          title,
          description: instruction,
          scheduleType: cronExpression ? "cron" : "once",
          runAt,
          cronExpression,
          actionType: "agent_task",
          actionPayload: { instruction },
        });
        if (!success || error) return { success: false, error: error || "Failed" };
        return { success: true, jobId: job?.id, nextRunAt: job?.next_run_at };
      },
    }),

    listProjects: tool({
      description: "List all projects",
      inputSchema: z.object({
        status: z.enum(["active", "paused", "completed", "all"]).optional().default("active"),
      }),
      execute: async ({ status }: { status?: "active" | "paused" | "completed" | "all" }) => {
        let query = supabase
          .from("projects")
          .select("id, title, description, status, priority, created_at")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false });
        if (status && status !== "all") query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, projects: data, count: data?.length || 0 };
      },
    }),

    getProject: tool({
      description: "Get details of a specific project by ID",
      inputSchema: z.object({
        projectId: z.string().describe("The project ID"),
      }),
      execute: async ({ projectId }: { projectId: string }) => {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("agent_id", agentId)
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, project: data };
      },
    }),

    getTask: tool({
      description: "Get details of a specific task by ID",
      inputSchema: z.object({
        taskId: z.string().describe("The task ID"),
      }),
      execute: async ({ taskId: tid }: { taskId: string }) => {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", tid)
          .eq("agent_id", agentId)
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, task: data };
      },
    }),

    listTasks: tool({
      description: "List tasks with optional status filter",
      inputSchema: z.object({
        status: z
          .enum(["todo", "in_progress", "waiting_on", "done", "all"])
          .optional()
          .default("all"),
        limit: z.number().optional().default(20),
      }),
      execute: async ({ status, limit }: { status?: "todo" | "in_progress" | "waiting_on" | "done" | "all"; limit?: number }) => {
        let query = supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, created_at")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false })
          .limit(limit || 20);
        if (status && status !== "all") query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, tasks: data, count: data?.length || 0 };
      },
    }),

    searchMemory: tool({
      description:
        "Search your memory for relevant information from past conversations, projects, tasks, and context",
      inputSchema: z.object({
        query: z.string().describe("What to search for"),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        const { semanticSearchAll, formatContextForAI } = await import("@/lib/db/search");
        const results = await semanticSearchAll(supabase, query, agentId, {
          matchCount: limit,
          matchThreshold: 0.5,
        });
        return { success: true, results: formatContextForAI(results), count: results.length };
      },
    }),

    saveToMemory: tool({
      description: "Save important information to memory for future reference",
      inputSchema: z.object({
        title: z.string().describe("Title or label for this memory"),
        content: z.string().describe("The content to remember"),
        category: z.enum(["note", "fact", "preference", "context"]).optional().default("note"),
      }),
      execute: async ({ title, content, category }: { title: string; content: string; category?: "note" | "fact" | "preference" | "context" }) => {
        const { generateEmbedding } = await import("@/lib/embeddings");
        const embedding = await generateEmbedding(`${title}\n\n${content}`);

        const { data, error } = await supabase
          .from("memories")
          .insert({
            agent_id: agentId,
            title,
            content,
            category,
            embedding,
          })
          .select("id")
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, memoryId: data.id, message: `Saved: ${title}` };
      },
    }),
  };
}
