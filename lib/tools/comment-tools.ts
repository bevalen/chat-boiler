/**
 * Comment tools for tasks and projects
 * Handles adding and listing comments
 */

import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CommentToolContext {
  agentId: string;
  supabase: SupabaseClient<any>;
}

export function createCommentTools(context: CommentToolContext) {
  const { agentId, supabase } = context;

  return {
    addComment: tool({
      description:
        "Add a comment to a task or project. Use this to log progress, ask questions, or record notes.",
      inputSchema: z.object({
        taskId: z.string().optional().describe("The ID of the task to comment on"),
        projectId: z.string().optional().describe("The ID of the project to comment on"),
        content: z.string().describe("The comment content (supports markdown)"),
        commentType: z
          .enum([
            "progress",
            "question",
            "note",
            "resolution",
            "approval_request",
            "approval_granted",
            "status_change",
          ])
          .optional()
          .default("note")
          .describe("The type of comment"),
      }),
      execute: async ({
        taskId,
        projectId,
        content,
        commentType,
      }: {
        taskId?: string;
        projectId?: string;
        content: string;
        commentType?:
          | "progress"
          | "question"
          | "note"
          | "resolution"
          | "approval_request"
          | "approval_granted"
          | "status_change";
      }) => {
        if (!taskId && !projectId) {
          return { success: false, error: "Either taskId or projectId is required" };
        }

        const { data, error } = await supabase
          .from("task_comments")
          .insert({
            task_id: taskId || null,
            project_id: projectId || null,
            author_type: "agent",
            author_id: agentId,
            content,
            comment_type: commentType || "note",
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return {
          success: true,
          comment: {
            id: data.id,
            content: data.content,
            commentType: data.comment_type,
            createdAt: data.created_at,
          },
        };
      },
    }),

    listComments: tool({
      description: "List comments on a task or project to see the activity history",
      inputSchema: z.object({
        taskId: z.string().optional().describe("The ID of the task to get comments for"),
        projectId: z.string().optional().describe("The ID of the project to get comments for"),
        limit: z.number().optional().default(20).describe("Maximum number of comments to return"),
      }),
      execute: async ({
        taskId,
        projectId,
        limit,
      }: {
        taskId?: string;
        projectId?: string;
        limit?: number;
      }) => {
        if (!taskId && !projectId) {
          return { success: false, error: "Either taskId or projectId is required" };
        }

        let query = supabase
          .from("task_comments")
          .select(
            "id, task_id, project_id, author_type, author_id, content, comment_type, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(limit || 20);

        if (taskId) {
          query = query.eq("task_id", taskId);
        } else if (projectId) {
          query = query.eq("project_id", projectId);
        }

        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, comments: data, count: data?.length || 0 };
      },
    }),
  };
}

// Type exports for UI components (AI SDK best practice)
export type CommentTools = ReturnType<typeof createCommentTools>;
export type AddCommentToolInvocation = UIToolInvocation<CommentTools["addComment"]>;
export type ListCommentsToolInvocation = UIToolInvocation<CommentTools["listComments"]>;
