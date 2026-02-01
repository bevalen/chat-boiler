import { ToolLoopAgent, tool, gateway, stepCountIs, hasToolCall, StopCondition, ToolSet } from "ai";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { createScheduledJob } from "@/lib/db/scheduled-jobs";
import { createNotification } from "@/lib/db/notifications";
import { generateEmbedding } from "@/lib/embeddings";
import { Database, TaskStatus, AgentRunState, CommentType } from "@/lib/types/database";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];
type Comment = Database["public"]["Tables"]["comments"]["Row"];

/**
 * Context gathered for a task that the background agent will work on
 */
export interface TaskContext {
  task: Task;
  project: Project | null;
  comments: Comment[];
  blockingTasks: Task[];
  relatedContext: string;
  scheduledJobs: Array<{
    id: string;
    title: string;
    next_run_at: string | null;
  }>;
}

/**
 * Result of a background agent run
 */
export interface BackgroundAgentResult {
  success: boolean;
  taskId: string;
  finalStatus: TaskStatus;
  stepsCompleted: number;
  summary: string;
  error?: string;
}

/**
 * Build the system prompt for the background agent based on task context
 */
function buildBackgroundAgentPrompt(context: TaskContext): string {
  const sections: string[] = [];

  sections.push(`You are an autonomous AI assistant working on a specific task in the background.`);
  sections.push(`Your goal is to make as much progress as possible on this task, then either:`);
  sections.push(`1. Complete the task if you can finish it`);
  sections.push(`2. Request human input if you're blocked and need information`);
  sections.push(`3. Schedule a follow-up if you need to wait for something external (like an email reply)`);
  sections.push(``);

  // Current task
  sections.push(`## YOUR CURRENT TASK`);
  sections.push(`**Title:** ${context.task.title}`);
  sections.push(`**Status:** ${context.task.status}`);
  sections.push(`**Priority:** ${context.task.priority}`);
  if (context.task.description) {
    sections.push(`**Description:** ${context.task.description}`);
  }
  if (context.task.due_date) {
    sections.push(`**Due Date:** ${new Date(context.task.due_date).toLocaleDateString()}`);
  }
  sections.push(``);

  // Project context
  if (context.project) {
    sections.push(`## PROJECT CONTEXT`);
    sections.push(`**Project:** ${context.project.title}`);
    if (context.project.description) {
      sections.push(`**Description:** ${context.project.description}`);
    }
    sections.push(``);
  }

  // Blocking tasks
  if (context.blockingTasks.length > 0) {
    sections.push(`## BLOCKING TASKS`);
    sections.push(`These tasks must be completed before this task can be finished:`);
    context.blockingTasks.forEach((t) => {
      sections.push(`- [${t.status}] ${t.title}`);
    });
    sections.push(``);
  }

  // Previous progress (comments)
  if (context.comments.length > 0) {
    sections.push(`## PREVIOUS PROGRESS`);
    sections.push(`Here's what has happened on this task so far (oldest first):`);
    // Reverse to show oldest first for context
    [...context.comments].reverse().forEach((c) => {
      const date = c.created_at ? new Date(c.created_at).toLocaleString() : "Unknown";
      const author = c.author_type === "agent" ? "Agent" : "User";
      sections.push(`[${date}] ${author} (${c.comment_type}): ${c.content}`);
    });
    sections.push(``);
  }

  // Related context from semantic search
  if (context.relatedContext) {
    sections.push(`## RELATED CONTEXT`);
    sections.push(context.relatedContext);
    sections.push(``);
  }

  // Scheduled follow-ups
  if (context.scheduledJobs.length > 0) {
    sections.push(`## SCHEDULED FOLLOW-UPS`);
    context.scheduledJobs.forEach((job) => {
      const runAt = job.next_run_at ? new Date(job.next_run_at).toLocaleString() : "Unknown";
      sections.push(`- ${job.title} (scheduled for: ${runAt})`);
    });
    sections.push(``);
  }

  // Instructions
  sections.push(`## INSTRUCTIONS`);
  sections.push(`1. First, review the task and all available context`);
  sections.push(`2. Log a progress comment explaining what you're about to do`);
  sections.push(`3. Work on the task step by step, logging progress as you go`);
  sections.push(`4. If you complete the task, use markTaskComplete with a resolution summary`);
  sections.push(`5. If you need human input, use requestHumanInput to pause and notify the user`);
  sections.push(`6. If you need to wait for something external, use scheduleFollowUp to check back later`);
  sections.push(`7. You can create subtasks to break down complex work`);
  sections.push(``);
  sections.push(`**IMPORTANT:** Always log your progress so there's a clear trail of what was done.`);

  return sections.join("\n");
}

/**
 * Create the tools for the background agent
 */
function createBackgroundAgentTools(
  supabase: SupabaseClient,
  agentId: string,
  taskId: string
) {
  return {
    /**
     * Log progress on the current task
     */
    logProgress: tool({
      description: "Log a progress update on the current task. Use this to record what you're doing or have done.",
      inputSchema: z.object({
        content: z.string().describe("Description of the progress made"),
        commentType: z
          .enum(["progress", "note", "question"])
          .optional()
          .default("progress")
          .describe("Type of comment: progress update, note, or question"),
      }),
      execute: async ({ content, commentType }) => {
        const { data, error } = await supabase
          .from("comments")
          .insert({
            task_id: taskId,
            author_type: "agent",
            author_id: agentId,
            content,
            comment_type: commentType as CommentType,
          })
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          commentId: data.id,
          message: `Progress logged: ${content.substring(0, 100)}...`,
        };
      },
    }),

    /**
     * Mark the task as complete with a resolution
     */
    markTaskComplete: tool({
      description: "Mark the current task as done and log what was accomplished. This stops the agent.",
      inputSchema: z.object({
        resolution: z.string().describe("Summary of what was accomplished and how the task was completed"),
      }),
      execute: async ({ resolution }) => {
        // Add resolution comment
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: resolution,
          comment_type: "resolution",
        });

        // Update task status
        const { data, error } = await supabase
          .from("tasks")
          .update({
            status: "done" as TaskStatus,
            completed_at: new Date().toISOString(),
            agent_run_state: "completed" as AgentRunState,
            last_agent_run_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .select("title")
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        // Create notification
        await createNotification(
          supabase,
          agentId,
          "task_update",
          `Task completed: ${data.title}`,
          resolution.substring(0, 200),
          "task",
          taskId
        );

        return {
          success: true,
          message: `Task marked as complete: ${resolution.substring(0, 100)}...`,
          stopped: true,
        };
      },
    }),

    /**
     * Request human input - pauses the task and notifies the user
     */
    requestHumanInput: tool({
      description: "Request input from the human. Use when you're blocked and need information or a decision. This stops the agent.",
      inputSchema: z.object({
        question: z.string().describe("What do you need from the human?"),
        context: z.string().optional().describe("Additional context to help them understand what you need"),
      }),
      execute: async ({ question, context }) => {
        const commentContent = context
          ? `**Waiting for input:** ${question}\n\n${context}`
          : `**Waiting for input:** ${question}`;

        // Add question comment
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: commentContent,
          comment_type: "question",
        });

        // Update task status to waiting_on
        const { data, error } = await supabase
          .from("tasks")
          .update({
            status: "waiting_on" as TaskStatus,
            agent_run_state: "needs_input" as AgentRunState,
            last_agent_run_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .select("title")
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        // Create notification for the user
        await createNotification(
          supabase,
          agentId,
          "task_update",
          `Input needed: ${data.title}`,
          question.substring(0, 200),
          "task",
          taskId
        );

        return {
          success: true,
          message: `Requested human input: ${question}`,
          stopped: true,
        };
      },
    }),

    /**
     * Schedule a follow-up to check back on this task later
     */
    scheduleFollowUp: tool({
      description: "Schedule yourself to check back on this task at a specific time. Use when waiting for external events like email replies.",
      inputSchema: z.object({
        reason: z.string().describe("Why you need to follow up"),
        checkAt: z.string().describe("When to check back (ISO datetime, e.g., '2024-01-15T10:00:00Z')"),
        instruction: z.string().optional().describe("Specific instruction for what to check when following up"),
      }),
      execute: async ({ reason, checkAt, instruction }) => {
        // Validate the date
        const checkDate = new Date(checkAt);
        if (isNaN(checkDate.getTime())) {
          return { success: false, error: "Invalid date format. Use ISO format like '2024-01-15T10:00:00Z'" };
        }

        // Log a comment about the follow-up
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Scheduled follow-up for ${checkDate.toLocaleString()}: ${reason}`,
          comment_type: "note",
        });

        // Get task title for the job
        const { data: task } = await supabase
          .from("tasks")
          .select("title")
          .eq("id", taskId)
          .single();

        // Create scheduled job
        const jobInstruction = instruction || `Follow up on task: ${reason}`;
        const { success, job, error } = await createScheduledJob(supabase, {
          agentId,
          jobType: "follow_up",
          title: `Follow-up: ${task?.title || "Task"}`,
          description: reason,
          scheduleType: "once",
          runAt: checkAt,
          actionType: "agent_task",
          actionPayload: {
            instruction: jobInstruction,
            taskId,
          },
          taskId,
        });

        if (!success || error) {
          return { success: false, error: error || "Failed to create scheduled job" };
        }

        return {
          success: true,
          jobId: job?.id,
          scheduledFor: checkAt,
          message: `Follow-up scheduled for ${checkDate.toLocaleString()}: ${reason}`,
        };
      },
    }),

    /**
     * Create a subtask to break down complex work
     */
    createSubtask: tool({
      description: "Create a subtask to break down complex work into smaller pieces",
      inputSchema: z.object({
        title: z.string().describe("Title of the subtask"),
        description: z.string().optional().describe("Description of what needs to be done"),
        priority: z.enum(["high", "medium", "low"]).optional().describe("Priority level"),
        assignToAgent: z.boolean().optional().default(true).describe("Whether to assign this subtask to the agent (true) or user (false)"),
      }),
      execute: async ({ title, description, priority, assignToAgent }) => {
        // Get the current task's project_id
        const { data: currentTask } = await supabase
          .from("tasks")
          .select("project_id")
          .eq("id", taskId)
          .single();

        // Generate embedding
        const textToEmbed = description ? `${title}\n\n${description}` : title;
        let embedding: number[] | null = null;
        try {
          embedding = await generateEmbedding(textToEmbed);
        } catch (e) {
          console.error("Error generating subtask embedding:", e);
        }

        // Resolve assignee
        let assigneeId: string | null = null;
        const assigneeType = assignToAgent ? "agent" : "user";
        
        if (assignToAgent) {
          assigneeId = agentId;
        } else {
          const { data: agent } = await supabase
            .from("agents")
            .select("user_id")
            .eq("id", agentId)
            .single();
          assigneeId = agent?.user_id || null;
        }

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            project_id: currentTask?.project_id || null,
            title,
            description: description || null,
            priority: priority || "medium",
            status: "todo" as TaskStatus,
            assignee_type: assigneeType,
            assignee_id: assigneeId,
            blocked_by: [taskId], // Subtask is blocked by parent
            embedding,
          })
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        // Log that we created a subtask
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Created subtask: "${title}"`,
          comment_type: "progress",
        });

        return {
          success: true,
          subtaskId: data.id,
          title: data.title,
          message: `Created subtask: ${title}`,
        };
      },
    }),

    /**
     * Update the current task's status
     */
    updateTaskStatus: tool({
      description: "Update the current task's status without completing it",
      inputSchema: z.object({
        status: z.enum(["todo", "in_progress", "waiting_on"]).describe("New status for the task"),
        reason: z.string().optional().describe("Why the status is changing"),
      }),
      execute: async ({ status, reason }) => {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: status as TaskStatus,
          })
          .eq("id", taskId);

        if (error) {
          return { success: false, error: error.message };
        }

        // Log status change
        if (reason) {
          await supabase.from("comments").insert({
            task_id: taskId,
            author_type: "agent",
            author_id: agentId,
            content: `Status changed to ${status}: ${reason}`,
            comment_type: "status_change",
          });
        }

        return {
          success: true,
          newStatus: status,
          message: `Task status updated to ${status}`,
        };
      },
    }),

    /**
     * Search for relevant information
     */
    searchContext: tool({
      description: "Search your memory and database for relevant information related to this task",
      inputSchema: z.object({
        query: z.string().describe("What to search for"),
      }),
      execute: async ({ query }) => {
        // Use semantic search via RPC
        const embedding = await generateEmbedding(query);

        // Search messages
        const { data: messages } = await supabase.rpc("search_messages", {
          query_embedding: embedding,
          agent_id_filter: agentId,
          match_count: 5,
          match_threshold: 0.65,
        });

        // Search tasks
        const { data: tasks } = await supabase.rpc("search_tasks", {
          query_embedding: embedding,
          agent_id_filter: agentId,
          match_count: 3,
          match_threshold: 0.65,
        });

        // Search projects
        const { data: projects } = await supabase.rpc("search_projects", {
          query_embedding: embedding,
          agent_id_filter: agentId,
          match_count: 3,
          match_threshold: 0.65,
        });

        const results: string[] = [];

        if (messages && messages.length > 0) {
          results.push("**Related Conversations:**");
          messages.slice(0, 3).forEach((m: { content: string; role: string }) => {
            results.push(`- [${m.role}]: ${m.content.substring(0, 150)}...`);
          });
        }

        if (tasks && tasks.length > 0) {
          results.push("\n**Related Tasks:**");
          tasks.forEach((t: { title: string; status: string }) => {
            results.push(`- [${t.status}] ${t.title}`);
          });
        }

        if (projects && projects.length > 0) {
          results.push("\n**Related Projects:**");
          projects.forEach((p: { title: string; status: string }) => {
            results.push(`- [${p.status}] ${p.title}`);
          });
        }

        return {
          success: true,
          results: results.join("\n") || "No relevant context found",
          messageCount: messages?.length || 0,
          taskCount: tasks?.length || 0,
          projectCount: projects?.length || 0,
        };
      },
    }),
  };
}

/**
 * Create a background agent for autonomous task processing
 */
export function createBackgroundAgent(
  supabase: SupabaseClient,
  agentId: string,
  context: TaskContext
) {
  const tools = createBackgroundAgentTools(supabase, agentId, context.task.id);

  return new ToolLoopAgent({
    model: gateway("anthropic/claude-sonnet-4"),
    instructions: buildBackgroundAgentPrompt(context),
    tools,
    stopWhen: [
      stepCountIs(50), // Maximum 50 steps
      hasToolCall("markTaskComplete"),
      hasToolCall("requestHumanInput"),
    ],
    prepareStep: async ({ stepNumber, messages }) => {
      // Manage context window for long runs
      if (stepNumber > 15 && messages.length > 30) {
        // Keep system message and last 20 messages
        return {
          messages: [messages[0], ...messages.slice(-20)],
        };
      }
      return {};
    },
    onStepFinish: async ({ toolCalls, usage }) => {
      if (toolCalls && toolCalls.length > 0) {
        console.log(
          `[background-agent] Step completed: ${toolCalls.map((tc) => tc.toolName).join(", ")} (${usage?.totalTokens || 0} tokens)`
        );
      }
    },
  });
}

/**
 * Run the background agent on a task and return results
 */
export async function runBackgroundAgent(
  supabase: SupabaseClient,
  agentId: string,
  context: TaskContext
): Promise<BackgroundAgentResult> {
  const taskId = context.task.id;

  try {
    // Update task to running state
    await supabase.from("tasks").update({
      agent_run_state: "running" as AgentRunState,
      last_agent_run_at: new Date().toISOString(),
      lock_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min lock
    }).eq("id", taskId);

    // Create the agent
    const agent = createBackgroundAgent(supabase, agentId, context);

    // Run the agent
    const result = await agent.generate({
      prompt: `Begin working on the task: "${context.task.title}"`,
    });

    // Get final task status
    const { data: finalTask } = await supabase
      .from("tasks")
      .select("status, agent_run_state")
      .eq("id", taskId)
      .single();

    // Release lock
    await supabase.from("tasks").update({
      lock_expires_at: null,
    }).eq("id", taskId);

    return {
      success: true,
      taskId,
      finalStatus: (finalTask?.status || "in_progress") as TaskStatus,
      stepsCompleted: result.steps.length,
      summary: result.text || "Task processing completed",
    };
  } catch (error) {
    console.error("[background-agent] Error running agent:", error);

    // Update task to failed state
    await supabase.from("tasks").update({
      agent_run_state: "failed" as AgentRunState,
      failure_reason: error instanceof Error ? error.message : "Unknown error",
      lock_expires_at: null,
    }).eq("id", taskId);

    // Log the error as a comment
    await supabase.from("comments").insert({
      task_id: taskId,
      author_type: "agent",
      author_id: agentId,
      content: `Agent encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
      comment_type: "note",
    });

    return {
      success: false,
      taskId,
      finalStatus: context.task.status as TaskStatus,
      stepsCompleted: 0,
      summary: "Agent failed to complete task",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
