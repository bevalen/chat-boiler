/**
 * Central export point for all tool modules
 * Re-exports tools and types from organized modules
 */

// Export tool factories
export { createMemoryTools } from "./memory-tools";
export { createProjectTools } from "./project-tools";
export { createTaskTools } from "./task-tools";
export { createCommentTools } from "./comment-tools";
export { createSchedulingTools } from "./scheduling-tools";
export { createFeedbackTools } from "./feedback-tools";
export { createResearchTool } from "./research";

// Export email tools (Resend)
export {
  createCheckEmailTool,
  createSendEmailTool,
  createReplyToEmailTool,
  createForwardEmailTool,
  createMarkEmailAsReadTool,
  createGetEmailDetailsTool,
  createGetEmailThreadTool,
} from "./email-resend";

// Export tool registry (main entry point for chat route)
export { createToolRegistry, type ToolRegistry, type ToolRegistryContext } from "./registry";

// Export specialized tools that don't follow the factory pattern yet
export { checkCalendarTool } from "./calendar";

// ============================================================
// Type exports for UI components (AI SDK best practice)
// Use UIToolInvocation types for type-safe tool rendering
// ============================================================

// Context types
export type { MemoryToolContext } from "./memory-tools";
export type { ProjectToolContext } from "./project-tools";
export type { TaskToolContext } from "./task-tools";
export type { CommentToolContext } from "./comment-tools";
export type { SchedulingToolContext } from "./scheduling-tools";
export type { FeedbackToolContext } from "./feedback-tools";

// Memory tool invocation types
export type {
  MemoryTools,
  SearchMemoryToolInvocation,
  SaveToMemoryToolInvocation,
  GetRecentConversationsToolInvocation,
} from "./memory-tools";

// Project tool invocation types
export type {
  ProjectTools,
  CreateProjectToolInvocation,
  ListProjectsToolInvocation,
  GetProjectToolInvocation,
  UpdateProjectToolInvocation,
  DeleteProjectToolInvocation,
} from "./project-tools";

// Task tool invocation types
export type {
  TaskTools,
  CreateTaskToolInvocation,
  ListTasksToolInvocation,
  GetTaskToolInvocation,
  UpdateTaskToolInvocation,
  CompleteTaskToolInvocation,
  DeleteTaskToolInvocation,
  CreateSubtaskToolInvocation,
} from "./task-tools";

// Comment tool invocation types
export type {
  CommentTools,
  AddCommentToolInvocation,
  ListCommentsToolInvocation,
} from "./comment-tools";

// Scheduling tool invocation types
export type {
  SchedulingTools,
  ScheduleReminderToolInvocation,
  ScheduleAgentTaskToolInvocation,
  ScheduleTaskFollowUpToolInvocation,
  ListScheduledJobsToolInvocation,
  CancelScheduledJobToolInvocation,
  UpdateScheduledJobToolInvocation,
} from "./scheduling-tools";

// Feedback tool invocation types
export type {
  FeedbackTools,
  SubmitFeedbackToolInvocation,
  SearchFeedbackToolInvocation,
  UpdateFeedbackToolInvocation,
  DeleteFeedbackToolInvocation,
} from "./feedback-tools";

// Research tool invocation types
export type { ResearchTool, ResearchToolInvocation } from "./research";

// Email tool invocation types
export type {
  SendEmailToolResend,
  ReplyToEmailToolResend,
  CheckEmailToolResend,
  MarkEmailAsReadTool,
  GetEmailDetailsTool,
  GetEmailThreadTool,
  ForwardEmailTool,
  SendEmailToolInvocationResend,
  ReplyToEmailToolInvocationResend,
  CheckEmailToolInvocationResend,
} from "./email-resend";
