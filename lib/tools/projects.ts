import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";

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

    return {
      success: true,
      project: data,
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
