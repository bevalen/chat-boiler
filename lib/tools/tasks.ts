import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";
import { createNotification } from "@/lib/db/notifications";

// Helper to resolve assignee ID from type
async function resolveAssigneeId(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string,
  assigneeType: "user" | "agent" | undefined
): Promise<string | null> {
  if (!assigneeType) return null;
  
  if (assigneeType === "agent") {
    // Assign to the agent itself
    return agentId;
  }
  
  if (assigneeType === "user") {
    // Look up the user_id from the agent
    const { data: agent } = await supabase
      .from("agents")
      .select("user_id")
      .eq("id", agentId)
      .single();
    
    return agent?.user_id || null;
  }
  
  return null;
}

export const createTaskTool = tool({
  description: "Create a new task, optionally linked to a project and assigned to a user or agent",
  inputSchema: z.object({
    title: z.string().describe("The title of the task"),
    description: z.string().optional().describe("A description of the task"),
    projectId: z
      .string()
      .optional()
      .describe("The ID of the project to link this task to"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("Priority level of the task"),
    dueDate: z
      .string()
      .optional()
      .describe("Due date in ISO format (e.g., 2024-01-15)"),
    assigneeType: z
      .enum(["user", "agent"])
      .optional()
      .describe("Who should work on this task: 'user' (the human owner) or 'agent' (the AI assistant). The ID is resolved automatically."),
  }),
  execute: async (
    { title, description, projectId, priority, dueDate, assigneeType },
    options
  ) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    // Auto-resolve assignee ID from type
    const assigneeId = await resolveAssigneeId(supabase, agentId, assigneeType);

    // Generate embedding for task (title + description)
    const textToEmbed = description ? `${title}\n\n${description}` : title;
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(textToEmbed);
    } catch (embeddingError) {
      console.error("Error generating task embedding:", embeddingError);
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        agent_id: agentId as string,
        title,
        description,
        project_id: projectId || null,
        priority: priority || "medium",
        status: "todo",
        due_date: dueDate || null,
        assignee_type: assigneeType || null,
        assignee_id: assigneeId,
        embedding,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      task: {
        id: data.id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        dueDate: data.due_date,
        assigneeType: data.assignee_type,
      },
    };
  },
});

export const listTasksTool = tool({
  description: "List tasks, optionally filtered by status, project, or assignee",
  inputSchema: z.object({
    status: z
      .enum(["todo", "in_progress", "waiting_on", "done", "all"])
      .optional()
      .describe("Filter by task status"),
    projectId: z
      .string()
      .optional()
      .describe("Filter tasks by project ID"),
    assigneeType: z
      .enum(["user", "agent"])
      .optional()
      .describe("Filter by who is assigned: 'user' or 'agent'"),
  }),
  execute: async ({ status, projectId, assigneeType }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    let query = supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, due_date, project_id, created_at, completed_at, assignee_type, assignee_id, blocked_by"
      )
      .eq("agent_id", agentId as string)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (assigneeType) {
      query = query.eq("assignee_type", assigneeType);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      tasks: data,
      count: data.length,
    };
  },
});

export const completeTaskTool = tool({
  description: "Mark a task as done (completed)",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to complete"),
  }),
  execute: async ({ taskId }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Create notification for task completion
    await createNotification(
      supabase,
      agentId as string,
      "task_update",
      `Task completed: ${data.title}`,
      "Your task has been marked as done.",
      "task",
      taskId
    );

    return {
      success: true,
      task: data,
    };
  },
});

export const updateTaskTool = tool({
  description: "Update an existing task's details, status, or assignment",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to update"),
    title: z.string().optional().describe("New title for the task"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["todo", "in_progress", "waiting_on", "done"])
      .optional()
      .describe("New status: todo, in_progress, waiting_on, or done"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("New priority level"),
    dueDate: z.string().optional().describe("New due date in ISO format"),
    assigneeType: z
      .enum(["user", "agent"])
      .optional()
      .describe("Reassign to 'user' (the human owner) or 'agent' (the AI assistant). The ID is resolved automatically."),
    blockedBy: z
      .array(z.string())
      .optional()
      .describe("Array of task IDs that block this task"),
  }),
  execute: async (
    { taskId, title, description, status, priority, dueDate, assigneeType, blockedBy },
    options
  ) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

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
    if (dueDate) updates.due_date = dueDate;
    if (assigneeType !== undefined) {
      updates.assignee_type = assigneeType;
      // Auto-resolve the assignee ID
      updates.assignee_id = await resolveAssigneeId(supabase, agentId, assigneeType);
    }
    if (blockedBy !== undefined) updates.blocked_by = blockedBy;

    // If title or description changed, regenerate embedding
    if (title || description !== undefined) {
      // Fetch current task to get full text for embedding
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
        } catch (embeddingError) {
          console.error("Error generating task embedding:", embeddingError);
        }
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Create notification for status changes
    if (status) {
      const statusMessages: Record<string, string> = {
        todo: "Task moved to todo",
        in_progress: "Task is now in progress",
        waiting_on: "Task is waiting on input/dependency",
        done: "Task has been completed",
      };
      await createNotification(
        supabase,
        agentId as string,
        "task_update",
        `${data.title}: ${statusMessages[status] || "Status updated"}`,
        null,
        "task",
        taskId
      );
    }

    return {
      success: true,
      task: data,
    };
  },
});

export const getTaskTool = tool({
  description: "Get details of a specific task by ID, including assignee and dependencies",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to retrieve"),
  }),
  execute: async ({ taskId }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, due_date, project_id, created_at, completed_at, assignee_type, assignee_id, blocked_by, agent_run_state, last_agent_run_at"
      )
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Task not found" };
    }

    return {
      success: true,
      task: data,
    };
  },
});

export const deleteTaskTool = tool({
  description: "Delete a task",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to delete"),
  }),
  execute: async ({ taskId }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    // First verify the task belongs to this agent and get its title
    const { data: task, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .single();

    if (fetchError || !task) {
      return { success: false, error: "Task not found or access denied" };
    }

    // Delete the task
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("agent_id", agentId as string);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return {
      success: true,
      message: `Task "${task.title}" has been deleted`,
      deletedTaskId: taskId,
    };
  },
});

// Export types for UI components
export type CreateTaskToolInvocation = UIToolInvocation<typeof createTaskTool>;
export type ListTasksToolInvocation = UIToolInvocation<typeof listTasksTool>;
export type CompleteTaskToolInvocation = UIToolInvocation<
  typeof completeTaskTool
>;
export type UpdateTaskToolInvocation = UIToolInvocation<typeof updateTaskTool>;
export type GetTaskToolInvocation = UIToolInvocation<typeof getTaskTool>;
export type DeleteTaskToolInvocation = UIToolInvocation<typeof deleteTaskTool>;
