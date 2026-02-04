import { ToolLoopAgent, tool, gateway, InferAgentUIMessage, stepCountIs } from "ai";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { createFeedback, searchFeedback, updateFeedback, deleteFeedback } from "@/lib/db/feedback";
import { FeedbackType, FeedbackPriority, FeedbackStatus } from "@/lib/types/database";

/**
 * Creates a feedback agent with database context
 * This agent acts as a Product Manager, interviewing users to gather
 * structured feedback for feature requests or bug reports.
 */
export function createFeedbackAgent(supabase: SupabaseClient, agentId: string, conversationId?: string) {
  return new ToolLoopAgent({
    model: gateway("anthropic/claude-sonnet-4.5"),
    instructions: `You are a Product Manager for an AI assistant application.

Your job is to help users manage feedback - this includes creating new feedback items, searching existing ones, updating them, and deleting them when needed.

## What You Can Do

1. **Create Feedback**: Help users submit feature requests or bug reports
2. **Search Feedback**: Find existing feedback items by keywords
3. **Update Feedback**: Modify title, description, priority, status, or other fields
4. **Delete Feedback**: Remove feedback items that are no longer needed

## Creating New Feedback

For new submissions, gather:
- **Feature Requests**: What they want, why it matters, how it might work
- **Bug Reports**: What's broken, steps to reproduce, expected vs actual behavior

## Searching & Managing Feedback

When users want to find, edit, or delete feedback:
1. Use searchFeedback to find relevant items
2. Present the results clearly with IDs, titles, and status
3. For updates/deletes, confirm the specific item before acting

## Priority Levels

- **Critical**: System is down, data loss, security issue
- **High**: Major feature broken, significant workflow blocker
- **Medium**: Minor issues, nice-to-have features
- **Low**: Cosmetic issues, minor improvements

## Status Values

- **new**: Just submitted, not yet reviewed
- **under_review**: Being evaluated
- **planned**: Approved and scheduled for implementation
- **in_progress**: Currently being worked on
- **done**: Completed
- **wont_fix**: Declined or not feasible

## Guidelines

- Be conversational and empathetic
- Keep responses concise and focused
- Always confirm before deleting items
- When searching, show the feedback ID so users can reference specific items`,
    tools: {
      createFeedback: tool({
        description: "Create a feedback item (feature request or bug report) after gathering all necessary information from the user",
        inputSchema: z.object({
          type: z.enum(["feature_request", "bug_report"]).describe("Type of feedback"),
          title: z.string().describe("A clear, concise title summarizing the feedback"),
          problem: z.string().describe("Description of the problem or pain point"),
          proposedSolution: z.string().optional().describe("Suggested solution or how the feature might work"),
          priority: z.enum(["critical", "high", "medium", "low"]).describe("Priority level based on impact"),
          context: z.record(z.string(), z.unknown()).optional().describe("Additional context like steps to reproduce"),
        }),
        execute: async (input) => {
          const { feedback, error } = await createFeedback(supabase, agentId, {
            type: input.type as FeedbackType,
            title: input.title,
            problem: input.problem,
            proposedSolution: input.proposedSolution,
            priority: input.priority as FeedbackPriority,
            context: input.context as Record<string, unknown> | undefined,
            source: "manual",
            conversationId,
          });

          if (error) {
            return { 
              success: false, 
              error,
              message: "Failed to create feedback item. Please try again.",
            };
          }

          return { 
            success: true, 
            feedbackId: feedback?.id,
            type: feedback?.type,
            title: feedback?.title,
            status: feedback?.status,
            message: `Successfully created ${input.type === "feature_request" ? "feature request" : "bug report"}: "${input.title}"`,
          };
        },
      }),

      searchFeedback: tool({
        description: "Search for existing feedback items by keywords. Use this to find feedback before updating or deleting.",
        inputSchema: z.object({
          query: z.string().describe("Search query - matches against title, problem, description, and proposed solution"),
          type: z.enum(["feature_request", "bug_report"]).optional().describe("Filter by feedback type"),
          status: z.enum(["new", "under_review", "planned", "in_progress", "done", "wont_fix"]).optional().describe("Filter by status"),
          limit: z.number().optional().describe("Maximum number of results to return (default 20)"),
        }),
        execute: async (input) => {
          const { items, error } = await searchFeedback(supabase, agentId, input.query, {
            type: input.type as FeedbackType | undefined,
            status: input.status as FeedbackStatus | undefined,
            limit: input.limit,
          });

          if (error) {
            return { 
              success: false, 
              error,
              message: "Failed to search feedback items.",
            };
          }

          return { 
            success: true, 
            count: items.length,
            items: items.map(item => ({
              id: item.id,
              type: item.type,
              title: item.title,
              problem: item.problem,
              proposedSolution: item.proposedSolution,
              priority: item.priority,
              status: item.status,
              createdAt: item.createdAt,
            })),
            message: items.length > 0 
              ? `Found ${items.length} feedback item(s) matching "${input.query}"`
              : `No feedback items found matching "${input.query}"`,
          };
        },
      }),

      updateFeedback: tool({
        description: "Update an existing feedback item. Use searchFeedback first to find the item's ID.",
        inputSchema: z.object({
          feedbackId: z.string().describe("The UUID of the feedback item to update"),
          title: z.string().optional().describe("New title for the feedback"),
          problem: z.string().optional().describe("Updated problem description"),
          proposedSolution: z.string().optional().describe("Updated proposed solution"),
          priority: z.enum(["critical", "high", "medium", "low"]).optional().describe("New priority level"),
          status: z.enum(["new", "under_review", "planned", "in_progress", "done", "wont_fix"]).optional().describe("New status"),
        }),
        execute: async (input) => {
          const { feedbackId, ...updates } = input;
          
          const { feedback, error } = await updateFeedback(supabase, feedbackId, {
            title: updates.title,
            problem: updates.problem,
            proposedSolution: updates.proposedSolution,
            priority: updates.priority as FeedbackPriority | undefined,
            status: updates.status as FeedbackStatus | undefined,
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
        },
      }),

      deleteFeedback: tool({
        description: "Delete a feedback item. Use searchFeedback first to find the item's ID. Always confirm with the user before deleting.",
        inputSchema: z.object({
          feedbackId: z.string().describe("The UUID of the feedback item to delete"),
        }),
        execute: async (input) => {
          const { success, error } = await deleteFeedback(supabase, input.feedbackId);

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
        },
      }),
    },
    stopWhen: stepCountIs(10),
  });
}

// Type for feedback agent messages (for use in UI components)
export type FeedbackAgentUIMessage = InferAgentUIMessage<ReturnType<typeof createFeedbackAgent>>;
