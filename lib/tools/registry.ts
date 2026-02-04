/**
 * Central tool registry for the AI agent
 * Initializes and exports all tools with proper context
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createFeedbackTools } from "./feedback-tools";
import { createResearchTool } from "./research";

export interface ToolRegistryContext {
  agentId: string;
  userId: string;
  supabase: SupabaseClient<any>;
  conversationId: string;
}

/**
 * Create the complete tool registry with all available tools
 */
export function createToolRegistry(context: ToolRegistryContext) {
  const {
    agentId,
    supabase,
    conversationId,
  } = context;

  // Feedback tools
  const feedbackTools = createFeedbackTools({
    agentId,
    supabase,
    conversationId,
  });

  // Research tool (Perplexity API)
  const researchTool = createResearchTool(agentId);

  // Combine all tools into a single registry
  return {
    // Feedback
    ...feedbackTools,
    // Research
    research: researchTool,
  };
}

/**
 * Export type for the tool registry
 */
export type ToolRegistry = ReturnType<typeof createToolRegistry>;
