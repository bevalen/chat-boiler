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

export { checkEmailTool, sendEmailTool } from "./email";

export { checkCalendarTool } from "./calendar";

export { searchMemoryTool, saveToMemoryTool } from "./memory";

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

export type { CheckEmailToolInvocation, SendEmailToolInvocation } from "./email";

export type { CheckCalendarToolInvocation } from "./calendar";
