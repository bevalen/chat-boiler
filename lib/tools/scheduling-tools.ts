/**
 * Scheduling tools for reminders, agent tasks, and follow-ups
 * Handles one-time and recurring scheduled jobs
 */

import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateNextRunFromCron } from "@/lib/db/scheduled-jobs";

export interface SchedulingToolContext {
  agentId: string;
  supabase: SupabaseClient<any>;
  userTimezone?: string;
  preferredNotificationChannel?: string;
}

export function createSchedulingTools(context: SchedulingToolContext) {
  const { agentId, supabase, userTimezone, preferredNotificationChannel } = context;

  return {
    scheduleReminder: tool({
      description:
        "Schedule a simple reminder/notification. Use this when the user wants to be REMINDED or NOTIFIED about something - you will just send them a message at the specified time. Supports both one-time and recurring schedules. Examples: 'remind me to call mom at 5pm', 'send me a daily motivational quote at 9am'.",
      inputSchema: z.object({
        title: z.string().describe("What to remind the user about"),
        message: z
          .string()
          .optional()
          .describe("The notification message to show (defaults to title if not provided)"),
        runAt: z
          .string()
          .optional()
          .describe(
            "For ONE-TIME reminders: UTC ISO datetime string ending in Z (e.g., '2026-01-31T20:00:00Z')"
          ),
        cronExpression: z
          .string()
          .optional()
          .describe(
            "For RECURRING reminders: Cron expression (e.g., '0 8 * * *' for 8am daily, '0 9 * * 1' for 9am Mondays)"
          ),
        taskId: z.string().optional().describe("Link to an existing task ID"),
        projectId: z.string().optional().describe("Link to an existing project ID"),
      }),
      execute: async ({
        title,
        message,
        runAt,
        cronExpression,
        taskId,
        projectId,
      }: {
        title: string;
        message?: string;
        runAt?: string;
        cronExpression?: string;
        taskId?: string;
        projectId?: string;
      }) => {
        try {
          const timezone = userTimezone || "America/New_York";
          const preferredChannel = preferredNotificationChannel || "app";

          // Validate scheduling options
          if (!runAt && !cronExpression) {
            return {
              success: false,
              error: "Must provide either 'runAt' for one-time or 'cronExpression' for recurring reminders",
            };
          }
          if (runAt && cronExpression) {
            return {
              success: false,
              error: "Provide only one: 'runAt' for one-time OR 'cronExpression' for recurring",
            };
          }

          let nextRunAt: string;
          let scheduleType: "once" | "cron";
          let jobType: "reminder" | "recurring";
          let cronExpr: string | null = null;
          let runAtValue: string | null = null;

          if (runAt) {
            // One-time reminder
            let utcRunAt = runAt;
            if (!runAt.endsWith("Z") && !runAt.includes("+") && !runAt.includes("-", 10)) {
              utcRunAt = runAt + "Z";
            }
            const runAtDate = new Date(utcRunAt);
            if (isNaN(runAtDate.getTime())) {
              return {
                success: false,
                error: `Invalid datetime format: ${runAt}. Use UTC ISO format like '2026-01-31T20:00:00Z'`,
              };
            }
            nextRunAt = runAtDate.toISOString();
            runAtValue = nextRunAt;
            scheduleType = "once";
            jobType = "reminder";
          } else {
            // Recurring reminder
            const nextRun = calculateNextRunFromCron(cronExpression!, timezone);
            nextRunAt = nextRun.toISOString();
            cronExpr = cronExpression!;
            scheduleType = "cron";
            jobType = "recurring";
          }

          const actionPayload: Record<string, unknown> = {
            message: message || title,
            preferred_channel: preferredChannel,
          };

          const { data, error } = await supabase
            .from("scheduled_jobs")
            .insert({
              agent_id: agentId,
              job_type: jobType,
              title,
              description: message || null,
              schedule_type: scheduleType,
              run_at: runAtValue,
              cron_expression: cronExpr,
              next_run_at: nextRunAt,
              timezone,
              action_type: "notify",
              action_payload: actionPayload,
              task_id: taskId || null,
              project_id: projectId || null,
              conversation_id: null,
              status: "active",
            })
            .select()
            .single();

          if (error) return { success: false, error: error.message };

          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          const nextRunFormatted = formatter.format(new Date(nextRunAt));

          if (scheduleType === "once") {
            return {
              success: true,
              reminder: {
                id: data.id,
                title: data.title,
                scheduledFor: nextRunFormatted,
                timezone,
                type: "one-time",
              },
              message: `Reminder set for ${nextRunFormatted} (${timezone}): "${title}"`,
            };
          } else {
            return {
              success: true,
              reminder: {
                id: data.id,
                title: data.title,
                schedule: cronExpr,
                nextRun: nextRunFormatted,
                timezone,
                type: "recurring",
              },
              message: `Recurring reminder created: "${title}" - next: ${nextRunFormatted} (${timezone})`,
            };
          }
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),

    scheduleAgentTask: tool({
      description:
        "Schedule a task for the agent to EXECUTE at a specific time. Use this when the user wants you to DO SOMETHING and send them the results - not just remind them. The agent will wake up, execute the instruction with full tool access, and send results. ALWAYS creates a new conversation. Examples: 'tomorrow at 10am, research AI news and send me a brief', 'every Monday at 9am, check my email and summarize important messages', 'in 2 hours, check if the server is responding'.",
      inputSchema: z.object({
        title: z.string().describe("Name/title of the task"),
        instruction: z
          .string()
          .describe(
            "Detailed instructions for what the agent should do when this job runs. Be specific - this is what the agent will execute."
          ),
        runAt: z
          .string()
          .optional()
          .describe(
            "For ONE-TIME tasks: UTC ISO datetime string ending in Z (e.g., '2026-01-31T20:00:00Z')"
          ),
        cronExpression: z
          .string()
          .optional()
          .describe("For RECURRING tasks: Cron expression (e.g., '0 8 * * *' for 8am daily)"),
        taskId: z.string().optional().describe("Link to an existing task ID"),
        projectId: z.string().optional().describe("Link to an existing project ID"),
      }),
      execute: async ({
        title,
        instruction,
        runAt,
        cronExpression,
        taskId,
        projectId,
      }: {
        title: string;
        instruction: string;
        runAt?: string;
        cronExpression?: string;
        taskId?: string;
        projectId?: string;
      }) => {
        try {
          const timezone = userTimezone || "America/New_York";
          const preferredChannel = preferredNotificationChannel || "app";

          // Validate scheduling options
          if (!runAt && !cronExpression) {
            return {
              success: false,
              error: "Must provide either 'runAt' for one-time or 'cronExpression' for recurring tasks",
            };
          }
          if (runAt && cronExpression) {
            return {
              success: false,
              error: "Provide only one: 'runAt' for one-time OR 'cronExpression' for recurring",
            };
          }

          let nextRunAt: string;
          let scheduleType: "once" | "cron";
          let jobType: "one_time" | "recurring";
          let cronExpr: string | null = null;
          let runAtValue: string | null = null;

          if (runAt) {
            // One-time task
            let utcRunAt = runAt;
            if (!runAt.endsWith("Z") && !runAt.includes("+") && !runAt.includes("-", 10)) {
              utcRunAt = runAt + "Z";
            }
            const runAtDate = new Date(utcRunAt);
            if (isNaN(runAtDate.getTime())) {
              return {
                success: false,
                error: `Invalid datetime format: ${runAt}. Use UTC ISO format like '2026-01-31T20:00:00Z'`,
              };
            }
            nextRunAt = runAtDate.toISOString();
            runAtValue = nextRunAt;
            scheduleType = "once";
            jobType = "one_time";
          } else {
            // Recurring task
            const nextRun = calculateNextRunFromCron(cronExpression!, timezone);
            nextRunAt = nextRun.toISOString();
            cronExpr = cronExpression!;
            scheduleType = "cron";
            jobType = "recurring";
          }

          const actionPayload: Record<string, unknown> = {
            instruction,
            preferred_channel: preferredChannel,
          };

          const { data, error } = await supabase
            .from("scheduled_jobs")
            .insert({
              agent_id: agentId,
              job_type: jobType,
              title,
              description: instruction,
              schedule_type: scheduleType,
              run_at: runAtValue,
              cron_expression: cronExpr,
              next_run_at: nextRunAt,
              timezone,
              action_type: "agent_task",
              action_payload: actionPayload,
              task_id: taskId || null,
              project_id: projectId || null,
              conversation_id: null,
              status: "active",
            })
            .select()
            .single();

          if (error) return { success: false, error: error.message };

          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          const nextRunFormatted = formatter.format(new Date(nextRunAt));

          if (scheduleType === "once") {
            return {
              success: true,
              job: {
                id: data.id,
                title: data.title,
                instruction:
                  instruction.substring(0, 100) + (instruction.length > 100 ? "..." : ""),
                scheduledFor: nextRunFormatted,
                timezone,
                type: "one-time",
              },
              message: `Agent task scheduled for ${nextRunFormatted} (${timezone}): "${title}" - I will execute this and send you the results in a new conversation.`,
            };
          } else {
            return {
              success: true,
              job: {
                id: data.id,
                title: data.title,
                instruction:
                  instruction.substring(0, 100) + (instruction.length > 100 ? "..." : ""),
                schedule: cronExpr,
                nextRun: nextRunFormatted,
                timezone,
                type: "recurring",
              },
              message: `Recurring agent task created: "${title}" - next execution: ${nextRunFormatted} (${timezone}). Each run will start a new conversation with results.`,
            };
          }
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),

    scheduleTaskFollowUp: tool({
      description:
        "Schedule a follow-up reminder to check back on a task at a specific time. Use when waiting for external events like email replies.",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to follow up on"),
        reason: z.string().describe("Why you need to follow up (e.g., 'waiting for email reply')"),
        checkAt: z
          .string()
          .describe("When to check back (ISO datetime, e.g., '2024-01-15T10:00:00Z')"),
        instruction: z
          .string()
          .optional()
          .describe("Specific instruction for what to do when following up"),
      }),
      execute: async ({
        taskId,
        reason,
        checkAt,
        instruction,
      }: {
        taskId: string;
        reason: string;
        checkAt: string;
        instruction?: string;
      }) => {
        // Validate the date
        const checkDate = new Date(checkAt);
        if (isNaN(checkDate.getTime())) {
          return {
            success: false,
            error: "Invalid date format. Use ISO format like '2024-01-15T10:00:00Z'",
          };
        }

        // Get task details
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("id", taskId)
          .eq("agent_id", agentId)
          .single();

        if (taskError || !task) {
          return { success: false, error: "Task not found" };
        }

        // Create the scheduled job
        const { createScheduledJob } = await import("@/lib/db/scheduled-jobs");
        const jobInstruction = instruction || `Follow up on task "${task.title}": ${reason}`;
        const { success, job, error } = await createScheduledJob(supabase, {
          agentId,
          jobType: "follow_up",
          title: `Follow-up: ${task.title}`,
          description: reason,
          scheduleType: "once",
          runAt: checkAt,
          actionType: "agent_task",
          actionPayload: { instruction: jobInstruction, taskId },
          taskId,
        });

        if (!success || error) {
          return { success: false, error: error || "Failed to create scheduled job" };
        }

        // Log a comment about the follow-up
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Scheduled follow-up for ${checkDate.toISOString()}: ${reason}`,
          comment_type: "note",
        });

        return {
          success: true,
          jobId: job?.id,
          taskId,
          taskTitle: task.title,
          scheduledFor: checkAt,
          message: `Follow-up scheduled for ${checkDate.toISOString()}`,
        };
      },
    }),

    listScheduledJobs: tool({
      description: "List all scheduled jobs including reminders, follow-ups, and recurring jobs",
      inputSchema: z.object({
        status: z
          .enum(["active", "paused", "completed", "cancelled", "all"])
          .optional()
          .default("active"),
        jobType: z
          .enum(["reminder", "follow_up", "recurring", "one_time"])
          .optional()
          .describe("Filter by job type"),
      }),
      execute: async ({
        status,
        jobType,
      }: {
        status?: "active" | "paused" | "completed" | "cancelled" | "all";
        jobType?: "reminder" | "follow_up" | "recurring" | "one_time";
      }) => {
        try {
          let query = supabase
            .from("scheduled_jobs")
            .select("id, title, job_type, schedule_type, next_run_at, status, cron_expression, run_at")
            .eq("agent_id", agentId)
            .order("next_run_at", { ascending: true });

          if (status && status !== "all") {
            query = query.eq("status", status);
          }
          if (jobType) {
            query = query.eq("job_type", jobType);
          }

          const { data, error } = await query.limit(50);

          if (error) return { success: false, error: error.message };

          const timezone = userTimezone || "America/New_York";
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

          const jobs = (data || []).map((job) => ({
            id: job.id,
            title: job.title,
            type: job.job_type,
            scheduleType: job.schedule_type,
            nextRun: job.next_run_at ? formatter.format(new Date(job.next_run_at)) : null,
            cronExpression: job.cron_expression,
            status: job.status,
          }));

          return { success: true, jobs, count: jobs.length };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),

    cancelScheduledJob: tool({
      description: "Cancel a scheduled job (reminder, follow-up, or recurring job)",
      inputSchema: z.object({
        jobId: z.string().describe("The ID of the scheduled job to cancel"),
      }),
      execute: async ({ jobId }: { jobId: string }) => {
        try {
          const { data: job, error: fetchError } = await supabase
            .from("scheduled_jobs")
            .select("id, title")
            .eq("id", jobId)
            .eq("agent_id", agentId)
            .single();

          if (fetchError || !job) {
            return { success: false, error: "Scheduled job not found or access denied" };
          }

          const { error } = await supabase
            .from("scheduled_jobs")
            .update({ status: "cancelled" })
            .eq("id", jobId)
            .eq("agent_id", agentId);

          if (error) return { success: false, error: error.message };

          return { success: true, message: `Cancelled: "${job.title}"`, cancelledJobId: jobId };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),

    updateScheduledJob: tool({
      description: "Update a scheduled job's timing, title, or pause/resume it",
      inputSchema: z.object({
        jobId: z.string().describe("The ID of the scheduled job to update"),
        title: z.string().optional().describe("New title"),
        runAt: z.string().optional().describe("New run time for one-time jobs (ISO datetime)"),
        cronExpression: z.string().optional().describe("New cron expression for recurring jobs"),
        status: z.enum(["active", "paused"]).optional().describe("Pause or resume the job"),
      }),
      execute: async ({
        jobId,
        title,
        runAt,
        cronExpression,
        status,
      }: {
        jobId: string;
        title?: string;
        runAt?: string;
        cronExpression?: string;
        status?: "active" | "paused";
      }) => {
        try {
          const { data: currentJob, error: fetchError } = await supabase
            .from("scheduled_jobs")
            .select("*")
            .eq("id", jobId)
            .eq("agent_id", agentId)
            .single();

          if (fetchError || !currentJob) {
            return { success: false, error: "Scheduled job not found or access denied" };
          }

          const updates: Record<string, unknown> = {};
          if (title) updates.title = title;
          if (status) updates.status = status;

          if (runAt) {
            updates.run_at = runAt;
            updates.next_run_at = runAt;
          }

          if (cronExpression) {
            updates.cron_expression = cronExpression;
            const nextRun = calculateNextRunFromCron(
              cronExpression,
              currentJob.timezone || "America/New_York"
            );
            updates.next_run_at = nextRun.toISOString();
          }

          const { data, error } = await supabase
            .from("scheduled_jobs")
            .update(updates)
            .eq("id", jobId)
            .eq("agent_id", agentId)
            .select()
            .single();

          if (error) return { success: false, error: error.message };

          const timezone = userTimezone || "America/New_York";
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

          return {
            success: true,
            job: {
              id: data.id,
              title: data.title,
              status: data.status,
              nextRun: data.next_run_at ? formatter.format(new Date(data.next_run_at)) : null,
            },
            message: `Updated scheduled job: "${data.title}"`,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),
  };
}

// Type exports for UI components (AI SDK best practice)
export type SchedulingTools = ReturnType<typeof createSchedulingTools>;
export type ScheduleReminderToolInvocation = UIToolInvocation<SchedulingTools["scheduleReminder"]>;
export type ScheduleAgentTaskToolInvocation = UIToolInvocation<SchedulingTools["scheduleAgentTask"]>;
export type ScheduleTaskFollowUpToolInvocation = UIToolInvocation<SchedulingTools["scheduleTaskFollowUp"]>;
export type ListScheduledJobsToolInvocation = UIToolInvocation<SchedulingTools["listScheduledJobs"]>;
export type CancelScheduledJobToolInvocation = UIToolInvocation<SchedulingTools["cancelScheduledJob"]>;
export type UpdateScheduledJobToolInvocation = UIToolInvocation<SchedulingTools["updateScheduledJob"]>;
