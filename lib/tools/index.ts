/**
 * Central export point for all tool modules
 * Re-exports tools and types from organized modules
 */

// Export tool factories
export { createFeedbackTools } from "./feedback-tools";
export { createResearchTool } from "./research";

// Export tool registry (main entry point for chat route)
export { createToolRegistry, type ToolRegistry, type ToolRegistryContext } from "./registry";

// ============================================================
// Type exports for UI components (AI SDK best practice)
// Use UIToolInvocation types for type-safe tool rendering
// ============================================================

// Feedback tool context and invocation types
export type { FeedbackToolContext } from "./feedback-tools";
export type {
  FeedbackTools,
  SubmitFeedbackToolInvocation,
  SearchFeedbackToolInvocation,
  UpdateFeedbackToolInvocation,
  DeleteFeedbackToolInvocation,
} from "./feedback-tools";

// Research tool invocation types
export type { ResearchTool, ResearchToolInvocation } from "./research";
