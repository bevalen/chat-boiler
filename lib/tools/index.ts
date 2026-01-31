// Re-export all tools from a central location
export {
  createProjectTool,
  listProjectsTool,
  getProjectTool,
  updateProjectTool,
  deleteProjectTool,
} from "./projects";

export {
  createTaskTool,
  listTasksTool,
  getTaskTool,
  completeTaskTool,
  updateTaskTool,
  deleteTaskTool,
} from "./tasks";

export { 
  createCheckEmailTool, 
  createSendEmailTool, 
  createForwardEmailToUserTool,
  createReplyToEmailTool,
  createArchiveEmailTool,
  createEmailDraftTool,
} from "./email";

export { checkCalendarTool } from "./calendar";

export { searchMemoryTool, saveToMemoryTool } from "./memory";

export { createResearchTool } from "./research";

// Export tool types
export type {
  CreateProjectToolInvocation,
  ListProjectsToolInvocation,
  GetProjectToolInvocation,
  UpdateProjectToolInvocation,
  DeleteProjectToolInvocation,
} from "./projects";

export type {
  CreateTaskToolInvocation,
  ListTasksToolInvocation,
  GetTaskToolInvocation,
  CompleteTaskToolInvocation,
  UpdateTaskToolInvocation,
  DeleteTaskToolInvocation,
} from "./tasks";

export type { 
  CheckEmailTool, 
  SendEmailTool, 
  ForwardEmailToUserTool,
  ReplyToEmailTool,
  ArchiveEmailTool,
  CreateEmailDraftTool,
  CheckEmailToolInvocation, 
  SendEmailToolInvocation,
  ForwardEmailToUserToolInvocation,
  ReplyToEmailToolInvocation,
  ArchiveEmailToolInvocation,
  CreateEmailDraftToolInvocation,
} from "./email";

export type { CheckCalendarToolInvocation } from "./calendar";

export type { ResearchToolInvocation } from "./research";
