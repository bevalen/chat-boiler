/**
 * Email agent tools
 * Specialized tools for email processing that link emails to projects/tasks
 */

import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/db/activity-log";
import { generateEmbedding } from "@/lib/embeddings";

export interface EmailAgentToolContext {
  supabase: SupabaseClient<any>;
  agentId: string;
  emailId: string;
  userId: string;
}

/**
 * Create email-specific tools for linking and task management
 */
export function createEmailAgentTools(context: EmailAgentToolContext) {
  const { supabase, agentId, emailId, userId } = context;

  return {
    linkEmailToProject: tool({
      description:
        "Link this email to a project. Use when the email is clearly related to a specific project.",
      inputSchema: z.object({
        projectId: z.string().describe("The ID of the project to link to"),
        reason: z.string().optional().describe("Why this email is related to this project"),
      }),
      execute: async ({ projectId, reason }) => {
        // Verify project exists and belongs to agent
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("title")
          .eq("id", projectId)
          .eq("agent_id", agentId)
          .single();

        if (projectError || !project) {
          return { success: false, error: "Project not found or not accessible" };
        }

        // Log the linkage in activity log (creates permanent link)
        await logActivity(supabase, {
          agentId,
          activityType: "system",
          source: "email",
          title: `Linked email to project: ${project.title}`,
          description: reason || `Email linked to project ${project.title}`,
          metadata: {
            email_id: emailId,
            project_id: projectId,
            link_type: "email_to_project",
          },
          projectId,
          status: "completed",
        });

        return {
          success: true,
          message: `Email linked to project: ${project.title}`,
          projectTitle: project.title,
        };
      },
    }),

    linkEmailToTask: tool({
      description:
        "Link this email to a specific task. Use when the email discusses or relates to an existing task.",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to link to"),
        addComment: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to add a comment to the task"),
        comment: z.string().optional().describe("Comment to add to the task about this email"),
      }),
      execute: async ({ taskId, addComment, comment }) => {
        // Verify task exists and belongs to agent
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .select("title, project_id")
          .eq("id", taskId)
          .eq("agent_id", agentId)
          .single();

        if (taskError || !task) {
          return { success: false, error: "Task not found or not accessible" };
        }

        // Get email details for comment
        const { data: email } = await supabase
          .from("emails")
          .select("from_address, from_name, subject, text_body")
          .eq("id", emailId)
          .single();

        // Add comment to task if requested
        if (addComment && email) {
          const commentContent =
            comment ||
            `📧 Email from ${email.from_name || email.from_address}\n**Subject:** ${email.subject}\n\n${email.text_body?.substring(0, 300)}${email.text_body && email.text_body.length > 300 ? "..." : ""}`;

          await supabase.from("comments").insert({
            task_id: taskId,
            author_type: "agent",
            author_id: agentId,
            content: commentContent,
            comment_type: "note",
          });
        }

        // Log the linkage
        await logActivity(supabase, {
          agentId,
          activityType: "system",
          source: "email",
          title: `Linked email to task: ${task.title}`,
          description: `Email from ${email?.from_address} linked to task`,
          metadata: {
            email_id: emailId,
            task_id: taskId,
            link_type: "email_to_task",
          },
          taskId,
          projectId: task.project_id,
          status: "completed",
        });

        return {
          success: true,
          message: `Email linked to task: ${task.title}${addComment ? " with comment" : ""}`,
          taskTitle: task.title,
        };
      },
    }),

    createTaskFromEmail: tool({
      description:
        "Create a new task from this email. Use when the email requires action or follow-up. IMPORTANT: This tool checks for existing similar tasks first to prevent duplicates.",
      inputSchema: z.object({
        title: z.string().describe("Task title"),
        description: z.string().optional().describe("Task description"),
        priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
        dueDate: z.string().optional().describe("Due date (ISO format)"),
        projectId: z.string().optional().describe("Link to a specific project"),
      }),
      execute: async ({ title, description, priority, dueDate, projectId }) => {
        // Generate embedding for similarity search
        const textToEmbed = description ? `${title}\n\n${description}` : title;
        const embedding = await generateEmbedding(textToEmbed);

        // Check for existing similar tasks to prevent duplicates
        const { data: similarTasks } = await supabase.rpc("semantic_search_all", {
          query_embedding: embedding,
          p_agent_id: agentId,
          match_count: 5,
          match_threshold: 0.75, // High threshold for duplicates
        });

        // Filter for tasks only and check if any are open
        const existingSimilarTasks =
          similarTasks?.filter(
            (item: any) =>
              item.source_type === "task" &&
              item.similarity > 0.75 &&
              (item.metadata?.status === "todo" || item.metadata?.status === "in_progress")
          ) || [];

        if (existingSimilarTasks.length > 0) {
          const existingTask = existingSimilarTasks[0];
          const similarityPercent = Math.round(existingTask.similarity * 100);

          // Get email details for the comment
          const { data: email } = await supabase
            .from("emails")
            .select("from_address, from_name, subject, text_body")
            .eq("id", emailId)
            .single();

          // Add comment to existing task instead
          if (email) {
            await supabase.from("comments").insert({
              task_id: existingTask.metadata.id,
              author_type: "agent",
              author_id: agentId,
              content: `📧 Related email from ${email.from_name || email.from_address}\n**Subject:** ${email.subject}\n\n${email.text_body?.substring(0, 300)}${email.text_body && email.text_body.length > 300 ? "..." : ""}`,
              comment_type: "note",
            });
          }

          return {
            success: true,
            taskId: existingTask.metadata.id,
            title: existingTask.title,
            message: `Found existing similar task "${existingTask.title}" (${similarityPercent}% match). Added email as comment instead of creating duplicate.`,
            isDuplicate: true,
          };
        }

        // No similar task found, create a new one
        const { data: task, error } = await supabase
          .from("tasks")
          .insert({
            agent_id: agentId,
            project_id: projectId || null,
            title,
            description: description || null,
            priority,
            status: "todo",
            assignee_type: "agent",
            assignee_id: agentId,
            due_date: dueDate || null,
            embedding,
          })
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        // Get email details
        const { data: email } = await supabase
          .from("emails")
          .select("from_address, from_name, subject, text_body")
          .eq("id", emailId)
          .single();

        // Add email as a comment on the task (creates the link)
        if (email) {
          await supabase.from("comments").insert({
            task_id: task.id,
            author_type: "agent",
            author_id: agentId,
            content: `📧 Created from email from ${email.from_name || email.from_address}\n**Subject:** ${email.subject}\n\n${email.text_body?.substring(0, 300)}${email.text_body && email.text_body.length > 300 ? "..." : ""}`,
            comment_type: "note",
          });
        }

        // Log the creation and linkage
        await logActivity(supabase, {
          agentId,
          activityType: "task_created",
          source: "email",
          title: `Created task from email: ${title}`,
          description: `Task created based on email from ${email?.from_address}`,
          metadata: {
            email_id: emailId,
            task_id: task.id,
            from_email: true,
            subject: email?.subject,
          },
          taskId: task.id,
          projectId: projectId || undefined,
          status: "completed",
        });

        return {
          success: true,
          taskId: task.id,
          title: task.title,
          message: `Created task: ${title}`,
          isDuplicate: false,
        };
      },
    }),

    updateTaskFromEmail: tool({
      description:
        "Update an existing task based on information in this email. Use when email provides updates about a task.",
      inputSchema: z.object({
        taskId: z.string().describe("The task ID to update"),
        status: z.enum(["todo", "in_progress", "waiting_on", "done"]).optional(),
        comment: z.string().describe("Comment explaining the update based on the email"),
      }),
      execute: async ({ taskId, status, comment }) => {
        // Update status if provided
        if (status) {
          await supabase
            .from("tasks")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", taskId);
        }

        // Add comment
        await supabase.from("comments").insert({
          task_id: taskId,
          author_type: "agent",
          author_id: agentId,
          content: comment,
          comment_type: status ? "status_change" : "note",
        });

        return {
          success: true,
          message: `Updated task ${taskId}${status ? ` to ${status}` : ""}`,
        };
      },
    }),
  };
}
