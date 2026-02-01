import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { tool } from "ai";
import { z } from "zod";
import type { UIMessageChunk } from "ai";
import { getAdminClient } from "@/lib/supabase/admin";
import { gatherContextForTask } from "@/lib/db/search";

/**
 * Process a task assigned to the agent using a durable workflow
 */
export async function processTaskWorkflow(params: {
  taskId: string;
  agentId: string;
}) {
  "use workflow";

  const { taskId, agentId } = params;
  const supabase = getAdminClient();

  // Step 1: Lock the task and mark as running
  await lockTask(taskId);

  // Step 2: Gather context for the task
  const context = await gatherTaskContext(taskId, agentId);
  if (!context) {
    await failTask(taskId, "Failed to gather task context");
    return { success: false, error: "Failed to gather task context" };
  }

  // Step 3: Build the agent prompt
  const systemPrompt = buildTaskAgentPrompt(context);

  // Step 4: Create and run the durable agent
  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-sonnet-4",
    system: systemPrompt,
    tools: createTaskTools(supabase, agentId, taskId),
  });

  try {
    await agent.stream({
      messages: [
        {
          role: "user",
          content: `Begin working on the task: "${context.task.title}"`,
        },
      ],
      writable,
    });

    // Step 5: Get final task status
    const { data: finalTask } = await supabase
      .from("tasks")
      .select("status, agent_run_state")
      .eq("id", taskId)
      .single();

    // Step 6: Release lock
    await releaseLock(taskId);

    return {
      success: true,
      taskId,
      finalStatus: finalTask?.status || "in_progress",
    };
  } catch (error) {
    await failTask(taskId, error instanceof Error ? error.message : "Unknown error");
    return {
      success: false,
      taskId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function lockTask(taskId: string) {
  "use step";
  const supabase = getAdminClient();
  await supabase
    .from("tasks")
    .update({
      agent_run_state: "running",
      last_agent_run_at: new Date().toISOString(),
      lock_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq("id", taskId);
}

async function gatherTaskContext(taskId: string, agentId: string) {
  "use step";
  const supabase = getAdminClient();
  return await gatherContextForTask(supabase, agentId, taskId);
}

async function failTask(taskId: string, reason: string) {
  "use step";
  const supabase = getAdminClient();
  await supabase
    .from("tasks")
    .update({
      agent_run_state: "failed",
      failure_reason: reason,
      lock_expires_at: null,
    })
    .eq("id", taskId);

  await supabase.from("comments").insert({
    task_id: taskId,
    author_type: "system",
    content: `Task processing failed: ${reason}`,
    comment_type: "note",
  });
}

async function releaseLock(taskId: string) {
  "use step";
  const supabase = getAdminClient();
  await supabase.from("tasks").update({ lock_expires_at: null }).eq("id", taskId);
}

function buildTaskAgentPrompt(context: NonNullable<Awaited<ReturnType<typeof gatherContextForTask>>>) {
  const sections: string[] = [];

  sections.push(`You are an autonomous AI assistant working on a specific task.`);
  sections.push(``);

  sections.push(`## YOUR CURRENT TASK`);
  sections.push(`**Title:** ${context.task.title}`);
  sections.push(`**Status:** ${context.task.status}`);
  sections.push(`**Priority:** ${context.task.priority}`);
  if (context.task.description) {
    sections.push(`**Description:** ${context.task.description}`);
  }
  sections.push(``);

  if (context.project) {
    sections.push(`## PROJECT CONTEXT`);
    sections.push(`**Project:** ${context.project.title}`);
    sections.push(``);
  }

  if (context.comments.length > 0) {
    sections.push(`## PREVIOUS PROGRESS`);
    [...context.comments].reverse().slice(0, 10).forEach((c) => {
      sections.push(`[${c.author_type}] ${c.content}`);
    });
    sections.push(``);
  }

  if (context.relatedContext) {
    sections.push(`## RELATED CONTEXT`);
    sections.push(context.relatedContext);
    sections.push(``);
  }

  sections.push(`## INSTRUCTIONS`);
  sections.push(`1. Log progress as you work`);
  sections.push(`2. Use markTaskComplete when done`);
  sections.push(`3. Use requestHumanInput if blocked`);
  sections.push(`4. Use scheduleFollowUp to check back later`);

  return sections.join("\n");
}

function createTaskTools(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string,
  taskId: string
) {
  return {
    logProgress: tool({
      description: "Log progress on the current task",
      inputSchema: z.object({
        content: z.string().describe("Progress update"),
        commentType: z.enum(["progress", "note"]).optional(),
      }),
      execute: async ({ content, commentType }) => {
        "use step";
        const { data, error } = await supabase
          .from("comments")
          .insert({
            task_id: taskId,
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

    markTaskComplete: tool({
      description: "Mark the task as complete with a resolution summary",
      inputSchema: z.object({
        resolution: z.string().describe("What was accomplished"),
      }),
      execute: async ({ resolution }) => {
        "use step";
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: resolution,
          comment_type: "resolution",
        });

        const { data, error } = await supabase
          .from("tasks")
          .update({
            status: "done",
            completed_at: new Date().toISOString(),
            agent_run_state: "completed",
          })
          .eq("id", taskId)
          .select("title")
          .single();

        if (error) return { success: false, error: error.message };

        const { createNotification } = await import("@/lib/db/notifications");
        await createNotification(supabase, agentId, "task_update", `Task completed: ${data.title}`, resolution.substring(0, 200), "task", taskId);

        return { success: true, message: "Task completed", stopped: true };
      },
    }),

    requestHumanInput: tool({
      description: "Request input from the user - pauses the task",
      inputSchema: z.object({
        question: z.string().describe("What you need from the user"),
        context: z.string().optional().describe("Additional context"),
      }),
      execute: async ({ question, context }) => {
        "use step";
        const content = context ? `**Waiting for input:** ${question}\n\n${context}` : `**Waiting for input:** ${question}`;

        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content,
          comment_type: "question",
        });

        const { data, error } = await supabase
          .from("tasks")
          .update({ status: "waiting_on", agent_run_state: "needs_input" })
          .eq("id", taskId)
          .select("title")
          .single();

        if (error) return { success: false, error: error.message };

        const { createNotification } = await import("@/lib/db/notifications");
        await createNotification(supabase, agentId, "task_update", `Input needed: ${data.title}`, question.substring(0, 200), "task", taskId);

        return { success: true, message: "Requested human input", stopped: true };
      },
    }),

    scheduleFollowUp: tool({
      description: "Schedule a follow-up to check back on this task later",
      inputSchema: z.object({
        reason: z.string().describe("Why you need to follow up"),
        checkAt: z.string().describe("When to check (ISO datetime)"),
        instruction: z.string().optional().describe("What to do when following up"),
      }),
      execute: async ({ reason, checkAt, instruction }) => {
        "use step";
        const { createScheduledJob } = await import("@/lib/db/scheduled-jobs");

        const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single();

        const jobInstruction = instruction || `Follow up on task "${task?.title}": ${reason}`;
        const { success, job, error } = await createScheduledJob(supabase, {
          agentId,
          jobType: "follow_up",
          title: `Follow-up: ${task?.title || "Task"}`,
          description: reason,
          scheduleType: "once",
          runAt: checkAt,
          actionType: "agent_task",
          actionPayload: { instruction: jobInstruction, taskId },
          taskId,
        });

        if (!success || error) return { success: false, error: error || "Failed" };

        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Scheduled follow-up for ${new Date(checkAt).toLocaleString()}: ${reason}`,
          comment_type: "note",
        });

        return { success: true, jobId: job?.id, scheduledFor: checkAt };
      },
    }),

    createSubtask: tool({
      description: "Create a subtask to break down work",
      inputSchema: z.object({
        title: z.string().describe("Subtask title"),
        description: z.string().optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        assignToAgent: z.boolean().optional().default(true),
      }),
      execute: async ({ title, description, priority, assignToAgent }) => {
        "use step";
        const { generateEmbedding } = await import("@/lib/embeddings");

        const { data: parentTask } = await supabase.from("tasks").select("project_id").eq("id", taskId).single();

        let assigneeId: string | null = null;
        if (assignToAgent) {
          assigneeId = agentId;
        } else {
          const { data: agentData } = await supabase.from("agents").select("user_id").eq("id", agentId).single();
          assigneeId = agentData?.user_id || null;
        }

        const embedding = await generateEmbedding(description ? `${title}\n\n${description}` : title);

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            project_id: parentTask?.project_id || null,
            title,
            description: description || null,
            priority: priority || "medium",
            status: "todo",
            assignee_type: assignToAgent ? "agent" : "user",
            assignee_id: assigneeId,
            blocked_by: [taskId],
            embedding,
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };

        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Created subtask: "${title}"`,
          comment_type: "progress",
        });

        return { success: true, subtaskId: data.id, title: data.title };
      },
    }),

    searchContext: tool({
      description: "Search for relevant information",
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
  };
}
