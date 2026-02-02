/**
 * Project management tools
 * Handles CRUD operations for projects
 */

import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/embeddings";

export interface ProjectToolContext {
  agentId: string;
  supabase: SupabaseClient<any>;
}

export function createProjectTools(context: ProjectToolContext) {
  const { agentId, supabase } = context;

  return {
    createProject: tool({
      description: "Create a new project to track work",
      inputSchema: z.object({
        title: z.string().describe("Project title"),
        description: z.string().optional().describe("Project description"),
        priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
      }),
      execute: async ({
        title,
        description,
        priority,
      }: {
        title: string;
        description?: string;
        priority?: "high" | "medium" | "low";
      }) => {
        const textToEmbed = description ? `${title}\n\n${description}` : title;
        const embedding = await generateEmbedding(textToEmbed);
        const { data, error } = await supabase
          .from("projects")
          .insert({
            agent_id: agentId,
            title,
            description,
            priority: priority || "medium",
            status: "active",
            embedding,
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return {
          success: true,
          project: { id: data.id, title: data.title, status: data.status, priority: data.priority },
        };
      },
    }),

    listProjects: tool({
      description: "List all projects",
      inputSchema: z.object({
        status: z.enum(["active", "paused", "completed", "all"]).optional().default("active"),
      }),
      execute: async ({
        status,
      }: {
        status?: "active" | "paused" | "completed" | "all";
      }) => {
        let query = supabase
          .from("projects")
          .select("id, title, description, status, priority, created_at")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false });

        if (status && status !== "all") {
          query = query.eq("status", status);
        }

        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, projects: data, count: data?.length || 0 };
      },
    }),

    getProject: tool({
      description: "Get details of a specific project by ID",
      inputSchema: z.object({
        projectId: z.string().describe("The ID of the project to retrieve"),
      }),
      execute: async ({ projectId }: { projectId: string }) => {
        const { data, error } = await supabase
          .from("projects")
          .select("id, title, description, status, priority, created_at, updated_at")
          .eq("id", projectId)
          .eq("agent_id", agentId)
          .single();

        if (error) return { success: false, error: error.message };
        if (!data) return { success: false, error: "Project not found" };
        return { success: true, project: data };
      },
    }),

    updateProject: tool({
      description: "Update an existing project's title, description, status, or priority",
      inputSchema: z.object({
        projectId: z.string().describe("The ID of the project to update"),
        title: z.string().optional().describe("New title for the project"),
        description: z.string().optional().describe("New description"),
        status: z.enum(["active", "paused", "completed"]).optional().describe("New status"),
        priority: z
          .enum(["high", "medium", "low"])
          .optional()
          .describe("New priority level"),
      }),
      execute: async ({
        projectId,
        title,
        description,
        status,
        priority,
      }: {
        projectId: string;
        title?: string;
        description?: string;
        status?: "active" | "paused" | "completed";
        priority?: "high" | "medium" | "low";
      }) => {
        const updates: Record<string, unknown> = {};
        if (title) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (status) updates.status = status;
        if (priority) updates.priority = priority;

        // If title or description changed, regenerate embedding
        if (title || description !== undefined) {
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
            } catch (err) {
              console.error("Error generating project embedding:", err);
            }
          }
        }

        const { data, error } = await supabase
          .from("projects")
          .update(updates)
          .eq("id", projectId)
          .eq("agent_id", agentId)
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return {
          success: true,
          project: { id: data.id, title: data.title, status: data.status, priority: data.priority },
        };
      },
    }),

    deleteProject: tool({
      description: "Delete a project and optionally its associated tasks",
      inputSchema: z.object({
        projectId: z.string().describe("The ID of the project to delete"),
        deleteTasks: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to also delete all tasks associated with this project"),
      }),
      execute: async ({
        projectId,
        deleteTasks,
      }: {
        projectId: string;
        deleteTasks?: boolean;
      }) => {
        // First verify the project belongs to this agent
        const { data: project, error: fetchError } = await supabase
          .from("projects")
          .select("id, title")
          .eq("id", projectId)
          .eq("agent_id", agentId)
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
            .eq("agent_id", agentId);

          if (tasksError) {
            return { success: false, error: `Failed to delete tasks: ${tasksError.message}` };
          }
        } else {
          // Unlink tasks from the project (set project_id to null)
          await supabase
            .from("tasks")
            .update({ project_id: null })
            .eq("project_id", projectId)
            .eq("agent_id", agentId);
        }

        // Delete the project
        const { error: deleteError } = await supabase
          .from("projects")
          .delete()
          .eq("id", projectId)
          .eq("agent_id", agentId);

        if (deleteError) return { success: false, error: deleteError.message };
        return {
          success: true,
          message: `Project "${project.title}" has been deleted${deleteTasks ? " along with its tasks" : ""}`,
          deletedProjectId: projectId,
        };
      },
    }),
  };
}

// Type exports for UI components (AI SDK best practice)
export type ProjectTools = ReturnType<typeof createProjectTools>;
export type CreateProjectToolInvocation = UIToolInvocation<ProjectTools["createProject"]>;
export type ListProjectsToolInvocation = UIToolInvocation<ProjectTools["listProjects"]>;
export type GetProjectToolInvocation = UIToolInvocation<ProjectTools["getProject"]>;
export type UpdateProjectToolInvocation = UIToolInvocation<ProjectTools["updateProject"]>;
export type DeleteProjectToolInvocation = UIToolInvocation<ProjectTools["deleteProject"]>;
