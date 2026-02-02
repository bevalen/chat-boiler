import { inngest } from "../client";
import { tool, generateText, stepCountIs, gateway } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt, getAgentById } from "@/lib/db/agents";
import { createNotification } from "@/lib/db/notifications";
import { logActivity } from "@/lib/db/activity-log";
import { createResearchTool } from "@/lib/tools";

// SAFETY LIMITS
const MAX_TOOL_STEPS_PER_TASK = 15;
const MAX_TASKS_PER_RUN = 10;

/**
 * Long-running project work agent
 * Processes project tasks over extended periods with durable execution
 * Can work on multiple tasks in a single run with checkpoints between each
 */
export const projectWorkAgent = inngest.createFunction(
  {
    id: "project-work-agent",
    retries: 3,
    concurrency: {
      limit: 2, // Limit concurrent project work to prevent cost runaway
      key: "event.data.projectId",
    },
  },
  { event: "project/work.start" },
  async ({ event, step }) => {
    const { projectId, agentId, instruction } = event.data;
    const supabase = getAdminClient();

    console.log(`[inngest:project-work] Starting work on project ${projectId}`);

    // Step 1: Load project and its tasks
    const project = await step.run("load-project", async () => {
      const { data: proj, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("agent_id", agentId)
        .single();

      if (error || !proj) {
        throw new Error(`Project not found: ${projectId}`);
      }

      return proj;
    });

    // Step 2: Load agent and user context
    const context = await step.run("load-context", async () => {
      const agent = await getAgentById(supabase, agentId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name, timezone, email")
        .eq("user_id", agent.userId)
        .single();

      const systemPrompt = await buildSystemPrompt(agent, {
        id: agent.userId,
        name: profile?.name || "User",
        timezone: profile?.timezone || undefined,
        email: profile?.email || undefined,
      });

      return { agent, profile, systemPrompt };
    });

    // Step 3: Load pending tasks for this project
    const tasks = await step.run("load-tasks", async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .eq("agent_id", agentId)
        .in("status", ["todo", "in_progress"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(MAX_TASKS_PER_RUN);

      if (error) {
        throw new Error(`Failed to load tasks: ${error.message}`);
      }

      return data || [];
    });

    if (tasks.length === 0) {
      console.log(`[inngest:project-work] No pending tasks for project ${projectId}`);
      
      // Mark project as completed if no tasks remain
      await step.run("check-project-completion", async () => {
        const { data: remainingTasks } = await supabase
          .from("tasks")
          .select("id")
          .eq("project_id", projectId)
          .neq("status", "done")
          .limit(1);

        if (!remainingTasks || remainingTasks.length === 0) {
          await supabase
            .from("projects")
            .update({ status: "completed" })
            .eq("id", projectId);

          await createNotification(
            supabase,
            agentId,
            "project_update",
            `Project completed: ${project.title}`,
            "All tasks have been completed.",
            "project",
            projectId
          );
        }
      });

      return { success: true, message: "No pending tasks", tasksProcessed: 0 };
    }

    // Step 4: Create or get conversation for this project work session
    const conversationId = await step.run("create-conversation", async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .insert({
          agent_id: agentId,
          channel_type: "app",
          status: "active",
          title: `Project Work: ${project.title}`,
        })
        .select("id")
        .single();

      return conv?.id;
    });

    // Step 5: Process each task (with durable checkpoints)
    const results: Array<{ taskId: string; title: string; success: boolean; error?: string }> = [];

    for (const task of tasks) {
      const taskResult = await step.run(`process-task-${task.id}`, async () => {
        console.log(`[inngest:project-work] Processing task: ${task.title}`);

        try {
          // Mark task as in progress
          await supabase
            .from("tasks")
            .update({ status: "in_progress" })
            .eq("id", task.id);

          // Create tools for this task
          const tools = createProjectTaskTools(supabase, agentId, task.id, projectId);

          // Build the prompt
          const taskPrompt = `
You are working on the project "${project.title}".

Current task: ${task.title}
${task.description ? `Description: ${task.description}` : ""}
Priority: ${task.priority || "medium"}
${instruction ? `\nAdditional instructions: ${instruction}` : ""}

Please work on this task. Use your available tools to:
1. Research if needed
2. Create subtasks if the work is complex
3. Add progress comments as you work
4. Mark the task as done when complete

Focus on making real progress. If you need more information or are blocked, update the task status to "waiting_on" and explain what you need.
`;

          // Run the AI agent
          const result = await generateText({
            model: gateway("anthropic/claude-sonnet-4.5"),
            system: context.systemPrompt,
            messages: [{ role: "user", content: taskPrompt }],
            tools,
            toolChoice: "auto",
            stopWhen: stepCountIs(MAX_TOOL_STEPS_PER_TASK),
          });

          // Get response text
          const response = result.text;

          // Save agent's work to conversation
          if (conversationId) {
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: `**Working on task: ${task.title}**\n\n${response}`,
              metadata: { type: "project_work", taskId: task.id, projectId },
            });
          }

          // Add a comment to the task
          await supabase.from("comments").insert({
            task_id: task.id,
            author_type: "agent",
            author_id: agentId,
            content: response.substring(0, 1000),
            comment_type: "progress",
          });

          return { taskId: task.id, title: task.title, success: true };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          console.error(`[inngest:project-work] Error processing task ${task.id}:`, errorMsg);

          // Add error comment
          await supabase.from("comments").insert({
            task_id: task.id,
            author_type: "agent",
            author_id: agentId,
            content: `Encountered an error while working on this task: ${errorMsg}`,
            comment_type: "note",
          });

          return { taskId: task.id, title: task.title, success: false, error: errorMsg };
        }
      });

      results.push(taskResult);

      // Optional: Add a small delay between tasks
      await step.sleep("task-cooldown", "5s");
    }

    // Step 6: Create summary and notification
    await step.run("create-summary", async () => {
      const successCount = results.filter((r) => r.success).length;
      const summary = `Processed ${results.length} tasks (${successCount} successful)`;

      // Log activity
      await logActivity(supabase, {
        agentId,
        activityType: "cron_execution",
        source: "cron",
        title: `Project work: ${project.title}`,
        description: summary,
        projectId,
        conversationId,
        status: "completed",
      });

      // Create notification
      await createNotification(
        supabase,
        agentId,
        "project_update",
        `Project work session completed: ${project.title}`,
        summary,
        "project",
        projectId
      );
    });

    console.log(`[inngest:project-work] Completed work on project ${projectId}`);
    return { success: true, tasksProcessed: results.length, results };
  }
);

/**
 * Create tools available during project task processing
 */
function createProjectTaskTools(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string,
  taskId: string,
  projectId: string
) {
  return {
    // Research tool
    research: createResearchTool(agentId),

    // Mark task as complete
    markTaskComplete: tool({
      description: "Mark the current task as complete",
      inputSchema: z.object({
        summary: z.string().describe("Brief summary of what was accomplished"),
      }),
      execute: async ({ summary }: { summary: string }) => {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: "done",
            completed_at: new Date().toISOString(),
          })
          .eq("id", taskId);

        if (error) return { success: false, error: error.message };

        // Add completion comment
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Task completed: ${summary}`,
          comment_type: "resolution",
        });

        return { success: true, message: "Task marked as complete" };
      },
    }),

    // Set task to waiting status
    setTaskWaiting: tool({
      description: "Mark the task as waiting for input or blocked",
      inputSchema: z.object({
        reason: z.string().describe("What the task is waiting for"),
      }),
      execute: async ({ reason }: { reason: string }) => {
        const { error } = await supabase
          .from("tasks")
          .update({ status: "waiting_on" })
          .eq("id", taskId);

        if (error) return { success: false, error: error.message };

        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Waiting: ${reason}`,
          comment_type: "question",
        });

        return { success: true, message: "Task marked as waiting" };
      },
    }),

    // Create a subtask
    createSubtask: tool({
      description: "Create a subtask under the current task",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
      }),
      execute: async ({ title, description, priority }: { title: string; description?: string; priority?: "high" | "medium" | "low" }) => {
        const { generateEmbedding } = await import("@/lib/embeddings");
        const embedding = await generateEmbedding(title);

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            project_id: projectId,
            parent_task_id: taskId,
            title,
            description,
            priority: priority || "medium",
            status: "todo",
            assignee_type: "agent",
            assignee_id: agentId,
            embedding,
          })
          .select("id, title")
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, subtask: data };
      },
    }),

    // Add progress note
    addProgressNote: tool({
      description: "Add a progress note to the current task",
      inputSchema: z.object({
        note: z.string().describe("The progress note to add"),
      }),
      execute: async ({ note }: { note: string }) => {
        const { error } = await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: note,
          comment_type: "progress",
        });

        if (error) return { success: false, error: error.message };
        return { success: true, message: "Note added" };
      },
    }),

    // Get project context
    getProjectContext: tool({
      description: "Get the full project context including all tasks",
      inputSchema: z.object({}),
      execute: async ({}: Record<string, never>) => {
        const { data: proj } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, status, priority, description")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });

        return { success: true, project: proj, tasks };
      },
    }),

    // Search memory for relevant context
    searchMemory: tool({
      description: "Search memory for relevant information",
      inputSchema: z.object({
        query: z.string().describe("What to search for"),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        const { semanticSearchAll, formatContextForAI } = await import("@/lib/db/search");
        const results = await semanticSearchAll(supabase, query, agentId, {
          matchCount: limit,
          matchThreshold: 0.5,
        });
        return { success: true, results: formatContextForAI(results) };
      },
    }),
  };
}
