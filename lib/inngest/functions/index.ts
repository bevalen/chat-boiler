import { executeScheduledJob } from "./execute-job";
import { projectWorkAgent } from "./project-work";
import { processTaskWorkflow } from "./process-task";

// Export all Inngest functions as an array for the serve() handler
export const functions = [
  executeScheduledJob,
  projectWorkAgent,
  processTaskWorkflow,
];

// Re-export individual functions for direct imports
export { executeScheduledJob, projectWorkAgent, processTaskWorkflow };
