// Main exports for Inngest integration
export { inngest } from "./client";
export type { JobExecuteEvent, ProjectWorkEvent, TaskProcessEvent, InngestEvents } from "./client";
export { functions, executeScheduledJob, projectWorkAgent } from "./functions";

/**
 * Helper to trigger a project work session via Inngest
 * Can be called from anywhere in the app to start background project work
 */
export async function startProjectWork(projectId: string, agentId: string, instruction?: string) {
  const { inngest } = await import("./client");
  await inngest.send({
    name: "project/work.start",
    data: { projectId, agentId, instruction },
  });
}

/**
 * Helper to trigger a scheduled job execution via Inngest
 * Normally called by the dispatcher, but can be used directly
 */
export async function executeJobViaInngest(job: {
  id: string;
  agent_id: string;
  job_type: string;
  action_type: string;
  title: string;
  description: string | null;
  action_payload: unknown;
  task_id: string | null;
  project_id: string | null;
  conversation_id: string | null;
  cron_expression: string | null;
  next_run_at: string | null;
  status: string;
}) {
  const { inngest } = await import("./client");
  await inngest.send({
    name: "job/scheduled.execute",
    data: { job },
  });
}
