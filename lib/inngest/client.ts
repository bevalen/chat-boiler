import { Inngest } from "inngest";

// Create a single Inngest client for the app
// This client is used to define functions and send events
export const inngest = new Inngest({
  id: "maia",
  // Optional: Add event schemas for type safety
  // schemas: new EventSchemas().fromRecord<Events>(),
});

// Event type definitions for type safety
export type JobExecuteEvent = {
  name: "job/scheduled.execute";
  data: {
    job: {
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
    };
  };
};

export type ProjectWorkEvent = {
  name: "project/work.start";
  data: {
    projectId: string;
    agentId: string;
    instruction?: string;
  };
};

export type TaskProcessEvent = {
  name: "task/process.start";
  data: {
    taskId: string;
    agentId: string;
  };
};

// Union of all event types
export type InngestEvents = JobExecuteEvent | ProjectWorkEvent | TaskProcessEvent;
