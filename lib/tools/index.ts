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

export { createCheckEmailTool, createSendEmailTool } from "./email";

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

export type { CheckEmailTool, SendEmailTool, CheckEmailToolInvocation, SendEmailToolInvocation } from "./email";

export type { CheckCalendarToolInvocation } from "./calendar";

export type { ResearchToolInvocation } from "./research";
