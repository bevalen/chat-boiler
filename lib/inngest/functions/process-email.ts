import { inngest } from "../client";
import { getAdminClient } from "@/lib/supabase/admin";
import { createConversation, addMessage } from "@/lib/db/conversations";
import { logActivity } from "@/lib/db/activity-log";
import { ToolLoopAgent, gateway, tool } from "ai";
import { z } from "zod";
import { gatherContextForEmail, EmailContext, semanticSearchAll, formatContextForAI } from "@/lib/db/search";
import { getAgentById, buildSystemPrompt } from "@/lib/db/agents";
import { generateEmbedding } from "@/lib/embeddings";
import { createNotification } from "@/lib/db/notifications";
import {
  createSendEmailTool,
  createReplyToEmailTool,
  createCheckEmailTool,
  createMarkEmailAsReadTool,
  createGetEmailDetailsTool,
  createGetEmailThreadTool,
  createForwardEmailTool,
} from "@/lib/tools/email-resend";
import { createResearchTool } from "@/lib/tools/research";

/**
 * Build email-specific context addition to the base system prompt
 * This adds the email context to the standard buildSystemPrompt output
 */
function buildEmailContextPromptAddition(context: EmailContext): string {
  const sections: string[] = [];

  sections.push(`## 📧 INCOMING EMAIL CONTEXT`);
  sections.push(`You're processing an incoming email. Here's what you need to know:\n`);

  sections.push(`### Current Email`);
  sections.push(`**From:** ${context.email.from_name || context.email.from_address}`);
  sections.push(`**Subject:** ${context.email.subject || "(No subject)"}`);
  sections.push(`**Content:**`);
  sections.push(context.email.text_body || context.email.html_body || "(No content)");
  sections.push(``);

  // Email thread history
  if (context.threadHistory.length > 0) {
    sections.push(`### Email Thread History`);
    sections.push(`This email is part of an ongoing conversation:`);
    context.threadHistory.forEach((email) => {
      sections.push(`- [${email.direction}] ${email.from_address}: ${email.subject || "(No subject)"}`);
      if (email.text_body) {
        sections.push(`  ${email.text_body.substring(0, 150)}${email.text_body.length > 150 ? "..." : ""}`);
      }
    });
    sections.push(``);
  }

  // Related projects
  if (context.relatedProjects.length > 0) {
    sections.push(`### Related Projects (AI-Detected via Semantic Search)`);
    sections.push(`These projects might be related to this email:`);
    context.relatedProjects.forEach((project) => {
      sections.push(`- **${project.title}** (ID: \`${project.id}\`, ${project.status}, ${Math.round(project.similarity * 100)}% match)`);
      if (project.description) {
        sections.push(`  ${project.description.substring(0, 150)}${project.description.length > 150 ? "..." : ""}`);
      }
    });
    sections.push(``);
  }

  // Related tasks
  if (context.relatedTasks.length > 0) {
    sections.push(`### Related Tasks (AI-Detected via Semantic Search)`);
    sections.push(`These tasks might be related to this email:`);
    context.relatedTasks.forEach((task) => {
      sections.push(`- **${task.title}** (ID: \`${task.id}\`, ${task.status}, ${Math.round(task.similarity * 100)}% match)`);
    });
    sections.push(``);
  }

  // Related conversations
  if (context.relatedConversations.length > 0) {
    sections.push(`### Related Past Conversations`);
    context.relatedConversations.forEach((conv) => {
      sections.push(`- **${conv.title || "Untitled"}** (${conv.channel_type})`);
      if (conv.recentMessage) {
        sections.push(`  Recent: ${conv.recentMessage.substring(0, 100)}...`);
      }
    });
    sections.push(``);
  }

  // Semantic context
  if (context.semanticContext) {
    sections.push(context.semanticContext);
    sections.push(``);
  }

  sections.push(`## Email Processing Instructions`);
  sections.push(`1. **Understand:** Read the email and thread history carefully`);
  sections.push(`2. **Link:** Use \`linkEmailToProject\` or \`linkEmailToTask\` if this relates to existing work`);
  sections.push(`3. **Act:**`);
  sections.push(`   - Use \`replyToEmail\` for responses (maintains threading)`);
  sections.push(`   - Use \`createTask\` or \`createTaskFromEmail\` for action items`);
  sections.push(`   - Use \`createProject\` for new initiatives mentioned in email`);
  sections.push(`   - Use \`markEmailAsRead\` for spam/automated emails`);
  sections.push(`4. **Remember:** Save important info to memory if the user shares preferences or context`);
  sections.push(``);
  sections.push(`**Be contextually aware:** Use the related projects/tasks above to maintain continuity across long-running work.`);

  return sections.join("\n");
}

/**
 * Create email-specific tools for linking and task management
 */
function createEmailAgentTools(
  supabase: ReturnType<typeof getAdminClient>,
  agentId: string,
  emailId: string,
  userId: string
) {
  return {
    linkEmailToProject: tool({
      description: "Link this email to a project. Use when the email is clearly related to a specific project.",
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
            link_type: "email_to_project"
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
      description: "Link this email to a specific task. Use when the email discusses or relates to an existing task.",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to link to"),
        addComment: z.boolean().optional().default(true).describe("Whether to add a comment to the task"),
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
            link_type: "email_to_task"
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
      description: "Create a new task from this email. Use when the email requires action or follow-up.",
      inputSchema: z.object({
        title: z.string().describe("Task title"),
        description: z.string().optional().describe("Task description"),
        priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
        dueDate: z.string().optional().describe("Due date (ISO format)"),
        projectId: z.string().optional().describe("Link to a specific project"),
      }),
      execute: async ({ title, description, priority, dueDate, projectId }) => {
        const { generateEmbedding } = await import("@/lib/embeddings");

        // Generate embedding
        const textToEmbed = description ? `${title}\n\n${description}` : title;
        const embedding = await generateEmbedding(textToEmbed);

        // Create the task
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
            subject: email?.subject
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
        };
      },
    }),

    updateTaskFromEmail: tool({
      description: "Update an existing task based on information in this email. Use when email provides updates about a task.",
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

/**
 * Process inbound emails with AI agent
 * 
 * This function:
 * 1. Gathers comprehensive context (thread history, related projects/tasks, semantic search)
 * 2. Creates or finds an email conversation thread
 * 3. Adds the email as a user message
 * 4. Runs the AI agent with full context and linking tools
 * 5. Agent intelligently responds, links, and creates tasks as needed
 */
export const processInboundEmail = inngest.createFunction(
  {
    id: "process-inbound-email",
    name: "Process Inbound Email",
    retries: 3,
  },
  { event: "email/received.process" },
  async ({ event, step }) => {
    const { emailId, agentId, fromAddress, subject } = event.data;

    console.log(`[process-email] Processing email ${emailId} for agent ${agentId}`);

    // Step 1: Gather comprehensive context
    const context = await step.run("gather-context", async () => {
      const supabase = getAdminClient();
      const emailContext = await gatherContextForEmail(supabase, agentId, emailId, {
        matchCount: 15,
        matchThreshold: 0.6,
      });

      if (!emailContext) {
        throw new Error("Failed to gather email context");
      }

      return emailContext;
    });

    const email = context.email;

    // Step 2: Get or create email conversation
    const conversation = await step.run("get-or-create-conversation", async () => {
      const supabase = getAdminClient();

      // Try to find existing email conversation by thread_id or in_reply_to
      let existingConv = null;

      if (email.thread_id || email.in_reply_to) {
        const { data: existingEmails } = await supabase
          .from("emails")
          .select("id")
          .eq("agent_id", agentId)
          .or(
            email.thread_id 
              ? `thread_id.eq.${email.thread_id}` 
              : `message_id.eq.${email.in_reply_to}`
          )
          .neq("id", emailId)
          .limit(1);

        if (existingEmails && existingEmails.length > 0) {
          // Find conversation that has messages referencing this email thread
          const { data: messages } = await supabase
            .from("messages")
            .select("conversation_id")
            .or(`metadata->>email_id.eq.${existingEmails[0].id}`)
            .limit(1);

          if (messages && messages.length > 0) {
            const { data: conv } = await supabase
              .from("conversations")
              .select("*")
              .eq("id", messages[0].conversation_id)
              .eq("status", "active")
              .single();

            if (conv) existingConv = conv;
          }
        }
      }

      // If no existing conversation, create a new one for this email thread
      if (!existingConv) {
        const conv = await createConversation(
          supabase,
          agentId,
          `Email: ${subject || "No subject"}`
        );

        if (!conv) {
          throw new Error("Failed to create conversation");
        }

        // Update to email channel type
        await supabase
          .from("conversations")
          .update({ channel_type: "email" })
          .eq("id", conv.id);

        return conv;
      }

      return {
        id: existingConv.id,
        agentId: existingConv.agent_id,
        title: existingConv.title,
        channelType: existingConv.channel_type,
        status: existingConv.status,
        createdAt: existingConv.created_at,
        updatedAt: existingConv.updated_at,
      };
    });

    // Step 3: Add email as user message
    await step.run("add-email-message", async () => {
      const supabase = getAdminClient();

      // Fetch full email record for metadata
      const { data: fullEmail } = await supabase
        .from("emails")
        .select("to_addresses, message_id, in_reply_to, thread_id")
        .eq("id", emailId)
        .single();

      // Format email content
      const emailContent = `From: ${email.from_name || email.from_address}
To: ${fullEmail?.to_addresses?.join(", ") || "Unknown"}
Subject: ${email.subject || "(No subject)"}

${email.text_body || email.html_body || "(No content)"}`;

      await addMessage(supabase, conversation.id, "user", emailContent, {
        email_id: emailId,
        from_address: email.from_address,
        subject: email.subject || undefined,
        message_id: fullEmail?.message_id || undefined,
        in_reply_to: email.in_reply_to || undefined,
        thread_id: email.thread_id || undefined,
      });

      return { success: true };
    });

    // Step 4: Run AI agent to process and respond
    const agentResponse = await step.run("run-agent", async () => {
      const supabase = getAdminClient();

      // Get agent using the proper function
      const agent = await getAgentById(supabase, agentId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const { data: profile } = await supabase
        .from("users")
        .select("name, email, timezone")
        .eq("id", agent.userId)
        .single();

      // Build system prompt using the shared function (same as chat)
      const baseSystemPrompt = await buildSystemPrompt(
        agent,
        {
          id: agent.userId,
          name: profile?.name || "User",
          timezone: profile?.timezone,
          email: profile?.email,
        },
        "email" // channel source
      );

      // Add email-specific context to the prompt
      const emailContextAddition = buildEmailContextPromptAddition(context);
      const systemPrompt = `${baseSystemPrompt}\n\n${emailContextAddition}`;

      // Get conversation history
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(20);

      const conversationHistory = (messages || []).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      // Build comprehensive tools (same intelligence as chat endpoint)
      const tools = {
        // Memory tools
        searchMemory: tool({
          description: "Search your memory for relevant information from past conversations, projects, tasks, and saved context.",
          inputSchema: z.object({
            query: z.string(),
            limit: z.number().optional().default(10),
          }),
          execute: async ({ query, limit }) => {
            const queryEmbedding = await generateEmbedding(query);
            const { data } = await supabase.rpc("semantic_search_all", {
              query_embedding: queryEmbedding,
              p_agent_id: agentId,
              match_count: limit,
              match_threshold: 0.5,
            });
            if (!data || data.length === 0) {
              return { success: true, message: "No relevant memories found.", results: [] };
            }
            const results = data.map((item: any) => ({
              type: item.source_type,
              title: item.title,
              content: item.content.substring(0, 300),
              relevance: Math.round(item.similarity * 100) + "%",
            }));
            return { success: true, resultCount: results.length, results };
          },
        }),

        saveToMemory: tool({
          description: "Save important information to memory for future reference.",
          inputSchema: z.object({
            title: z.string(),
            content: z.string(),
            alwaysInclude: z.boolean().optional().default(false),
            category: z.enum(["work_preferences", "personal_background", "communication_style", "technical_preferences", "general"]).optional().default("general"),
          }),
          execute: async ({ title, content, alwaysInclude, category }) => {
            const embedding = await generateEmbedding(`${title}\n\n${content}`);
            const { data, error } = await supabase
              .from("context_blocks")
              .insert({
                agent_id: agentId,
                type: "user_profile",
                title,
                content,
                embedding,
                always_include: alwaysInclude || false,
                category: category || "general",
              })
              .select()
              .single();
            if (error) return { success: false, error: error.message };
            return { success: true, message: `Saved "${title}" to memory.`, id: data.id };
          },
        }),

        // Project tools (critical for linking)
        createProject: tool({
          description: "Create a new project to track work",
          inputSchema: z.object({
            title: z.string(),
            description: z.string().optional(),
            priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
          }),
          execute: async ({ title, description, priority }) => {
            const embedding = await generateEmbedding(description ? `${title}\n\n${description}` : title);
            const { data, error } = await supabase
              .from("projects")
              .insert({
                agent_id: agentId,
                title,
                description: description || null,
                priority,
                status: "active",
                embedding,
              })
              .select()
              .single();
            if (error) return { success: false, error: error.message };
            return { success: true, projectId: data.id, title: data.title, message: `Created project: ${title}` };
          },
        }),

        listProjects: tool({
          description: "List all projects",
          inputSchema: z.object({
            status: z.enum(["active", "completed", "archived", "all"]).optional().default("active"),
          }),
          execute: async ({ status }) => {
            let query = supabase.from("projects").select("id, title, description, status, priority, created_at").eq("agent_id", agentId);
            if (status !== "all") query = query.eq("status", status);
            const { data, error } = await query.order("created_at", { ascending: false });
            if (error) return { success: false, error: error.message, projects: [] };
            return { success: true, count: data?.length || 0, projects: data || [] };
          },
        }),

        // Task tools (critical for linking)
        createTask: tool({
          description: "Create a new task",
          inputSchema: z.object({
            title: z.string(),
            description: z.string().optional(),
            priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
            projectId: z.string().optional(),
            dueDate: z.string().optional(),
            assignTo: z.enum(["agent", "user"]).optional().default("agent"),
          }),
          execute: async ({ title, description, priority, projectId, dueDate, assignTo }) => {
            const embedding = await generateEmbedding(description ? `${title}\n\n${description}` : title);
            const assigneeId = assignTo === "agent" ? agentId : agent.userId;
            const { data, error } = await supabase
              .from("tasks")
              .insert({
                agent_id: agentId,
                project_id: projectId || null,
                title,
                description: description || null,
                priority,
                status: "todo",
                assignee_type: assignTo,
                assignee_id: assigneeId,
                due_date: dueDate || null,
                embedding,
              })
              .select()
              .single();
            if (error) return { success: false, error: error.message };
            return { success: true, taskId: data.id, title: data.title, message: `Created task: ${title}` };
          },
        }),

        listTasks: tool({
          description: "List tasks",
          inputSchema: z.object({
            status: z.enum(["todo", "in_progress", "waiting_on", "done", "all"]).optional().default("all"),
            projectId: z.string().optional(),
          }),
          execute: async ({ status, projectId }) => {
            let query = supabase.from("tasks").select("id, title, description, status, priority, due_date, project_id, created_at").eq("agent_id", agentId);
            if (status !== "all") query = query.eq("status", status);
            if (projectId) query = query.eq("project_id", projectId);
            const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
            if (error) return { success: false, error: error.message, tasks: [] };
            return { success: true, count: data?.length || 0, tasks: data || [] };
          },
        }),

        // Email tools
        sendEmail: createSendEmailTool(agentId, agent.userId, agent.name, profile?.name || "User", profile?.email),
        replyToEmail: createReplyToEmailTool(agentId, agent.userId, agent.name, profile?.name || "User", profile?.email),
        checkEmail: createCheckEmailTool(agentId),
        markEmailAsRead: createMarkEmailAsReadTool(agentId),
        getEmailDetails: createGetEmailDetailsTool(agentId),
        getEmailThread: createGetEmailThreadTool(agentId),
        forwardEmail: createForwardEmailTool(agentId, agent.userId, agent.name, profile?.name || "User", profile?.email),

        // Email-specific linking tools
        ...createEmailAgentTools(supabase, agentId, emailId, agent.userId),

        // Research tool
        research: createResearchTool(agentId),
      };
      
      const aiAgent = new ToolLoopAgent({
        model: gateway("anthropic/claude-sonnet-4.5"),
        instructions: systemPrompt,
        tools,
        stopWhen: [],
      });

      // Run the agent
      try {
        const result = await aiAgent.generate({
          messages: conversationHistory,
        });

        // Save agent's response
        if (result.text) {
          await addMessage(supabase, conversation.id, "assistant", result.text);
        }

        // Extract tool usage stats
        const toolsUsed = result.steps
          .flatMap((s) => s.toolCalls || [])
          .map((tc) => tc.toolName);

        // Check if agent linked to anything
        const linkedToProject = toolsUsed.includes("linkEmailToProject");
        const linkedToTask = toolsUsed.includes("linkEmailToTask");
        const createdTask = toolsUsed.includes("createTaskFromEmail");
        const replied = toolsUsed.includes("replyToEmail");

        return {
          success: true,
          response: result.text,
          toolsUsed,
          linkedToProject,
          linkedToTask,
          createdTask,
          replied,
        };
      } catch (error) {
        console.error("[process-email] Agent error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Step 5: Log completion
    await step.run("log-completion", async () => {
      const supabase = getAdminClient();

      // Build description
      const actions: string[] = [];
      if ("replied" in agentResponse && agentResponse.replied) actions.push("replied");
      if ("createdTask" in agentResponse && agentResponse.createdTask) actions.push("created task");
      if ("linkedToProject" in agentResponse && agentResponse.linkedToProject) actions.push("linked to project");
      if ("linkedToTask" in agentResponse && agentResponse.linkedToTask) actions.push("linked to task");

      const description = agentResponse.success
        ? actions.length > 0
          ? `Agent ${actions.join(", ")}`
          : "Agent reviewed the email"
        : `Agent encountered an error: ${"error" in agentResponse ? agentResponse.error : "Unknown error"}`;

      await logActivity(supabase, {
        agentId,
        activityType: "email_processed",
        source: "email",
        title: `Processed email from ${fromAddress}`,
        description,
        metadata: {
          email_id: emailId,
          conversation_id: conversation.id,
          tools_used: "toolsUsed" in agentResponse ? agentResponse.toolsUsed : [],
          replied: "replied" in agentResponse ? agentResponse.replied : false,
          created_task: "createdTask" in agentResponse ? agentResponse.createdTask : false,
          linked_to_project: "linkedToProject" in agentResponse ? agentResponse.linkedToProject : false,
          linked_to_task: "linkedToTask" in agentResponse ? agentResponse.linkedToTask : false,
          success: agentResponse.success,
          related_projects_found: context.relatedProjects.length,
          related_tasks_found: context.relatedTasks.length,
        },
        status: agentResponse.success ? "completed" : "failed",
      });
    });

    return {
      emailId,
      conversationId: conversation.id,
      agentResponse,
    };
  }
);
