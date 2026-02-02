/**
 * Feedback tools for bug reports and feature requests
 * Handles creation, search, update, and deletion of feedback items
 */

import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createFeedback,
  searchFeedback,
  updateFeedback,
  deleteFeedback,
} from "@/lib/db/feedback";
import { FeedbackType, FeedbackPriority } from "@/lib/types/database";

export interface FeedbackToolContext {
  agentId: string;
  supabase: SupabaseClient<any>;
  conversationId: string;
}

export function createFeedbackTools(context: FeedbackToolContext) {
  const { agentId, supabase, conversationId } = context;

  return {
    submitFeedback: tool({
      description:
        "Submit a bug report or feature request. Use when the user wants to report an issue, suggest a feature, or provide feedback about the app.",
      inputSchema: z.object({
        type: z.enum(["feature_request", "bug_report"]).describe("Type of feedback"),
        title: z.string().describe("A clear, concise title summarizing the feedback"),
        problem: z.string().describe("Description of the problem or pain point"),
        proposedSolution: z
          .string()
          .optional()
          .describe("Suggested solution or how the feature might work"),
        priority: z
          .enum(["critical", "high", "medium", "low"])
          .optional()
          .default("medium")
          .describe("Priority level based on impact"),
      }),
      execute: async ({
        type,
        title,
        problem,
        proposedSolution,
        priority,
      }: {
        type: "feature_request" | "bug_report";
        title: string;
        problem: string;
        proposedSolution?: string;
        priority?: "critical" | "high" | "medium" | "low";
      }) => {
        try {
          const { feedback, error } = await createFeedback(supabase, agentId, {
            type: type as FeedbackType,
            title,
            problem,
            proposedSolution,
            priority: (priority || "medium") as FeedbackPriority,
            source: "manual",
            conversationId,
          });

          if (error) {
            return { success: false, error };
          }

          return {
            success: true,
            feedbackId: feedback?.id,
            type: feedback?.type,
            title: feedback?.title,
            message: `Successfully submitted ${type === "feature_request" ? "feature request" : "bug report"}: "${title}"`,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),

    searchFeedback: tool({
      description:
        "Search for existing feedback items (bug reports and feature requests). Use this to find feedback before updating or deleting, or to check for duplicates.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Search query - matches against title, problem, description, and proposed solution"
          ),
        type: z
          .enum(["feature_request", "bug_report"])
          .optional()
          .describe("Filter by feedback type"),
        status: z
          .enum(["new", "under_review", "planned", "in_progress", "done", "wont_fix"])
          .optional()
          .describe("Filter by status"),
        limit: z.number().optional().describe("Maximum number of results to return (default 20)"),
      }),
      execute: async ({
        query,
        type,
        status,
        limit,
      }: {
        query: string;
        type?: "feature_request" | "bug_report";
        status?: "new" | "under_review" | "planned" | "in_progress" | "done" | "wont_fix";
        limit?: number;
      }) => {
        try {
          const { items, error } = await searchFeedback(supabase, agentId, query, {
            type: type as FeedbackType | undefined,
            status: status as import("@/lib/types/database").FeedbackStatus | undefined,
            limit,
          });

          if (error) {
            return { success: false, error, message: "Failed to search feedback items." };
          }

          return {
            success: true,
            count: items.length,
            items: items.map((item) => ({
              id: item.id,
              type: item.type,
              title: item.title,
              problem: item.problem,
              proposedSolution: item.proposedSolution,
              priority: item.priority,
              status: item.status,
              createdAt: item.createdAt,
            })),
            message:
              items.length > 0
                ? `Found ${items.length} feedback item(s) matching "${query}"`
                : `No feedback items found matching "${query}"`,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),

    updateFeedbackItem: tool({
      description:
        "Update an existing feedback item. Use searchFeedback first to find the item's ID.",
      inputSchema: z.object({
        feedbackId: z.string().describe("The UUID of the feedback item to update"),
        title: z.string().optional().describe("New title for the feedback"),
        problem: z.string().optional().describe("Updated problem description"),
        proposedSolution: z.string().optional().describe("Updated proposed solution"),
        priority: z
          .enum(["critical", "high", "medium", "low"])
          .optional()
          .describe("New priority level"),
        status: z
          .enum(["new", "under_review", "planned", "in_progress", "done", "wont_fix"])
          .optional()
          .describe("New status"),
      }),
      execute: async ({
        feedbackId,
        title,
        problem,
        proposedSolution,
        priority,
        status,
      }: {
        feedbackId: string;
        title?: string;
        problem?: string;
        proposedSolution?: string;
        priority?: "critical" | "high" | "medium" | "low";
        status?: "new" | "under_review" | "planned" | "in_progress" | "done" | "wont_fix";
      }) => {
        try {
          const { feedback, error } = await updateFeedback(supabase, feedbackId, {
            title,
            problem,
            proposedSolution,
            priority: priority as FeedbackPriority | undefined,
            status: status as import("@/lib/types/database").FeedbackStatus | undefined,
          });

          if (error) {
            return {
              success: false,
              error,
              message: "Failed to update feedback item. Make sure the ID is correct.",
            };
          }

          return {
            success: true,
            feedbackId: feedback?.id,
            title: feedback?.title,
            status: feedback?.status,
            priority: feedback?.priority,
            message: `Successfully updated feedback item: "${feedback?.title}"`,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),

    deleteFeedbackItem: tool({
      description:
        "Delete a feedback item. Use searchFeedback first to find the item's ID. Consider marking as 'wont_fix' instead of deleting to preserve history.",
      inputSchema: z.object({
        feedbackId: z.string().describe("The UUID of the feedback item to delete"),
      }),
      execute: async ({ feedbackId }: { feedbackId: string }) => {
        try {
          const { success, error } = await deleteFeedback(supabase, feedbackId);

          if (error) {
            return {
              success: false,
              error,
              message: "Failed to delete feedback item. Make sure the ID is correct.",
            };
          }

          return {
            success: true,
            message: "Successfully deleted the feedback item.",
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),
  };
}

// Type exports for UI components (AI SDK best practice)
export type FeedbackTools = ReturnType<typeof createFeedbackTools>;
export type SubmitFeedbackToolInvocation = UIToolInvocation<FeedbackTools["submitFeedback"]>;
export type SearchFeedbackToolInvocation = UIToolInvocation<FeedbackTools["searchFeedback"]>;
export type UpdateFeedbackToolInvocation = UIToolInvocation<FeedbackTools["updateFeedbackItem"]>;
export type DeleteFeedbackToolInvocation = UIToolInvocation<FeedbackTools["deleteFeedbackItem"]>;
