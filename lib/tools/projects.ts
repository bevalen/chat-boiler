import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";
import { createNotification } from "@/lib/db/notifications";

export const createProjectTool = tool({
  description: "Create a new project to track work",
  inputSchema: z.object({
    title: z.string().describe("The title of the project"),
    description: z.string().optional().describe("A description of the project"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("Priority level of the project"),
  }),
  execute: async ({ title, description, priority }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    // Generate embedding for project (title + description)
    const textToEmbed = description ? `${title}\n\n${description}` : title;
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(textToEmbed);
    } catch (embeddingError) {
      console.error("Error generating project embedding:", embeddingError);
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        agent_id: agentId as string,
        title,
        description,
        priority: priority || "medium",
        status: "active",
        embedding,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      project: {
        id: data.id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
      },
    };
  },
});

export const listProjectsTool = tool({
  description: "List all active projects",
  inputSchema: z.object({
    status: z
      .enum(["active", "paused", "completed", "all"])
      .optional()
      .describe("Filter by project status"),
  }),
  execute: async ({ status }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    let query = supabase
      .from("projects")
      .select("id, title, description, status, priority, created_at, updated_at")
      .eq("agent_id", agentId as string)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      projects: data,
      count: data.length,
    };
  },
});

export const updateProjectTool = tool({
  description: "Update an existing project's status or details",
  inputSchema: z.object({
    projectId: z.string().describe("The ID of the project to update"),
    title: z.string().optional().describe("New title for the project"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["active", "paused", "completed"])
      .optional()
      .describe("New status for the project"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("New priority level"),
  }),
  execute: async (
    { projectId, title, description, status, priority },
    options
  ) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    const updates: Record<string, unknown> = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status) updates.status = status;
    if (priority) updates.priority = priority;

    // If title or description changed, regenerate embedding
    if (title || description !== undefined) {
      // Fetch current project to get full text for embedding
      const { data: current } = await supabase
        .from("projects")
        .select("title, description")
        .eq("id", projectId)
        .single();

      if (current) {
        const newTitle = title || current.title;
        const newDescription = description !== undefined ? description : current.description;
        const textToEmbed = newDescription ? `${newTitle}\n\n${newDescription}` : newTitle;
        
        try {
          updates.embedding = await generateEmbedding(textToEmbed);
        } catch (embeddingError) {
          console.error("Error generating project embedding:", embeddingError);
        }
      }
    }

    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .eq("agent_id", agentId as string)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Create notification for status changes
    if (status) {
      const statusMessages: Record<string, string> = {
        active: "Project is now active",
        paused: "Project has been paused",
        completed: "Project has been completed",
      };
      await createNotification(
        supabase,
        agentId as string,
        "project_update",
        `${data.title}: ${statusMessages[status] || "Status updated"}`,
        null,
        "project",
        projectId
      );
    }

    return {
      success: true,
      project: data,
    };
  },
});

export const getProjectTool = tool({
  description: "Get details of a specific project by ID",
  inputSchema: z.object({
    projectId: z.string().describe("The ID of the project to retrieve"),
  }),
  execute: async ({ projectId }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .select("id, title, description, status, priority, created_at, updated_at")
      .eq("id", projectId)
      .eq("agent_id", agentId as string)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Project not found" };
    }

    return {
      success: true,
      project: data,
    };
  },
});

export const deleteProjectTool = tool({
  description: "Delete a project and optionally its associated tasks",
  inputSchema: z.object({
    projectId: z.string().describe("The ID of the project to delete"),
    deleteTasks: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to also delete all tasks associated with this project"),
  }),
  execute: async ({ projectId, deleteTasks }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    // First verify the project belongs to this agent
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id, title")
      .eq("id", projectId)
      .eq("agent_id", agentId as string)
      .single();

    if (fetchError || !project) {
      return { success: false, error: "Project not found or access denied" };
    }

    // If deleteTasks is true, delete associated tasks first
    if (deleteTasks) {
      const { error: tasksError } = await supabase
        .from("tasks")
        .delete()
        .eq("project_id", projectId)
        .eq("agent_id", agentId as string);

      if (tasksError) {
        return { success: false, error: `Failed to delete tasks: ${tasksError.message}` };
      }
    } else {
      // Unlink tasks from the project (set project_id to null)
      await supabase
        .from("tasks")
        .update({ project_id: null })
        .eq("project_id", projectId)
        .eq("agent_id", agentId as string);
    }

    // Delete the project
    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("agent_id", agentId as string);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return {
      success: true,
      message: `Project "${project.title}" has been deleted${deleteTasks ? " along with its tasks" : ""}`,
      deletedProjectId: projectId,
    };
  },
});

// Export types for UI components
export type CreateProjectToolInvocation = UIToolInvocation<
  typeof createProjectTool
>;
export type ListProjectsToolInvocation = UIToolInvocation<
  typeof listProjectsTool
>;
export type UpdateProjectToolInvocation = UIToolInvocation<
  typeof updateProjectTool
>;
export type GetProjectToolInvocation = UIToolInvocation<typeof getProjectTool>;
export type DeleteProjectToolInvocation = UIToolInvocation<
  typeof deleteProjectTool
>;
