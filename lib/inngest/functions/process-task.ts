import { inngest } from "../client";
import { tool, streamText, stepCountIs } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt, getAgentById } from "@/lib/db/agents";
import { gatherContextForTask } from "@/lib/db/search";
import { createNotification } from "@/lib/db/notifications";
import { createResearchTool } from "@/lib/tools";

// SAFETY LIMITS
const MAX_TOOL_STEPS = 30;

/**
 * Process an agent-assigned task using Inngest for durable execution
 */
export const processTaskWorkflow = inngest.createFunction(
  {
    id: "process-task",
    retries: 3,
    concurrency: {
      limit: 3,
      key: "event.data.agentId",
    },
  },
  { event: "task/process.start" },
  async ({ event, step }) => {
    const { taskId, agentId } = event.data;
    const supabase = getAdminClient();

    console.log(`[inngest:process-task] Starting task ${taskId}`);

    // Step 1: Lock the task
    await step.run("lock-task", async () => {
      await supabase
        .from("tasks")
        .update({
          agent_run_state: "running",
          last_agent_run_at: new Date().toISOString(),
          lock_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .eq("id", taskId);
    });

    // Step 2: Gather context
    const context = await step.run("gather-context", async () => {
      return await gatherContextForTask(supabase, agentId, taskId);
    });

    if (!context) {
      await step.run("fail-task-no-context", async () => {
        await supabase
          .from("tasks")
          .update({
            agent_run_state: "failed",
            failure_reason: "Failed to gather task context",
            lock_expires_at: null,
          })
          .eq("id", taskId);
      });
      return { success: false, error: "Failed to gather task context" };
    }

    // Step 3: Get agent and build prompt
    const agentContext = await step.run("load-agent", async () => {
      const agent = await getAgentById(supabase, agentId);
      if (!agent) throw new Error("Agent not found");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name, timezone, email")
        .eq("user_id", agent.userId)
        .single();

      const systemPrompt = await buildSystemPrompt(agent, {
        id: agent.userId,
        name: profile?.name || "User",
        timezone: profile?.timezone || undefined,
        email: profile?.email || undefined,
      });

      return { agent, systemPrompt };
    });

    // Build task-specific prompt
    const taskPrompt = buildTaskAgentPrompt(context);
    const combinedSystemPrompt = `${agentContext.systemPrompt}\n\n${taskPrompt}`;

    // Step 4: Create tools and run agent
    const result = await step.run("run-agent", async () => {
      const tools = createTaskTools(supabase, agentId, taskId);

      try {
        const result = streamText({
          model: openai("gpt-4o"),
          system: combinedSystemPrompt,
          messages: [
            {
              role: "user",
              content: `Begin working on the task: "${context.task.title}"`,
            },
          ],
          tools,
          toolChoice: "auto",
          stopWhen: stepCountIs(MAX_TOOL_STEPS),
        });

        // Collect response
        let response = "";
        for await (const chunk of result.textStream) {
          response += chunk;
        }

        return { success: true, response };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`[inngest:process-task] Agent error:`, errorMsg);
        return { success: false, error: errorMsg };
      }
    });

    // Step 5: Get final status and cleanup
    const finalResult = await step.run("finalize", async () => {
      const { data: finalTask } = await supabase
        .from("tasks")
        .select("status, agent_run_state, title")
        .eq("id", taskId)
        .single();

      // Release lock
      await supabase.from("tasks").update({ lock_expires_at: null }).eq("id", taskId);

      // If task wasn't explicitly completed or paused, mark as needing attention
      if (result.success && finalTask?.agent_run_state === "running") {
        await supabase
          .from("tasks")
          .update({ agent_run_state: "completed" })
          .eq("id", taskId);
      } else if (!result.success) {
        const errorMsg = "error" in result ? result.error : "Unknown error";
        await supabase
          .from("tasks")
          .update({
            agent_run_state: "failed",
            failure_reason: errorMsg,
          })
          .eq("id", taskId);

        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "system",
          content: `Task processing failed: ${errorMsg}`,
          comment_type: "note",
        });
      }

      return {
        success: result.success,
        taskId,
        finalStatus: finalTask?.status || "in_progress",
      };
    });

    console.log(`[inngest:process-task] Completed task ${taskId}: ${finalResult.success ? "success" : "failed"}`);
    return finalResult;
  }
);

function buildTaskAgentPrompt(context: NonNullable<Awaited<ReturnType<typeof gatherContextForTask>>>) {
  const sections: string[] = [];

  sections.push(`You are an autonomous AI assistant working on a specific task.`);
  sections.push(``);

  sections.push(`## YOUR CURRENT TASK`);
  sections.push(`**Title:** ${context.task.title}`);
  sections.push(`**Status:** ${context.task.status}`);
  sections.push(`**Priority:** ${context.task.priority}`);
  if (context.task.description) {
    sections.push(`**Description:** ${context.task.description}`);
  }
  sections.push(``);

  if (context.project) {
    sections.push(`## PROJECT CONTEXT`);
    sections.push(`**Project:** ${context.project.title}`);
    sections.push(``);
  }

  if (context.comments.length > 0) {
    sections.push(`## PREVIOUS PROGRESS`);
    [...context.comments]
      .reverse()
      .slice(0, 10)
      .forEach((c) => {
        sections.push(`[${c.author_type}] ${c.content}`);
      });
    sections.push(``);
  }

  if (context.relatedContext) {
    sections.push(`## RELATED CONTEXT`);
    sections.push(context.relatedContext);
    sections.push(``);
  }

  sections.push(`## INSTRUCTIONS`);
  sections.push(`1. Log progress as you work`);
  sections.push(`2. Use markTaskComplete when done`);
  sections.push(`3. Use requestHumanInput if blocked`);
  sections.push(`4. Use scheduleFollowUp to check back later`);

  return sections.join("\n");
}

function createTaskTools(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string,
  taskId: string
) {
  return {
    // Research tool
    research: createResearchTool(agentId),

    logProgress: tool({
      description: "Log progress on the current task",
      inputSchema: z.object({
        content: z.string().describe("Progress update"),
        commentType: z.enum(["progress", "note"]).optional(),
      }),
      execute: async ({ content, commentType }: { content: string; commentType?: "progress" | "note" }) => {
        const { data, error } = await supabase
          .from("comments")
          .insert({
            task_id: taskId,
            author_type: "agent",
            author_id: agentId,
            content,
            comment_type: commentType || "progress",
          })
          .select()
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, commentId: data.id };
      },
    }),

    markTaskComplete: tool({
      description: "Mark the task as complete with a resolution summary",
      inputSchema: z.object({
        resolution: z.string().describe("What was accomplished"),
      }),
      execute: async ({ resolution }: { resolution: string }) => {
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: resolution,
          comment_type: "resolution",
        });

        const { data, error } = await supabase
          .from("tasks")
          .update({
            status: "done",
            completed_at: new Date().toISOString(),
            agent_run_state: "completed",
          })
          .eq("id", taskId)
          .select("title")
          .single();

        if (error) return { success: false, error: error.message };

        await createNotification(
          supabase,
          agentId,
          "task_update",
          `Task completed: ${data.title}`,
          resolution.substring(0, 200),
          "task",
          taskId
        );

        return { success: true, message: "Task completed", stopped: true };
      },
    }),

    requestHumanInput: tool({
      description: "Request input from the user - pauses the task",
      inputSchema: z.object({
        question: z.string().describe("What you need from the user"),
        context: z.string().optional().describe("Additional context"),
      }),
      execute: async ({ question, context }: { question: string; context?: string }) => {
        const content = context
          ? `**Waiting for input:** ${question}\n\n${context}`
          : `**Waiting for input:** ${question}`;

        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content,
          comment_type: "question",
        });

        const { data, error } = await supabase
          .from("tasks")
          .update({ status: "waiting_on", agent_run_state: "needs_input" })
          .eq("id", taskId)
          .select("title")
          .single();

        if (error) return { success: false, error: error.message };

        await createNotification(
          supabase,
          agentId,
          "task_update",
          `Input needed: ${data.title}`,
          question.substring(0, 200),
          "task",
          taskId
        );

        return { success: true, message: "Requested human input", stopped: true };
      },
    }),

    scheduleFollowUp: tool({
      description: "Schedule a follow-up to check back on this task later",
      inputSchema: z.object({
        reason: z.string().describe("Why you need to follow up"),
        checkAt: z.string().describe("When to check (ISO datetime)"),
        instruction: z.string().optional().describe("What to do when following up"),
      }),
      execute: async ({ reason, checkAt, instruction }: { reason: string; checkAt: string; instruction?: string }) => {
        const { createScheduledJob } = await import("@/lib/db/scheduled-jobs");

        const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single();

        const jobInstruction = instruction || `Follow up on task "${task?.title}": ${reason}`;
        const { success, job, error } = await createScheduledJob(supabase, {
          agentId,
          jobType: "follow_up",
          title: `Follow-up: ${task?.title || "Task"}`,
          description: reason,
          scheduleType: "once",
          runAt: checkAt,
          actionType: "agent_task",
          actionPayload: { instruction: jobInstruction, taskId },
          taskId,
        });

        if (!success || error) return { success: false, error: error || "Failed" };

        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Scheduled follow-up for ${new Date(checkAt).toLocaleString()}: ${reason}`,
          comment_type: "note",
        });

        return { success: true, jobId: job?.id, scheduledFor: checkAt };
      },
    }),

    createSubtask: tool({
      description: "Create a subtask to break down work",
      inputSchema: z.object({
        title: z.string().describe("Subtask title"),
        description: z.string().optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        assignToAgent: z.boolean().optional().default(true),
      }),
      execute: async ({ title, description, priority, assignToAgent }: { title: string; description?: string; priority?: "high" | "medium" | "low"; assignToAgent?: boolean }) => {
        const { generateEmbedding } = await import("@/lib/embeddings");

        const { data: parentTask } = await supabase
          .from("tasks")
          .select("project_id")
          .eq("id", taskId)
          .single();

        let assigneeId: string | null = null;
        if (assignToAgent) {
          assigneeId = agentId;
        } else {
          const { data: agentData } = await supabase
            .from("agents")
            .select("user_id")
            .eq("id", agentId)
            .single();
          assigneeId = agentData?.user_id || null;
        }

        const embedding = await generateEmbedding(description ? `${title}\n\n${description}` : title);

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            project_id: parentTask?.project_id || null,
            title,
            description: description || null,
            priority: priority || "medium",
            status: "todo",
            assignee_type: assignToAgent ? "agent" : "user",
            assignee_id: assigneeId,
            blocked_by: [taskId],
            embedding,
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };

        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: `Created subtask: "${title}"`,
          comment_type: "progress",
        });

        return { success: true, subtaskId: data.id, title: data.title };
      },
    }),

    searchContext: tool({
      description: "Search for relevant information",
      inputSchema: z.object({
        query: z.string().describe("What to search for"),
      }),
      execute: async ({ query }: { query: string }) => {
        const { semanticSearchAll, formatContextForAI } = await import("@/lib/db/search");
        const results = await semanticSearchAll(supabase, query, agentId, {
          matchCount: 10,
          matchThreshold: 0.65,
        });
        return { success: true, results: formatContextForAI(results), count: results.length };
      },
    }),
  };
}
