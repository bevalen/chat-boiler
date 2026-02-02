/**
 * Task management tools
 * Handles CRUD operations for tasks, subtasks, and task dependencies
 */

import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/embeddings";

export interface TaskToolContext {
  agentId: string;
  supabase: SupabaseClient<any>;
}

/**
 * Helper to resolve assignee ID from type
 */
async function resolveAssigneeId(
  supabase: SupabaseClient<any>,
  agentId: string,
  assigneeType: "user" | "agent" | undefined
): Promise<string | null> {
  if (!assigneeType) return null;
  if (assigneeType === "agent") return agentId;
  if (assigneeType === "user") {
    const { data: agentData } = await supabase
      .from("agents")
      .select("user_id")
      .eq("id", agentId)
      .single();
    return agentData?.user_id || null;
  }
  return null;
}

export function createTaskTools(context: TaskToolContext) {
  const { agentId, supabase } = context;

  return {
    createTask: tool({
      description: "Create a new task, optionally assigned to user or agent",
      inputSchema: z.object({
        title: z.string().describe("Task title"),
        description: z.string().optional().describe("Task description"),
        priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
        dueDate: z.string().optional().describe("Due date (ISO format)"),
        projectId: z.string().optional().describe("Project ID to link to"),
        assigneeType: z
          .enum(["user", "agent"])
          .optional()
          .describe(
            "Who should work on this: 'user' (the human owner) or 'agent' (AI assistant). ID is resolved automatically."
          ),
      }),
      execute: async ({
        title,
        description,
        priority,
        dueDate,
        projectId,
        assigneeType,
      }: {
        title: string;
        description?: string;
        priority?: "high" | "medium" | "low";
        dueDate?: string;
        projectId?: string;
        assigneeType?: "user" | "agent";
      }) => {
        const textToEmbed = description ? `${title}\n\n${description}` : title;
        const embedding = await generateEmbedding(textToEmbed);
        // Default to user if no assignee specified
        const effectiveAssigneeType = assigneeType || "user";
        const assigneeId = await resolveAssigneeId(supabase, agentId, effectiveAssigneeType);
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            title,
            description,
            priority: priority || "medium",
            status: "todo",
            due_date: dueDate || null,
            project_id: projectId || null,
            assignee_type: effectiveAssigneeType,
            assignee_id: assigneeId,
            embedding,
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return {
          success: true,
          task: {
            id: data.id,
            title: data.title,
            status: data.status,
            priority: data.priority,
            assigneeType: data.assignee_type,
          },
        };
      },
    }),

    listTasks: tool({
      description: "List tasks, optionally filtered by status, project, or assignee",
      inputSchema: z.object({
        status: z
          .enum(["todo", "in_progress", "waiting_on", "done", "all"])
          .optional()
          .default("all"),
        projectId: z.string().optional().describe("Filter by project"),
        assigneeType: z.enum(["user", "agent"]).optional().describe("Filter by assignee type"),
      }),
      execute: async ({
        status,
        projectId,
        assigneeType,
      }: {
        status?: "todo" | "in_progress" | "waiting_on" | "done" | "all";
        projectId?: string;
        assigneeType?: "user" | "agent";
      }) => {
        let query = supabase
          .from("tasks")
          .select(
            "id, title, description, status, priority, due_date, project_id, created_at, assignee_type, assignee_id, blocked_by"
          )
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false });

        if (status && status !== "all") query = query.eq("status", status);
        if (projectId) query = query.eq("project_id", projectId);
        if (assigneeType) query = query.eq("assignee_type", assigneeType);

        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, tasks: data, count: data?.length || 0 };
      },
    }),

    getTask: tool({
      description: "Get details of a specific task by ID, including assignee and dependencies",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to retrieve"),
      }),
      execute: async ({ taskId }: { taskId: string }) => {
        const { data, error } = await supabase
          .from("tasks")
          .select(
            "id, title, description, status, priority, due_date, project_id, created_at, completed_at, assignee_type, assignee_id, blocked_by, agent_run_state"
          )
          .eq("id", taskId)
          .eq("agent_id", agentId)
          .single();

        if (error) return { success: false, error: error.message };
        if (!data) return { success: false, error: "Task not found" };
        return { success: true, task: data };
      },
    }),

    updateTask: tool({
      description: "Update an existing task's details, status, or assignment",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to update"),
        title: z.string().optional().describe("New title for the task"),
        description: z.string().optional().describe("New description"),
        status: z
          .enum(["todo", "in_progress", "waiting_on", "done"])
          .optional()
          .describe("New status: todo, in_progress, waiting_on, or done"),
        priority: z.enum(["high", "medium", "low"]).optional().describe("New priority level"),
        dueDate: z.string().optional().describe("New due date in ISO format"),
        projectId: z.string().optional().describe("Project ID to link the task to"),
        assigneeType: z
          .enum(["user", "agent"])
          .optional()
          .describe(
            "Reassign to 'user' (the human owner) or 'agent' (AI assistant). ID is resolved automatically."
          ),
        blockedBy: z.array(z.string()).optional().describe("Array of task IDs that block this task"),
      }),
      execute: async ({
        taskId,
        title,
        description,
        status,
        priority,
        dueDate,
        projectId,
        assigneeType,
        blockedBy,
      }: {
        taskId: string;
        title?: string;
        description?: string;
        status?: "todo" | "in_progress" | "waiting_on" | "done";
        priority?: "high" | "medium" | "low";
        dueDate?: string;
        projectId?: string;
        assigneeType?: "user" | "agent";
        blockedBy?: string[];
      }) => {
        const updates: Record<string, unknown> = {};
        if (title) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (status) {
          updates.status = status;
          if (status === "done") {
            updates.completed_at = new Date().toISOString();
          }
        }
        if (priority) updates.priority = priority;
        if (dueDate !== undefined) updates.due_date = dueDate || null;
        if (projectId !== undefined) updates.project_id = projectId || null;
        if (assigneeType !== undefined) {
          updates.assignee_type = assigneeType;
          updates.assignee_id = await resolveAssigneeId(supabase, agentId, assigneeType);
        }
        if (blockedBy !== undefined) updates.blocked_by = blockedBy;

        // If title or description changed, regenerate embedding
        if (title || description !== undefined) {
          const { data: current } = await supabase
            .from("tasks")
            .select("title, description")
            .eq("id", taskId)
            .single();

          if (current) {
            const newTitle = title || current.title;
            const newDescription = description !== undefined ? description : current.description;
            const textToEmbed = newDescription ? `${newTitle}\n\n${newDescription}` : newTitle;
            try {
              updates.embedding = await generateEmbedding(textToEmbed);
            } catch (err) {
              console.error("Error generating task embedding:", err);
            }
          }
        }

        const { data, error } = await supabase
          .from("tasks")
          .update(updates)
          .eq("id", taskId)
          .eq("agent_id", agentId)
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return {
          success: true,
          task: {
            id: data.id,
            title: data.title,
            status: data.status,
            priority: data.priority,
            assigneeType: data.assignee_type,
          },
        };
      },
    }),

    completeTask: tool({
      description: "Mark a task as done (completed)",
      inputSchema: z.object({
        taskId: z.string().describe("Task ID to complete"),
      }),
      execute: async ({ taskId }: { taskId: string }) => {
        const { data, error } = await supabase
          .from("tasks")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", taskId)
          .eq("agent_id", agentId)
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, task: { id: data.id, title: data.title, status: "done" } };
      },
    }),

    deleteTask: tool({
      description: "Delete a task",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to delete"),
      }),
      execute: async ({ taskId }: { taskId: string }) => {
        // First verify the task belongs to this agent and get its title
        const { data: task, error: fetchError } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("id", taskId)
          .eq("agent_id", agentId)
          .single();

        if (fetchError || !task) {
          return { success: false, error: "Task not found or access denied" };
        }

        // Delete the task
        const { error: deleteError } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId)
          .eq("agent_id", agentId);

        if (deleteError) return { success: false, error: deleteError.message };
        return {
          success: true,
          message: `Task "${task.title}" has been deleted`,
          deletedTaskId: taskId,
        };
      },
    }),

    createSubtask: tool({
      description:
        "Create a subtask linked to a parent task. Useful for breaking down complex work.",
      inputSchema: z.object({
        parentTaskId: z.string().describe("The ID of the parent task"),
        title: z.string().describe("Title of the subtask"),
        description: z.string().optional().describe("Description of what needs to be done"),
        priority: z.enum(["high", "medium", "low"]).optional().describe("Priority level"),
        assigneeType: z
          .enum(["user", "agent"])
          .optional()
          .describe("Who should work on this subtask: 'user' or 'agent'. Defaults to agent."),
      }),
      execute: async ({
        parentTaskId,
        title,
        description,
        priority,
        assigneeType,
      }: {
        parentTaskId: string;
        title: string;
        description?: string;
        priority?: "high" | "medium" | "low";
        assigneeType?: "user" | "agent";
      }) => {
        // Get the parent task to inherit project_id
        const { data: parentTask, error: parentError } = await supabase
          .from("tasks")
          .select("id, title, project_id")
          .eq("id", parentTaskId)
          .eq("agent_id", agentId)
          .single();

        if (parentError || !parentTask) {
          return { success: false, error: "Parent task not found" };
        }

        // Resolve assignee
        const assignee = assigneeType || "agent";
        const assigneeId = await resolveAssigneeId(supabase, agentId, assignee);

        // Generate embedding
        const textToEmbed = description ? `${title}\n\n${description}` : title;
        let embedding: number[] | null = null;
        try {
          embedding = await generateEmbedding(textToEmbed);
        } catch (e) {
          console.error("Error generating subtask embedding:", e);
        }

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            project_id: parentTask.project_id,
            title,
            description: description || null,
            priority: priority || "medium",
            status: "todo",
            assignee_type: assignee,
            assignee_id: assigneeId,
            blocked_by: [parentTaskId],
            embedding,
          })
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        // Add a comment on the parent task
        await supabase.from("comments").insert({
          task_id: parentTaskId,
          author_type: "agent",
          author_id: agentId,
          content: `Created subtask: "${title}"`,
          comment_type: "progress",
        });

        return {
          success: true,
          subtask: { id: data.id, title: data.title, parentTaskId, parentTaskTitle: parentTask.title },
          message: `Created subtask "${title}" under "${parentTask.title}"`,
        };
      },
    }),
  };
}

// Type exports for UI components (AI SDK best practice)
export type TaskTools = ReturnType<typeof createTaskTools>;
export type CreateTaskToolInvocation = UIToolInvocation<TaskTools["createTask"]>;
export type ListTasksToolInvocation = UIToolInvocation<TaskTools["listTasks"]>;
export type GetTaskToolInvocation = UIToolInvocation<TaskTools["getTask"]>;
export type UpdateTaskToolInvocation = UIToolInvocation<TaskTools["updateTask"]>;
export type CompleteTaskToolInvocation = UIToolInvocation<TaskTools["completeTask"]>;
export type DeleteTaskToolInvocation = UIToolInvocation<TaskTools["deleteTask"]>;
export type CreateSubtaskToolInvocation = UIToolInvocation<TaskTools["createSubtask"]>;
