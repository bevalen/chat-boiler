// Re-export all tools from a central location
export {
  createProjectTool,
  listProjectsTool,
  updateProjectTool,
} from "./projects";

export {
  createTaskTool,
  listTasksTool,
  completeTaskTool,
  updateTaskTool,
} from "./tasks";

export { checkEmailTool, sendEmailTool } from "./email";

export { checkCalendarTool } from "./calendar";

export { searchMemoryTool, saveToMemoryTool } from "./memory";

// Export tool types
export type {
  CreateProjectToolInvocation,
  ListProjectsToolInvocation,
  UpdateProjectToolInvocation,
} from "./projects";

export type {
  CreateTaskToolInvocation,
  ListTasksToolInvocation,
  CompleteTaskToolInvocation,
  UpdateTaskToolInvocation,
} from "./tasks";

export type { CheckEmailToolInvocation, SendEmailToolInvocation } from "./email";

export type { CheckCalendarToolInvocation } from "./calendar";
