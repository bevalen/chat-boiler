import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";

export const createTaskTool = tool({
  description: "Create a new task, optionally linked to a project",
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
  }),
  execute: async (
    { title, description, projectId, priority, dueDate },
    options
  ) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

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
        status: "pending",
        due_date: dueDate || null,
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
      },
    };
  },
});

export const listTasksTool = tool({
  description: "List tasks, optionally filtered by status or project",
  inputSchema: z.object({
    status: z
      .enum(["pending", "in_progress", "completed", "all"])
      .optional()
      .describe("Filter by task status"),
    projectId: z
      .string()
      .optional()
      .describe("Filter tasks by project ID"),
  }),
  execute: async ({ status, projectId }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    let query = supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, due_date, project_id, created_at, completed_at"
      )
      .eq("agent_id", agentId as string)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (projectId) {
      query = query.eq("project_id", projectId);
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
  description: "Mark a task as completed",
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
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      task: data,
    };
  },
});

export const updateTaskTool = tool({
  description: "Update an existing task's details or status",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to update"),
    title: z.string().optional().describe("New title for the task"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["pending", "in_progress", "completed"])
      .optional()
      .describe("New status"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("New priority level"),
    dueDate: z.string().optional().describe("New due date in ISO format"),
  }),
  execute: async (
    { taskId, title, description, status, priority, dueDate },
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
      if (status === "completed") {
        updates.completed_at = new Date().toISOString();
      }
    }
    if (priority) updates.priority = priority;
    if (dueDate) updates.due_date = dueDate;

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

    return {
      success: true,
      task: data,
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
