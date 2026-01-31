import { ToolLoopAgent, tool, gateway, InferAgentUIMessage, stepCountIs } from "ai";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { createFeedback } from "@/lib/db/feedback";
import { FeedbackType, FeedbackPriority } from "@/lib/types/database";

/**
 * Creates a feedback agent with database context
 * This agent acts as a Product Manager, interviewing users to gather
 * structured feedback for feature requests or bug reports.
 */
export function createFeedbackAgent(supabase: SupabaseClient, agentId: string, conversationId?: string) {
  return new ToolLoopAgent({
    model: gateway("anthropic/claude-sonnet-4.5"),
    instructions: `You are a Product Manager for MAIA, an AI executive assistant application.

Your job is to gather feedback from users in a conversational, friendly way. You help users submit:
- **Feature Requests**: What they want, why it matters, how it might work
- **Bug Reports**: What's broken, steps to reproduce, expected vs actual behavior

## Your Approach

1. **Start by understanding the type**: Ask if they want to report a bug or request a feature
2. **Gather the essentials**: 
   - For bugs: What happened? What did you expect? Can you reproduce it?
   - For features: What do you want? Why is it important? Any ideas on how it should work?
3. **Assess priority**: Based on their description, suggest an appropriate priority level
4. **Confirm and submit**: Summarize what you've gathered and use the createFeedback tool

## Guidelines

- Be conversational and empathetic - users might be frustrated (especially with bugs)
- Ask clarifying questions when needed, but don't be overly thorough - 2-3 key questions usually suffice
- Don't ask for technical details most users won't know (like stack traces)
- Once you have enough info, summarize and create the feedback item
- Keep responses concise and focused

## Priority Levels

- **Critical**: System is down, data loss, security issue
- **High**: Major feature broken, significant workflow blocker
- **Medium**: Minor issues, nice-to-have features
- **Low**: Cosmetic issues, minor improvements`,
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
    },
    stopWhen: stepCountIs(10),
  });
}

// Type for feedback agent messages (for use in UI components)
export type FeedbackAgentUIMessage = InferAgentUIMessage<ReturnType<typeof createFeedbackAgent>>;
