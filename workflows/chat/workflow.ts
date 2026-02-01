import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { tool } from "ai";
import { z } from "zod";
import type { ModelMessage, UIMessageChunk } from "ai";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt, getAgentById } from "@/lib/db/agents";

/**
 * Chat workflow for durable AI agent conversations
 * Used for background channels (cron, email) where durability matters
 */
export async function chatWorkflow(params: {
  messages: ModelMessage[];
  agentId: string;
  conversationId: string;
  userId: string;
  channelSource: string;
  channelMetadata?: Record<string, unknown>;
}) {
  "use workflow";

  const { messages, agentId, conversationId, userId, channelSource } = params;
  const supabase = getAdminClient();

  // Get agent configuration
  const agent = await getAgentById(supabase, agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name, timezone, email")
    .eq("user_id", userId)
    .single();

  // Build system prompt
  const systemPrompt = buildSystemPrompt(
    agent,
    {
      id: userId,
      name: profile?.name || "User",
      timezone: profile?.timezone || undefined,
      email: profile?.email || undefined,
    },
    channelSource as "app" | "slack" | "email" | "linkedin"
  );

  // Get writable stream for output
  const writable = getWritable<UIMessageChunk>();

  // Create durable agent with tools
  const durableAgent = new DurableAgent({
    model: "anthropic/claude-sonnet-4",
    system: systemPrompt,
    tools: createDurableTools(supabase, agentId),
  });

  // Run the agent
  await durableAgent.stream({
    messages,
    writable,
  });
}

/**
 * Create durable tools for the agent
 */
function createDurableTools(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string
) {
  return {
    searchMemory: tool({
      description: "Search your memory for relevant information",
      inputSchema: z.object({
        query: z.string().describe("What to search for"),
      }),
      execute: async ({ query }) => {
        "use step";
        const { semanticSearchAll, formatContextForAI } = await import("@/lib/db/search");
        const results = await semanticSearchAll(supabase, query, agentId, {
          matchCount: 10,
          matchThreshold: 0.65,
        });
        return { success: true, results: formatContextForAI(results), count: results.length };
      },
    }),

    saveToMemory: tool({
      description: "Save important information to memory",
      inputSchema: z.object({
        content: z.string().describe("The content to save"),
        title: z.string().optional().describe("Optional title"),
      }),
      execute: async ({ content, title }) => {
        "use step";
        const { generateEmbedding } = await import("@/lib/embeddings");
        const embedding = await generateEmbedding(content);
        const { data, error } = await supabase
          .from("context_blocks")
          .insert({
            agent_id: agentId,
            type: "memory",
            title: title || "Memory",
            content,
            embedding,
          })
          .select()
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, id: data.id };
      },
    }),

    createTask: tool({
      description: "Create a new task",
      inputSchema: z.object({
        title: z.string().describe("Task title"),
        description: z.string().optional().describe("Task description"),
        priority: z.enum(["high", "medium", "low"]).optional(),
        dueDate: z.string().optional().describe("Due date (ISO format)"),
        assigneeType: z.enum(["user", "agent"]).optional(),
      }),
      execute: async ({ title, description, priority, dueDate, assigneeType }) => {
        "use step";
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

        const embedding = await generateEmbedding(description ? `${title}\n\n${description}` : title);

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            title,
            description: description || null,
            priority: priority || "medium",
            status: "todo",
            due_date: dueDate || null,
            assignee_type: assigneeType || null,
            assignee_id: assigneeId,
            embedding,
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, task: data };
      },
    }),

    listTasks: tool({
      description: "List tasks",
      inputSchema: z.object({
        status: z.enum(["todo", "in_progress", "waiting_on", "done", "all"]).optional(),
        assigneeType: z.enum(["user", "agent"]).optional(),
      }),
      execute: async ({ status, assigneeType }) => {
        "use step";
        let query = supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, assignee_type")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false });

        if (status && status !== "all") query = query.eq("status", status);
        if (assigneeType) query = query.eq("assignee_type", assigneeType);

        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, tasks: data, count: data.length };
      },
    }),

    completeTask: tool({
      description: "Mark a task as complete",
      inputSchema: z.object({
        taskId: z.string().describe("The task ID"),
      }),
      execute: async ({ taskId }) => {
        "use step";
        const { data, error } = await supabase
          .from("tasks")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", taskId)
          .eq("agent_id", agentId)
          .select()
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, task: data };
      },
    }),

    scheduleReminder: tool({
      description: "Schedule a reminder notification",
      inputSchema: z.object({
        title: z.string().describe("Reminder title"),
        message: z.string().describe("Reminder message"),
        runAt: z.string().optional().describe("When to run (ISO datetime)"),
        cronExpression: z.string().optional().describe("Cron expression for recurring"),
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

    scheduleAgentTask: tool({
      description: "Schedule the agent to execute a task at a specific time",
      inputSchema: z.object({
        title: z.string().describe("Task title"),
        instruction: z.string().describe("What the agent should do"),
        runAt: z.string().optional().describe("When to run (ISO datetime)"),
        cronExpression: z.string().optional().describe("Cron expression for recurring"),
      }),
      execute: async ({ title, instruction, runAt, cronExpression }) => {
        "use step";
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

    addComment: tool({
      description: "Add a comment to a task or project",
      inputSchema: z.object({
        taskId: z.string().optional().describe("Task ID"),
        projectId: z.string().optional().describe("Project ID"),
        content: z.string().describe("Comment content"),
        commentType: z.enum(["progress", "question", "note", "resolution"]).optional(),
      }),
      execute: async ({ taskId, projectId, content, commentType }) => {
        "use step";
        const { data, error } = await supabase
          .from("comments")
          .insert({
            task_id: taskId || null,
            project_id: projectId || null,
            author_type: "agent",
            author_id: agentId,
            content,
            comment_type: commentType || "note",
          })
          .select()
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, commentId: data.id };
      },
    }),
  };
}
