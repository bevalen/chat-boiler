import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

export const addCommentTool = tool({
  description: "Add a comment to a task, project, or feedback item. Use this to log progress, ask questions, or record notes.",
  inputSchema: z.object({
    taskId: z
      .string()
      .optional()
      .describe("The ID of the task to comment on"),
    projectId: z
      .string()
      .optional()
      .describe("The ID of the project to comment on"),
    feedbackId: z
      .string()
      .optional()
      .describe("The ID of the feedback item to comment on"),
    content: z.string().describe("The comment content (supports markdown)"),
    commentType: z
      .enum(["progress", "question", "note", "resolution", "approval_request", "approval_granted", "status_change"])
      .optional()
      .default("note")
      .describe("The type of comment: progress update, question, note, resolution, or approval-related"),
  }),
  execute: async ({ taskId, projectId, feedbackId, content, commentType }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    if (!taskId && !projectId && !feedbackId) {
      return { success: false, error: "Either taskId, projectId, or feedbackId is required" };
    }
    
    const supabase = getAdminClient();

    // Use the new 'comments' table (renamed from task_comments)
    const { data, error } = await supabase
      .from("comments")
      .insert({
        task_id: taskId || null,
        project_id: projectId || null,
        feedback_id: feedbackId || null,
        author_type: "agent",
        author_id: agentId,
        content,
        comment_type: commentType || "note",
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      comment: {
        id: data.id,
        taskId: data.task_id,
        projectId: data.project_id,
        feedbackId: data.feedback_id,
        content: data.content,
        commentType: data.comment_type,
        createdAt: data.created_at,
      },
    };
  },
});

export const listCommentsTool = tool({
  description: "List comments on a task, project, or feedback item to see the activity history",
  inputSchema: z.object({
    taskId: z
      .string()
      .optional()
      .describe("The ID of the task to get comments for"),
    projectId: z
      .string()
      .optional()
      .describe("The ID of the project to get comments for"),
    feedbackId: z
      .string()
      .optional()
      .describe("The ID of the feedback item to get comments for"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Maximum number of comments to return"),
  }),
  execute: async ({ taskId, projectId, feedbackId, limit }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    if (!taskId && !projectId && !feedbackId) {
      return { success: false, error: "Either taskId, projectId, or feedbackId is required" };
    }
    
    const supabase = getAdminClient();

    // Use the new 'comments' table (renamed from task_comments)
    let query = supabase
      .from("comments")
      .select("id, task_id, project_id, feedback_id, author_type, author_id, content, comment_type, created_at")
      .order("created_at", { ascending: false })
      .limit(limit || 20);

    if (taskId) {
      query = query.eq("task_id", taskId);
    } else if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (feedbackId) {
      query = query.eq("feedback_id", feedbackId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      comments: data,
      count: data.length,
    };
  },
});

// Export types for UI components
export type AddCommentToolInvocation = UIToolInvocation<typeof addCommentTool>;
export type ListCommentsToolInvocation = UIToolInvocation<typeof listCommentsTool>;
