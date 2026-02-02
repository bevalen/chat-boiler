import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";
import { createNotification } from "@/lib/db/notifications";

// Helper to resolve assignee ID from type
async function resolveAssigneeId(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string,
  assigneeType: "user" | "agent" | undefined
): Promise<string | null> {
  if (!assigneeType) return null;
  
  if (assigneeType === "agent") {
    // Assign to the agent itself
    return agentId;
  }
  
  if (assigneeType === "user") {
    // Look up the user_id from the agent
    const { data: agent } = await supabase
      .from("agents")
      .select("user_id")
      .eq("id", agentId)
      .single();
    
    return agent?.user_id || null;
  }
  
  return null;
}

export const createTaskTool = tool({
  description: "Create a new task, optionally linked to a project and assigned to a user or agent",
  inputSchema: z.object({
    title: z.string().describe("The title of the task"),
    description: z.string().optional().describe("A description of the task"),
    projectId: z
      .string()
      .optional()
      .describe("The ID of the project to link this task to"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("Priority level of the task"),
    dueDate: z
      .string()
      .optional()
      .describe("Due date in ISO format (e.g., 2024-01-15)"),
    assigneeType: z
      .enum(["user", "agent"])
      .optional()
      .describe("Who should work on this task: 'user' (the human owner) or 'agent' (the AI assistant). The ID is resolved automatically."),
  }),
  execute: async (
    { title, description, projectId, priority, dueDate, assigneeType },
    options
  ) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    // Default to user if no assignee specified - tasks should always have an owner
    const effectiveAssigneeType = assigneeType || "user";
    
    // Auto-resolve assignee ID from type
    const assigneeId = await resolveAssigneeId(supabase, agentId, effectiveAssigneeType);

    // Generate embedding for task (title + description)
    const textToEmbed = description ? `${title}\n\n${description}` : title;
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(textToEmbed);
    } catch (embeddingError) {
      console.error("Error generating task embedding:", embeddingError);
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        agent_id: agentId as string,
        title,
        description,
        project_id: projectId || null,
        priority: priority || "medium",
        status: "todo",
        due_date: dueDate || null,
        assignee_type: effectiveAssigneeType,
        assignee_id: assigneeId,
        embedding,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      task: {
        id: data.id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        dueDate: data.due_date,
        assigneeType: data.assignee_type,
      },
    };
  },
});

export const listTasksTool = tool({
  description: "List tasks, optionally filtered by status, project, or assignee",
  inputSchema: z.object({
    status: z
      .enum(["todo", "in_progress", "waiting_on", "done", "all"])
      .optional()
      .describe("Filter by task status"),
    projectId: z
      .string()
      .optional()
      .describe("Filter tasks by project ID"),
    assigneeType: z
      .enum(["user", "agent"])
      .optional()
      .describe("Filter by who is assigned: 'user' or 'agent'"),
  }),
  execute: async ({ status, projectId, assigneeType }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    let query = supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, due_date, project_id, created_at, completed_at, assignee_type, assignee_id, blocked_by"
      )
      .eq("agent_id", agentId as string)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (assigneeType) {
      query = query.eq("assignee_type", assigneeType);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      tasks: data,
      count: data.length,
    };
  },
});

export const completeTaskTool = tool({
  description: "Mark a task as done (completed)",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to complete"),
  }),
  execute: async ({ taskId }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Create notification for task completion
    await createNotification(
      supabase,
      agentId as string,
      "task_update",
      `Task completed: ${data.title}`,
      "Your task has been marked as done.",
      "task",
      taskId
    );

    return {
      success: true,
      task: data,
    };
  },
});

export const updateTaskTool = tool({
  description: "Update an existing task's details, status, or assignment",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to update"),
    title: z.string().optional().describe("New title for the task"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["todo", "in_progress", "waiting_on", "done"])
      .optional()
      .describe("New status: todo, in_progress, waiting_on, or done"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("New priority level"),
    dueDate: z.string().optional().describe("New due date in ISO format"),
    assigneeType: z
      .enum(["user", "agent"])
      .optional()
      .describe("Reassign to 'user' (the human owner) or 'agent' (the AI assistant). The ID is resolved automatically."),
    blockedBy: z
      .array(z.string())
      .optional()
      .describe("Array of task IDs that block this task"),
  }),
  execute: async (
    { taskId, title, description, status, priority, dueDate, assigneeType, blockedBy },
    options
  ) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    const updates: Record<string, unknown> = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status) {
      updates.status = status;
      if (status === "done") {
        updates.completed_at = new Date().toISOString();
      }
    }
    if (priority) updates.priority = priority;
    if (dueDate) updates.due_date = dueDate;
    if (assigneeType !== undefined) {
      updates.assignee_type = assigneeType;
      // Auto-resolve the assignee ID
      updates.assignee_id = await resolveAssigneeId(supabase, agentId, assigneeType);
    }
    if (blockedBy !== undefined) updates.blocked_by = blockedBy;

    // If title or description changed, regenerate embedding
    if (title || description !== undefined) {
      // Fetch current task to get full text for embedding
      const { data: current } = await supabase
        .from("tasks")
        .select("title, description")
        .eq("id", taskId)
        .single();

      if (current) {
        const newTitle = title || current.title;
        const newDescription = description !== undefined ? description : current.description;
        const textToEmbed = newDescription ? `${newTitle}\n\n${newDescription}` : newTitle;
        
        try {
          updates.embedding = await generateEmbedding(textToEmbed);
        } catch (embeddingError) {
          console.error("Error generating task embedding:", embeddingError);
        }
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Create notification for status changes
    if (status) {
      const statusMessages: Record<string, string> = {
        todo: "Task moved to todo",
        in_progress: "Task is now in progress",
        waiting_on: "Task is waiting on input/dependency",
        done: "Task has been completed",
      };
      await createNotification(
        supabase,
        agentId as string,
        "task_update",
        `${data.title}: ${statusMessages[status] || "Status updated"}`,
        null,
        "task",
        taskId
      );
    }

    return {
      success: true,
      task: data,
    };
  },
});

export const getTaskTool = tool({
  description: "Get details of a specific task by ID, including assignee and dependencies",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to retrieve"),
  }),
  execute: async ({ taskId }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, due_date, project_id, created_at, completed_at, assignee_type, assignee_id, blocked_by, agent_run_state, last_agent_run_at"
      )
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Task not found" };
    }

    return {
      success: true,
      task: data,
    };
  },
});

export const deleteTaskTool = tool({
  description: "Delete a task",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to delete"),
  }),
  execute: async ({ taskId }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    // First verify the task belongs to this agent and get its title
    const { data: task, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("id", taskId)
      .eq("agent_id", agentId as string)
      .single();

    if (fetchError || !task) {
      return { success: false, error: "Task not found or access denied" };
    }

    // Delete the task
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("agent_id", agentId as string);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return {
      success: true,
      message: `Task "${task.title}" has been deleted`,
      deletedTaskId: taskId,
    };
  },
});

export const createSubtaskTool = tool({
  description: "Create a subtask linked to a parent task. Useful for breaking down complex work.",
  inputSchema: z.object({
    parentTaskId: z.string().describe("The ID of the parent task"),
    title: z.string().describe("Title of the subtask"),
    description: z.string().optional().describe("Description of what needs to be done"),
    priority: z.enum(["high", "medium", "low"]).optional().describe("Priority level"),
    assigneeType: z
      .enum(["user", "agent"])
      .optional()
      .describe("Who should work on this subtask: 'user' or 'agent'. Defaults to agent."),
  }),
  execute: async ({ parentTaskId, title, description, priority, assigneeType }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    // Get the parent task to inherit project_id
    const { data: parentTask, error: parentError } = await supabase
      .from("tasks")
      .select("id, title, project_id")
      .eq("id", parentTaskId)
      .eq("agent_id", agentId)
      .single();

    if (parentError || !parentTask) {
      return { success: false, error: "Parent task not found" };
    }

    // Resolve assignee
    const assignee = assigneeType || "agent";
    const assigneeId = await resolveAssigneeId(supabase, agentId, assignee);

    // Generate embedding
    const textToEmbed = description ? `${title}\n\n${description}` : title;
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(textToEmbed);
    } catch (e) {
      console.error("Error generating subtask embedding:", e);
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        agent_id: agentId,
        project_id: parentTask.project_id,
        title,
        description: description || null,
        priority: priority || "medium",
        status: "todo",
        assignee_type: assignee,
        assignee_id: assigneeId,
        blocked_by: [parentTaskId], // Subtask is related to parent
        embedding,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Add a comment on the parent task
    await supabase.from("comments").insert({
      task_id: parentTaskId,
      author_type: "agent",
      author_id: agentId,
      content: `Created subtask: "${title}"`,
      comment_type: "progress",
    });

    return {
      success: true,
      subtask: {
        id: data.id,
        title: data.title,
        parentTaskId,
        parentTaskTitle: parentTask.title,
      },
      message: `Created subtask "${title}" under "${parentTask.title}"`,
    };
  },
});

export const scheduleTaskFollowUpTool = tool({
  description: "Schedule a follow-up reminder to check back on a task at a specific time. Use when waiting for external events.",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to follow up on"),
    reason: z.string().describe("Why you need to follow up (e.g., 'waiting for email reply')"),
    checkAt: z.string().describe("When to check back (ISO datetime, e.g., '2024-01-15T10:00:00Z')"),
    instruction: z.string().optional().describe("Specific instruction for what to do when following up"),
  }),
  execute: async ({ taskId, reason, checkAt, instruction }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");
    const supabase = getAdminClient();

    // Validate the date
    const checkDate = new Date(checkAt);
    if (isNaN(checkDate.getTime())) {
      return { success: false, error: "Invalid date format. Use ISO format like '2024-01-15T10:00:00Z'" };
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

    // Import createScheduledJob dynamically to avoid circular deps
    const { createScheduledJob } = await import("@/lib/db/scheduled-jobs");

    // Create the scheduled job
    const jobInstruction = instruction || `Follow up on task "${task.title}": ${reason}`;
    const { success, job, error } = await createScheduledJob(supabase, {
      agentId,
      jobType: "follow_up",
      title: `Follow-up: ${task.title}`,
      description: reason,
      scheduleType: "once",
      runAt: checkAt,
      actionType: "agent_task",
      actionPayload: {
        instruction: jobInstruction,
        taskId,
      },
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
      content: `Scheduled follow-up for ${checkDate.toLocaleString()}: ${reason}`,
      comment_type: "note",
    });

    return {
      success: true,
      jobId: job?.id,
      taskId,
      taskTitle: task.title,
      scheduledFor: checkAt,
      message: `Follow-up scheduled for ${checkDate.toLocaleString()}`,
    };
  },
});

// Export types for UI components
export type CreateTaskToolInvocation = UIToolInvocation<typeof createTaskTool>;
export type ListTasksToolInvocation = UIToolInvocation<typeof listTasksTool>;
export type CompleteTaskToolInvocation = UIToolInvocation<
  typeof completeTaskTool
>;
export type UpdateTaskToolInvocation = UIToolInvocation<typeof updateTaskTool>;
export type GetTaskToolInvocation = UIToolInvocation<typeof getTaskTool>;
export type DeleteTaskToolInvocation = UIToolInvocation<typeof deleteTaskTool>;
export type CreateSubtaskToolInvocation = UIToolInvocation<typeof createSubtaskTool>;
export type ScheduleTaskFollowUpToolInvocation = UIToolInvocation<typeof scheduleTaskFollowUpTool>;
