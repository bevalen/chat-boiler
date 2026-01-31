import { streamText, convertToModelMessages, UIMessage, tool, stepCountIs, gateway } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser, buildSystemPrompt } from "@/lib/db/agents";
import {
  getOrCreateDefaultConversation,
  addMessage,
  getMessagesForSlackThread,
} from "@/lib/db/conversations";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";
import { ChannelType, MessageMetadata, FeedbackType, FeedbackPriority } from "@/lib/types/database";
import { 
  createCheckEmailTool, 
  createSendEmailTool, 
  createForwardEmailToUserTool,
  createReplyToEmailTool,
  createArchiveEmailTool,
  createEmailDraftTool,
} from "@/lib/tools/email";
import { createResearchTool } from "@/lib/tools/research";
import { createFeedback, searchFeedback, updateFeedback, deleteFeedback, createAutomaticBugReport } from "@/lib/db/feedback";

export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("[chat/route] POST request received");

  try {
    const {
      messages,
      conversationId,
      channelSource,
      channelMetadata,
      userId: externalUserId, // For internal API calls (e.g., Slack bot)
    }: {
      messages: UIMessage[];
      conversationId?: string;
      channelSource?: ChannelType;
      channelMetadata?: {
        slack_channel_id?: string;
        slack_thread_ts?: string;
        slack_user_id?: string;
        email_from?: string;
        email_subject?: string;
        email_message_id?: string;
      };
      userId?: string;
    } = await request.json();
    console.log("[chat/route] Messages received:", messages.length);
    console.log("[chat/route] Channel source:", channelSource || "app");

    // Check for internal API authentication (service role key)
    const authHeader = request.headers.get("Authorization");
    const expectedAuth = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
    const isInternalCall = authHeader === expectedAuth;
    
    let user: { id: string } | null = null;
    let supabase;
    
    if (isInternalCall && externalUserId) {
      // Internal API call with service role key - use admin client
      console.log("[chat/route] Internal API call for user:", externalUserId);
      supabase = getAdminClient();
      user = { id: externalUserId };
    } else {
      // Regular browser-based authentication
      supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user profile for context (including notification preferences and email)
    const { data: profile } = await supabase
      .from("users")
      .select("name, email, timezone, preferred_notification_channel")
      .eq("id", user.id)
      .single();

    // Get the user's agent
    const agent = await getAgentForUser(supabase, user.id);

    if (!agent) {
      return new Response(
        JSON.stringify({ error: "No agent configured. Please set up your assistant in settings." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get or create a conversation
    let conversation;
    if (conversationId) {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("agent_id", agent.id)
        .single();
      conversation = data;
    }

    if (!conversation) {
      conversation = await getOrCreateDefaultConversation(supabase, agent.id);
    }

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Failed to create conversation" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // For Slack messages with a thread, fetch previous messages from the same thread
    // This ensures the AI has context of the full conversation
    let messagesWithHistory = messages;
    if (channelSource === "slack" && channelMetadata?.slack_thread_ts) {
      const threadTs = channelMetadata.slack_thread_ts;
      console.log("[chat/route] Fetching Slack thread history for:", threadTs);
      
      const threadMessages = await getMessagesForSlackThread(
        supabase,
        conversation.id,
        threadTs,
        30 // Limit to last 30 messages in thread
      );

      if (threadMessages.length > 0) {
        console.log(`[chat/route] Found ${threadMessages.length} previous messages in thread`);
        
        // Convert database messages to UIMessage format
        const historyMessages: UIMessage[] = threadMessages.map((msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          parts: [{ type: "text" as const, text: msg.content }],
        }));

        // Get the current message content to check for duplicates
        const currentMessageContent = messages
          .filter((m) => m.role === "user")
          .map((m) => 
            m.parts
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n")
          )
          .join("\n");

        // Filter out the current message from history if it was already saved
        const filteredHistory = historyMessages.filter((msg) => {
          // Skip if this exact content matches the current message
          // Extract content from parts for comparison
          const msgContent = msg.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n");
          if (msg.role === "user" && msgContent === currentMessageContent) {
            return false;
          }
          return true;
        });

        // Prepend history to current messages
        messagesWithHistory = [...filteredHistory, ...messages];
        console.log(`[chat/route] Total messages with history: ${messagesWithHistory.length}`);
      }
    }

    // Build the system prompt from agent configuration
    const systemPrompt = buildSystemPrompt(agent, {
      id: user.id,
      name: profile?.name || "User",
      timezone: profile?.timezone || undefined,
      email: profile?.email || undefined,
    });

    console.log("[chat/route] Using agent:", agent.name);
    console.log("[chat/route] Conversation:", conversation.id);

    // Build metadata for messages from this channel
    const messageMetadata: MessageMetadata | undefined =
      channelSource && channelSource !== "app"
        ? {
            channel_source: channelSource,
            slack_channel_id: channelMetadata?.slack_channel_id,
            slack_thread_ts: channelMetadata?.slack_thread_ts,
            slack_user_id: channelMetadata?.slack_user_id,
            email_from: channelMetadata?.email_from,
            email_subject: channelMetadata?.email_subject,
            email_message_id: channelMetadata?.email_message_id,
          }
        : undefined;

    // Get the last user message to persist
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    if (lastUserMessage) {
      const content = lastUserMessage.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      if (content) {
        await addMessage(supabase, conversation.id, "user", content, messageMetadata as Record<string, unknown> | undefined);
      }
    }

    // Check if this is a new conversation that needs a title
    const needsTitle =
      conversation.title === "New conversation" && messages.length <= 2;

    // Get admin client for tool operations
    const adminSupabase = getAdminClient();
    const agentId = agent.id;

    // Helper to resolve assignee ID from type (no UUID needed from agent)
    const resolveAssigneeId = async (assigneeType: "user" | "agent" | undefined): Promise<string | null> => {
      if (!assigneeType) return null;
      if (assigneeType === "agent") return agentId;
      if (assigneeType === "user") {
        const { data: agentData } = await adminSupabase
          .from("agents")
          .select("user_id")
          .eq("id", agentId)
          .single();
        return agentData?.user_id || null;
      }
      return null;
    };

    // Define tools with agent context captured in closure
    const tools = {
      searchMemory: tool({
        description: "Search your memory for relevant information from past conversations, projects, tasks, and saved context. Use this when the user asks about something you discussed before or when you need to recall past information.",
        inputSchema: z.object({
          query: z.string().describe("What to search for in memory"),
          limit: z.number().optional().default(10).describe("Max results"),
        }),
        execute: async ({ query, limit }: { query: string; limit?: number }) => {
          try {
            const queryEmbedding = await generateEmbedding(query);
            const { data, error } = await adminSupabase.rpc("semantic_search_all", {
              query_embedding: queryEmbedding,
              p_agent_id: agentId,
              match_count: limit || 10,
              match_threshold: 0.5,
            });

            if (error) {
              return { success: false, error: error.message, results: [] };
            }

            if (!data || data.length === 0) {
              return { success: true, message: "No relevant memories found.", results: [], query };
            }

            const results = data.map((item: { source_type: string; title: string; content: string; similarity: number; created_at: string }) => ({
              type: item.source_type,
              title: item.title,
              content: item.content.length > 300 ? item.content.substring(0, 300) + "..." : item.content,
              relevance: Math.round(item.similarity * 100) + "%",
              date: new Date(item.created_at).toLocaleDateString(),
            }));

            return { success: true, query, resultCount: results.length, results };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error", results: [] };
          }
        },
      }),

      saveToMemory: tool({
        description: "Save important information to memory for future reference.",
        inputSchema: z.object({
          title: z.string().describe("Short title for this memory"),
          content: z.string().describe("Content to remember"),
        }),
        execute: async ({ title, content }: { title: string; content: string }) => {
          try {
            const embedding = await generateEmbedding(`${title}\n\n${content}`);
            const { data, error } = await adminSupabase
              .from("context_blocks")
              .insert({ agent_id: agentId, type: "user_profile", title, content, embedding })
              .select()
              .single();

            if (error) return { success: false, error: error.message };
            return { success: true, message: `Saved "${title}" to memory.`, id: data.id };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      getRecentConversations: tool({
        description: "Get recent conversations and their messages. Use this to recall what was discussed recently, summarize past conversations, or find specific discussions. This is a direct database query, not semantic search.",
        inputSchema: z.object({
          daysBack: z.number().optional().default(7).describe("How many days back to look (default 7)"),
          limit: z.number().optional().default(5).describe("Max number of conversations to return (default 5)"),
          includeMessages: z.boolean().optional().default(true).describe("Whether to include message content"),
          messagesPerConversation: z.number().optional().default(10).describe("Max messages per conversation (default 10)"),
        }),
        execute: async ({ daysBack, limit, includeMessages, messagesPerConversation }: { 
          daysBack?: number; 
          limit?: number; 
          includeMessages?: boolean;
          messagesPerConversation?: number;
        }) => {
          try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - (daysBack || 7));

            // Get recent conversations
            const { data: conversations, error: convError } = await adminSupabase
              .from("conversations")
              .select("id, title, channel_type, created_at, updated_at")
              .eq("agent_id", agentId)
              .gte("updated_at", cutoffDate.toISOString())
              .order("updated_at", { ascending: false })
              .limit(limit || 5);

            if (convError) {
              return { success: false, error: convError.message, conversations: [] };
            }

            if (!conversations || conversations.length === 0) {
              return { 
                success: true, 
                message: `No conversations found in the last ${daysBack || 7} days.`,
                conversations: [] 
              };
            }

            // Optionally fetch messages for each conversation
            const results = [];
            for (const conv of conversations) {
              const convResult: {
                id: string;
                title: string | null;
                channel: string;
                lastUpdated: string;
                created: string;
                messages?: Array<{ role: string; content: string; timestamp: string }>;
                messageCount?: number;
              } = {
                id: conv.id,
                title: conv.title,
                channel: conv.channel_type || "app",
                lastUpdated: new Date(conv.updated_at).toLocaleString(),
                created: new Date(conv.created_at).toLocaleString(),
              };

              if (includeMessages !== false) {
                const { data: messages } = await adminSupabase
                  .from("messages")
                  .select("role, content, created_at")
                  .eq("conversation_id", conv.id)
                  .order("created_at", { ascending: true })
                  .limit(messagesPerConversation || 10);

                if (messages && messages.length > 0) {
                  convResult.messages = messages.map(m => ({
                    role: m.role,
                    content: m.content.length > 500 ? m.content.substring(0, 500) + "..." : m.content,
                    timestamp: new Date(m.created_at).toLocaleString(),
                  }));
                  convResult.messageCount = messages.length;
                }
              }

              results.push(convResult);
            }

            return { 
              success: true, 
              daysBack: daysBack || 7,
              conversationCount: results.length,
              conversations: results,
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error", conversations: [] };
          }
        },
      }),

      createProject: tool({
        description: "Create a new project to track work",
        inputSchema: z.object({
          title: z.string().describe("Project title"),
          description: z.string().optional().describe("Project description"),
          priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
        }),
        execute: async ({ title, description, priority }: { title: string; description?: string; priority?: "high" | "medium" | "low" }) => {
          const textToEmbed = description ? `${title}\n\n${description}` : title;
          const embedding = await generateEmbedding(textToEmbed);
          const { data, error } = await adminSupabase
            .from("projects")
            .insert({ agent_id: agentId, title, description, priority: priority || "medium", status: "active", embedding })
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, project: { id: data.id, title: data.title, status: data.status, priority: data.priority } };
        },
      }),

      listProjects: tool({
        description: "List all projects",
        inputSchema: z.object({
          status: z.enum(["active", "paused", "completed", "all"]).optional().default("active"),
        }),
        execute: async ({ status }: { status?: "active" | "paused" | "completed" | "all" }) => {
          let query = adminSupabase
            .from("projects")
            .select("id, title, description, status, priority, created_at")
            .eq("agent_id", agentId)
            .order("created_at", { ascending: false });

          if (status && status !== "all") {
            query = query.eq("status", status);
          }

          const { data, error } = await query;
          if (error) return { success: false, error: error.message };
          return { success: true, projects: data, count: data?.length || 0 };
        },
      }),

      getProject: tool({
        description: "Get details of a specific project by ID",
        inputSchema: z.object({
          projectId: z.string().describe("The ID of the project to retrieve"),
        }),
        execute: async ({ projectId }: { projectId: string }) => {
          const { data, error } = await adminSupabase
            .from("projects")
            .select("id, title, description, status, priority, created_at, updated_at")
            .eq("id", projectId)
            .eq("agent_id", agentId)
            .single();

          if (error) return { success: false, error: error.message };
          if (!data) return { success: false, error: "Project not found" };
          return { success: true, project: data };
        },
      }),

      updateProject: tool({
        description: "Update an existing project's title, description, status, or priority",
        inputSchema: z.object({
          projectId: z.string().describe("The ID of the project to update"),
          title: z.string().optional().describe("New title for the project"),
          description: z.string().optional().describe("New description"),
          status: z.enum(["active", "paused", "completed"]).optional().describe("New status"),
          priority: z.enum(["high", "medium", "low"]).optional().describe("New priority level"),
        }),
        execute: async ({ projectId, title, description, status, priority }: { projectId: string; title?: string; description?: string; status?: "active" | "paused" | "completed"; priority?: "high" | "medium" | "low" }) => {
          const updates: Record<string, unknown> = {};
          if (title) updates.title = title;
          if (description !== undefined) updates.description = description;
          if (status) updates.status = status;
          if (priority) updates.priority = priority;

          // If title or description changed, regenerate embedding
          if (title || description !== undefined) {
            const { data: current } = await adminSupabase
              .from("projects")
              .select("title, description")
              .eq("id", projectId)
              .single();

            if (current) {
              const newTitle = title || current.title;
              const newDescription = description !== undefined ? description : current.description;
              const textToEmbed = newDescription ? `${newTitle}\n\n${newDescription}` : newTitle;
              try {
                updates.embedding = await generateEmbedding(textToEmbed);
              } catch (err) {
                console.error("Error generating project embedding:", err);
              }
            }
          }

          const { data, error } = await adminSupabase
            .from("projects")
            .update(updates)
            .eq("id", projectId)
            .eq("agent_id", agentId)
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, project: { id: data.id, title: data.title, status: data.status, priority: data.priority } };
        },
      }),

      deleteProject: tool({
        description: "Delete a project and optionally its associated tasks",
        inputSchema: z.object({
          projectId: z.string().describe("The ID of the project to delete"),
          deleteTasks: z.boolean().optional().default(false).describe("Whether to also delete all tasks associated with this project"),
        }),
        execute: async ({ projectId, deleteTasks }: { projectId: string; deleteTasks?: boolean }) => {
          // First verify the project belongs to this agent
          const { data: project, error: fetchError } = await adminSupabase
            .from("projects")
            .select("id, title")
            .eq("id", projectId)
            .eq("agent_id", agentId)
            .single();

          if (fetchError || !project) {
            return { success: false, error: "Project not found or access denied" };
          }

          // If deleteTasks is true, delete associated tasks first
          if (deleteTasks) {
            const { error: tasksError } = await adminSupabase
              .from("tasks")
              .delete()
              .eq("project_id", projectId)
              .eq("agent_id", agentId);

            if (tasksError) {
              return { success: false, error: `Failed to delete tasks: ${tasksError.message}` };
            }
          } else {
            // Unlink tasks from the project (set project_id to null)
            await adminSupabase
              .from("tasks")
              .update({ project_id: null })
              .eq("project_id", projectId)
              .eq("agent_id", agentId);
          }

          // Delete the project
          const { error: deleteError } = await adminSupabase
            .from("projects")
            .delete()
            .eq("id", projectId)
            .eq("agent_id", agentId);

          if (deleteError) return { success: false, error: deleteError.message };
          return { success: true, message: `Project "${project.title}" has been deleted${deleteTasks ? " along with its tasks" : ""}`, deletedProjectId: projectId };
        },
      }),

      createTask: tool({
        description: "Create a new task, optionally assigned to user or agent",
        inputSchema: z.object({
          title: z.string().describe("Task title"),
          description: z.string().optional().describe("Task description"),
          priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
          dueDate: z.string().optional().describe("Due date (ISO format)"),
          projectId: z.string().optional().describe("Project ID to link to"),
          assigneeType: z.enum(["user", "agent"]).optional().describe("Who should work on this: 'user' (the human owner) or 'agent' (AI assistant). ID is resolved automatically."),
        }),
        execute: async ({ title, description, priority, dueDate, projectId, assigneeType }: { title: string; description?: string; priority?: "high" | "medium" | "low"; dueDate?: string; projectId?: string; assigneeType?: "user" | "agent" }) => {
          const textToEmbed = description ? `${title}\n\n${description}` : title;
          const embedding = await generateEmbedding(textToEmbed);
          // Auto-resolve assignee ID from type
          const assigneeId = await resolveAssigneeId(assigneeType);
          const { data, error } = await adminSupabase
            .from("tasks")
            .insert({
              agent_id: agentId,
              title,
              description,
              priority: priority || "medium",
              status: "todo",
              due_date: dueDate || null,
              project_id: projectId || null,
              assignee_type: assigneeType || null,
              assignee_id: assigneeId,
              embedding,
            })
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, task: { id: data.id, title: data.title, status: data.status, priority: data.priority, assigneeType: data.assignee_type } };
        },
      }),

      listTasks: tool({
        description: "List tasks, optionally filtered by status, project, or assignee",
        inputSchema: z.object({
          status: z.enum(["todo", "in_progress", "waiting_on", "done", "all"]).optional().default("all"),
          projectId: z.string().optional().describe("Filter by project"),
          assigneeType: z.enum(["user", "agent"]).optional().describe("Filter by assignee type"),
        }),
        execute: async ({ status, projectId, assigneeType }: { status?: "todo" | "in_progress" | "waiting_on" | "done" | "all"; projectId?: string; assigneeType?: "user" | "agent" }) => {
          let query = adminSupabase
            .from("tasks")
            .select("id, title, description, status, priority, due_date, project_id, created_at, assignee_type, assignee_id, blocked_by")
            .eq("agent_id", agentId)
            .order("created_at", { ascending: false });

          if (status && status !== "all") query = query.eq("status", status);
          if (projectId) query = query.eq("project_id", projectId);
          if (assigneeType) query = query.eq("assignee_type", assigneeType);

          const { data, error } = await query;
          if (error) return { success: false, error: error.message };
          return { success: true, tasks: data, count: data?.length || 0 };
        },
      }),

      getTask: tool({
        description: "Get details of a specific task by ID, including assignee and dependencies",
        inputSchema: z.object({
          taskId: z.string().describe("The ID of the task to retrieve"),
        }),
        execute: async ({ taskId }: { taskId: string }) => {
          const { data, error } = await adminSupabase
            .from("tasks")
            .select("id, title, description, status, priority, due_date, project_id, created_at, completed_at, assignee_type, assignee_id, blocked_by, agent_run_state")
            .eq("id", taskId)
            .eq("agent_id", agentId)
            .single();

          if (error) return { success: false, error: error.message };
          if (!data) return { success: false, error: "Task not found" };
          return { success: true, task: data };
        },
      }),

      updateTask: tool({
        description: "Update an existing task's details, status, or assignment",
        inputSchema: z.object({
          taskId: z.string().describe("The ID of the task to update"),
          title: z.string().optional().describe("New title for the task"),
          description: z.string().optional().describe("New description"),
          status: z.enum(["todo", "in_progress", "waiting_on", "done"]).optional().describe("New status: todo, in_progress, waiting_on, or done"),
          priority: z.enum(["high", "medium", "low"]).optional().describe("New priority level"),
          dueDate: z.string().optional().describe("New due date in ISO format"),
          projectId: z.string().optional().describe("Project ID to link the task to"),
          assigneeType: z.enum(["user", "agent"]).optional().describe("Reassign to 'user' (the human owner) or 'agent' (AI assistant). ID is resolved automatically."),
          blockedBy: z.array(z.string()).optional().describe("Array of task IDs that block this task"),
        }),
        execute: async ({ taskId, title, description, status, priority, dueDate, projectId, assigneeType, blockedBy }: { taskId: string; title?: string; description?: string; status?: "todo" | "in_progress" | "waiting_on" | "done"; priority?: "high" | "medium" | "low"; dueDate?: string; projectId?: string; assigneeType?: "user" | "agent"; blockedBy?: string[] }) => {
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
          if (dueDate !== undefined) updates.due_date = dueDate || null;
          if (projectId !== undefined) updates.project_id = projectId || null;
          if (assigneeType !== undefined) {
            updates.assignee_type = assigneeType;
            // Auto-resolve the assignee ID
            updates.assignee_id = await resolveAssigneeId(assigneeType);
          }
          if (blockedBy !== undefined) updates.blocked_by = blockedBy;

          // If title or description changed, regenerate embedding
          if (title || description !== undefined) {
            const { data: current } = await adminSupabase
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
              } catch (err) {
                console.error("Error generating task embedding:", err);
              }
            }
          }

          const { data, error } = await adminSupabase
            .from("tasks")
            .update(updates)
            .eq("id", taskId)
            .eq("agent_id", agentId)
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, task: { id: data.id, title: data.title, status: data.status, priority: data.priority, assigneeType: data.assignee_type } };
        },
      }),

      completeTask: tool({
        description: "Mark a task as done (completed)",
        inputSchema: z.object({
          taskId: z.string().describe("Task ID to complete"),
        }),
        execute: async ({ taskId }: { taskId: string }) => {
          const { data, error } = await adminSupabase
            .from("tasks")
            .update({ status: "done", completed_at: new Date().toISOString() })
            .eq("id", taskId)
            .eq("agent_id", agentId)
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, task: { id: data.id, title: data.title, status: "done" } };
        },
      }),

      deleteTask: tool({
        description: "Delete a task",
        inputSchema: z.object({
          taskId: z.string().describe("The ID of the task to delete"),
        }),
        execute: async ({ taskId }: { taskId: string }) => {
          // First verify the task belongs to this agent and get its title
          const { data: task, error: fetchError } = await adminSupabase
            .from("tasks")
            .select("id, title")
            .eq("id", taskId)
            .eq("agent_id", agentId)
            .single();

          if (fetchError || !task) {
            return { success: false, error: "Task not found or access denied" };
          }

          // Delete the task
          const { error: deleteError } = await adminSupabase
            .from("tasks")
            .delete()
            .eq("id", taskId)
            .eq("agent_id", agentId);

          if (deleteError) return { success: false, error: deleteError.message };
          return { success: true, message: `Task "${task.title}" has been deleted`, deletedTaskId: taskId };
        },
      }),

      // === COMMENT TOOLS ===

      addComment: tool({
        description: "Add a comment to a task or project. Use this to log progress, ask questions, or record notes.",
        inputSchema: z.object({
          taskId: z.string().optional().describe("The ID of the task to comment on"),
          projectId: z.string().optional().describe("The ID of the project to comment on"),
          content: z.string().describe("The comment content (supports markdown)"),
          commentType: z.enum(["progress", "question", "note", "resolution", "approval_request", "approval_granted", "status_change"]).optional().default("note").describe("The type of comment"),
        }),
        execute: async ({ taskId, projectId, content, commentType }: { taskId?: string; projectId?: string; content: string; commentType?: "progress" | "question" | "note" | "resolution" | "approval_request" | "approval_granted" | "status_change" }) => {
          if (!taskId && !projectId) {
            return { success: false, error: "Either taskId or projectId is required" };
          }

          const { data, error } = await adminSupabase
            .from("task_comments")
            .insert({
              task_id: taskId || null,
              project_id: projectId || null,
              author_type: "agent",
              author_id: agentId,
              content,
              comment_type: commentType || "note",
            })
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, comment: { id: data.id, content: data.content, commentType: data.comment_type, createdAt: data.created_at } };
        },
      }),

      listComments: tool({
        description: "List comments on a task or project to see the activity history",
        inputSchema: z.object({
          taskId: z.string().optional().describe("The ID of the task to get comments for"),
          projectId: z.string().optional().describe("The ID of the project to get comments for"),
          limit: z.number().optional().default(20).describe("Maximum number of comments to return"),
        }),
        execute: async ({ taskId, projectId, limit }: { taskId?: string; projectId?: string; limit?: number }) => {
          if (!taskId && !projectId) {
            return { success: false, error: "Either taskId or projectId is required" };
          }

          let query = adminSupabase
            .from("task_comments")
            .select("id, task_id, project_id, author_type, author_id, content, comment_type, created_at")
            .order("created_at", { ascending: false })
            .limit(limit || 20);

          if (taskId) {
            query = query.eq("task_id", taskId);
          } else if (projectId) {
            query = query.eq("project_id", projectId);
          }

          const { data, error } = await query;
          if (error) return { success: false, error: error.message };
          return { success: true, comments: data, count: data?.length || 0 };
        },
      }),

      // === SCHEDULING TOOLS ===

      createReminder: tool({
        description: "Create a reminder or scheduled notification. Use this when the user wants to be reminded about something at a specific time. Can optionally link to an existing task.",
        inputSchema: z.object({
          title: z.string().describe("What to remind the user about"),
          runAt: z.string().describe("When to send the reminder. MUST be a UTC ISO datetime string ending in Z (e.g., '2026-01-31T20:00:00Z'). Use the ISO timestamp from your current time context and add the appropriate duration."),
          description: z.string().optional().describe("Additional details for the reminder"),
          message: z.string().optional().describe("The notification message to show"),
          taskId: z.string().optional().describe("Link to an existing task ID"),
          projectId: z.string().optional().describe("Link to an existing project ID"),
          createNewConversation: z.boolean().optional().default(false).describe("If true, the reminder will create a new conversation thread instead of posting to the current one. Use this when the user wants the reminder to start a fresh conversation."),
        }),
        execute: async ({ title, runAt, description, message, taskId, projectId, createNewConversation }: { title: string; runAt: string; description?: string; message?: string; taskId?: string; projectId?: string; createNewConversation?: boolean }) => {
          try {
            const userTimezone = profile?.timezone || "America/New_York";
            
            // Ensure runAt is a valid UTC ISO string
            let utcRunAt = runAt;
            if (!runAt.endsWith('Z') && !runAt.includes('+') && !runAt.includes('-', 10)) {
              // If no timezone info, assume it's meant to be UTC and add Z
              utcRunAt = runAt + 'Z';
            }
            
            // Validate the date
            const runAtDate = new Date(utcRunAt);
            if (isNaN(runAtDate.getTime())) {
              return { success: false, error: `Invalid datetime format: ${runAt}. Please use UTC ISO format like '2026-01-31T20:00:00Z'` };
            }
            
            // Build action payload with preferred channel
            const preferredChannel = profile?.preferred_notification_channel || "app";
            const actionPayload: Record<string, unknown> = { 
              message: message || title,
              preferred_channel: preferredChannel,
            };
            
            const { data, error } = await adminSupabase
              .from("scheduled_jobs")
              .insert({
                agent_id: agentId,
                job_type: "reminder",
                title,
                description: description || null,
                schedule_type: "once",
                run_at: runAtDate.toISOString(),
                next_run_at: runAtDate.toISOString(),
                timezone: userTimezone,
                action_type: "notify",
                action_payload: actionPayload,
                task_id: taskId || null,
                project_id: projectId || null,
                conversation_id: createNewConversation ? null : conversation.id,
                status: "active",
              })
              .select()
              .single();

            if (error) return { success: false, error: error.message };

            // Format the time in the user's timezone for display
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: userTimezone,
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            });
            const reminderTimeFormatted = formatter.format(runAtDate);
            
            return {
              success: true,
              reminder: {
                id: data.id,
                title: data.title,
                scheduledFor: reminderTimeFormatted,
                timezone: userTimezone,
                willCreateNewConversation: createNewConversation || false,
              },
              message: `Reminder set for ${reminderTimeFormatted} (${userTimezone}): "${title}"${createNewConversation ? " [will start new conversation]" : ""}`,
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      createRecurringJob: tool({
        description: "Create a recurring scheduled job that runs on a cron schedule. Use this for things like daily briefs, weekly summaries, or regular check-ins.",
        inputSchema: z.object({
          title: z.string().describe("Name of the recurring job"),
          cronExpression: z.string().describe("Cron expression (e.g., '0 8 * * *' for 8am daily, '0 8 * * 1' for 8am Mondays)"),
          description: z.string().optional().describe("What this job does"),
          instruction: z.string().optional().describe("Instructions for the agent when this job runs"),
          actionType: z.enum(["notify", "agent_task"]).optional().default("notify").describe("Type of action: 'notify' for simple message, 'agent_task' for agent execution"),
          createNewConversation: z.boolean().optional().default(true).describe("If true (default for recurring), each run creates a new conversation. If false, posts to the current conversation."),
        }),
        execute: async ({ title, cronExpression, description, instruction, actionType, createNewConversation }: { title: string; cronExpression: string; description?: string; instruction?: string; actionType?: "notify" | "agent_task"; createNewConversation?: boolean }) => {
          try {
            const userTimezone = profile?.timezone || "America/New_York";
            
            // Calculate next run time from cron expression
            const { calculateNextRunFromCron } = await import("@/lib/db/scheduled-jobs");
            const nextRun = calculateNextRunFromCron(cronExpression, userTimezone);

            // For recurring jobs, default to creating new conversations (makes more sense for daily briefs, etc.)
            const shouldCreateNewConversation = createNewConversation !== false;

            // Build action payload with preferred channel
            const preferredChannel = profile?.preferred_notification_channel || "app";
            const recurringActionPayload: Record<string, unknown> = {
              message: title,
              preferred_channel: preferredChannel,
              ...(instruction ? { instruction } : {}),
            };

            const { data, error } = await adminSupabase
              .from("scheduled_jobs")
              .insert({
                agent_id: agentId,
                job_type: "recurring",
                title,
                description: description || null,
                schedule_type: "cron",
                cron_expression: cronExpression,
                next_run_at: nextRun.toISOString(),
                timezone: userTimezone,
                action_type: actionType || "notify",
                action_payload: recurringActionPayload,
                conversation_id: shouldCreateNewConversation ? null : conversation.id,
                status: "active",
              })
              .select()
              .single();

            if (error) return { success: false, error: error.message };

            // Format the time in the user's timezone for display
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: userTimezone,
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
            const nextRunFormatted = formatter.format(nextRun);

            return {
              success: true,
              job: {
                id: data.id,
                title: data.title,
                schedule: cronExpression,
                nextRun: nextRunFormatted,
                timezone: userTimezone,
                willCreateNewConversation: shouldCreateNewConversation,
              },
              message: `Recurring job created: "${title}" - next run: ${nextRunFormatted} (${userTimezone})${shouldCreateNewConversation ? " [will start new conversation each time]" : ""}`,
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      createFollowUp: tool({
        description: "Create a follow-up job that triggers the agent to check on something at a later time. Use this for 'remind me to follow up if X doesn't happen' scenarios.",
        inputSchema: z.object({
          title: z.string().describe("What to follow up on"),
          runAt: z.string().describe("When to check. MUST be a UTC ISO datetime string ending in Z (e.g., '2026-01-31T20:00:00Z'). Use the ISO timestamp from your current time context and add the appropriate duration."),
          instruction: z.string().describe("What the agent should check or do when this triggers"),
          taskId: z.string().optional().describe("Link to an existing task ID"),
          projectId: z.string().optional().describe("Link to an existing project ID"),
          createNewConversation: z.boolean().optional().default(false).describe("If true, the follow-up will create a new conversation thread instead of posting to the current one."),
        }),
        execute: async ({ title, runAt, instruction, taskId, projectId, createNewConversation }: { title: string; runAt: string; instruction: string; taskId?: string; projectId?: string; createNewConversation?: boolean }) => {
          try {
            const userTimezone = profile?.timezone || "America/New_York";
            
            // Ensure runAt is a valid UTC ISO string
            let utcRunAt = runAt;
            if (!runAt.endsWith('Z') && !runAt.includes('+') && !runAt.includes('-', 10)) {
              utcRunAt = runAt + 'Z';
            }
            
            const runAtDate = new Date(utcRunAt);
            if (isNaN(runAtDate.getTime())) {
              return { success: false, error: `Invalid datetime format: ${runAt}. Please use UTC ISO format like '2026-01-31T20:00:00Z'` };
            }
            
            const { data, error } = await adminSupabase
              .from("scheduled_jobs")
              .insert({
                agent_id: agentId,
                job_type: "follow_up",
                title,
                description: instruction,
                schedule_type: "once",
                run_at: runAtDate.toISOString(),
                next_run_at: runAtDate.toISOString(),
                timezone: userTimezone,
                action_type: "agent_task",
                action_payload: { instruction },
                task_id: taskId || null,
                project_id: projectId || null,
                conversation_id: createNewConversation ? null : conversation.id,
                status: "active",
              })
              .select()
              .single();

            if (error) return { success: false, error: error.message };

            // Format the time in the user's timezone for display
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: userTimezone,
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            });
            const followUpTimeFormatted = formatter.format(runAtDate);
            
            return {
              success: true,
              followUp: {
                id: data.id,
                title: data.title,
                scheduledFor: followUpTimeFormatted,
                timezone: userTimezone,
                willCreateNewConversation: createNewConversation || false,
              },
              message: `Follow-up scheduled for ${followUpTimeFormatted} (${userTimezone}): "${title}"${createNewConversation ? " [will start new conversation]" : ""}`,
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      listScheduledJobs: tool({
        description: "List all scheduled jobs including reminders, follow-ups, and recurring jobs",
        inputSchema: z.object({
          status: z.enum(["active", "paused", "completed", "cancelled", "all"]).optional().default("active"),
          jobType: z.enum(["reminder", "follow_up", "recurring", "one_time"]).optional().describe("Filter by job type"),
        }),
        execute: async ({ status, jobType }: { status?: "active" | "paused" | "completed" | "cancelled" | "all"; jobType?: "reminder" | "follow_up" | "recurring" | "one_time" }) => {
          try {
            let query = adminSupabase
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

            const jobs = (data || []).map((job) => ({
              id: job.id,
              title: job.title,
              type: job.job_type,
              scheduleType: job.schedule_type,
              nextRun: job.next_run_at ? new Date(job.next_run_at).toLocaleString() : null,
              cronExpression: job.cron_expression,
              status: job.status,
            }));

            return { success: true, jobs, count: jobs.length };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
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
            // First get the job to verify ownership and get the title
            const { data: job, error: fetchError } = await adminSupabase
              .from("scheduled_jobs")
              .select("id, title")
              .eq("id", jobId)
              .eq("agent_id", agentId)
              .single();

            if (fetchError || !job) {
              return { success: false, error: "Scheduled job not found or access denied" };
            }

            const { error } = await adminSupabase
              .from("scheduled_jobs")
              .update({ status: "cancelled" })
              .eq("id", jobId)
              .eq("agent_id", agentId);

            if (error) return { success: false, error: error.message };

            return { success: true, message: `Cancelled: "${job.title}"`, cancelledJobId: jobId };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
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
        execute: async ({ jobId, title, runAt, cronExpression, status }: { jobId: string; title?: string; runAt?: string; cronExpression?: string; status?: "active" | "paused" }) => {
          try {
            // First get the current job
            const { data: currentJob, error: fetchError } = await adminSupabase
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
              const { calculateNextRunFromCron } = await import("@/lib/db/scheduled-jobs");
              updates.cron_expression = cronExpression;
              const nextRun = calculateNextRunFromCron(cronExpression, currentJob.timezone || "America/New_York");
              updates.next_run_at = nextRun.toISOString();
            }

            const { data, error } = await adminSupabase
              .from("scheduled_jobs")
              .update(updates)
              .eq("id", jobId)
              .eq("agent_id", agentId)
              .select()
              .single();

            if (error) return { success: false, error: error.message };

            return {
              success: true,
              job: {
                id: data.id,
                title: data.title,
                status: data.status,
                nextRun: data.next_run_at ? new Date(data.next_run_at).toLocaleString() : null,
              },
              message: `Updated scheduled job: "${data.title}"`,
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      // Feedback submission tool
      submitFeedback: tool({
        description: "Submit a bug report or feature request. Use when the user wants to report an issue, suggest a feature, or provide feedback about the app.",
        inputSchema: z.object({
          type: z.enum(["feature_request", "bug_report"]).describe("Type of feedback"),
          title: z.string().describe("A clear, concise title summarizing the feedback"),
          problem: z.string().describe("Description of the problem or pain point"),
          proposedSolution: z.string().optional().describe("Suggested solution or how the feature might work"),
          priority: z.enum(["critical", "high", "medium", "low"]).optional().default("medium").describe("Priority level based on impact"),
        }),
        execute: async ({ type, title, problem, proposedSolution, priority }: { type: "feature_request" | "bug_report"; title: string; problem: string; proposedSolution?: string; priority?: "critical" | "high" | "medium" | "low" }) => {
          try {
            const { feedback, error } = await createFeedback(adminSupabase, agentId, {
              type: type as FeedbackType,
              title,
              problem,
              proposedSolution,
              priority: (priority || "medium") as FeedbackPriority,
              source: "manual",
              conversationId: conversation.id,
            });

            if (error) {
              return { success: false, error };
            }

            return {
              success: true,
              feedbackId: feedback?.id,
              type: feedback?.type,
              title: feedback?.title,
              message: `Successfully submitted ${type === "feature_request" ? "feature request" : "bug report"}: "${title}"`,
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      searchFeedback: tool({
        description: "Search for existing feedback items (bug reports and feature requests). Use this to find feedback before updating or deleting, or to check for duplicates.",
        inputSchema: z.object({
          query: z.string().describe("Search query - matches against title, problem, description, and proposed solution"),
          type: z.enum(["feature_request", "bug_report"]).optional().describe("Filter by feedback type"),
          status: z.enum(["new", "under_review", "planned", "in_progress", "done", "wont_fix"]).optional().describe("Filter by status"),
          limit: z.number().optional().describe("Maximum number of results to return (default 20)"),
        }),
        execute: async ({ query, type, status, limit }: { query: string; type?: "feature_request" | "bug_report"; status?: "new" | "under_review" | "planned" | "in_progress" | "done" | "wont_fix"; limit?: number }) => {
          try {
            const { items, error } = await searchFeedback(adminSupabase, agentId, query, {
              type: type as FeedbackType | undefined,
              status: status as import("@/lib/types/database").FeedbackStatus | undefined,
              limit,
            });

            if (error) {
              return { success: false, error, message: "Failed to search feedback items." };
            }

            return {
              success: true,
              count: items.length,
              items: items.map((item) => ({
                id: item.id,
                type: item.type,
                title: item.title,
                problem: item.problem,
                proposedSolution: item.proposedSolution,
                priority: item.priority,
                status: item.status,
                createdAt: item.createdAt,
              })),
              message: items.length > 0
                ? `Found ${items.length} feedback item(s) matching "${query}"`
                : `No feedback items found matching "${query}"`,
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      updateFeedbackItem: tool({
        description: "Update an existing feedback item. Use searchFeedback first to find the item's ID.",
        inputSchema: z.object({
          feedbackId: z.string().describe("The UUID of the feedback item to update"),
          title: z.string().optional().describe("New title for the feedback"),
          problem: z.string().optional().describe("Updated problem description"),
          proposedSolution: z.string().optional().describe("Updated proposed solution"),
          priority: z.enum(["critical", "high", "medium", "low"]).optional().describe("New priority level"),
          status: z.enum(["new", "under_review", "planned", "in_progress", "done", "wont_fix"]).optional().describe("New status"),
        }),
        execute: async ({ feedbackId, title, problem, proposedSolution, priority, status }: { feedbackId: string; title?: string; problem?: string; proposedSolution?: string; priority?: "critical" | "high" | "medium" | "low"; status?: "new" | "under_review" | "planned" | "in_progress" | "done" | "wont_fix" }) => {
          try {
            const { feedback, error } = await updateFeedback(adminSupabase, feedbackId, {
              title,
              problem,
              proposedSolution,
              priority: priority as FeedbackPriority | undefined,
              status: status as import("@/lib/types/database").FeedbackStatus | undefined,
            });

            if (error) {
              return { success: false, error, message: "Failed to update feedback item. Make sure the ID is correct." };
            }

            return {
              success: true,
              feedbackId: feedback?.id,
              title: feedback?.title,
              status: feedback?.status,
              priority: feedback?.priority,
              message: `Successfully updated feedback item: "${feedback?.title}"`,
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      deleteFeedbackItem: tool({
        description: "Delete a feedback item. Use searchFeedback first to find the item's ID. Consider marking as 'wont_fix' instead of deleting to preserve history.",
        inputSchema: z.object({
          feedbackId: z.string().describe("The UUID of the feedback item to delete"),
        }),
        execute: async ({ feedbackId }: { feedbackId: string }) => {
          try {
            const { success, error } = await deleteFeedback(adminSupabase, feedbackId);

            if (error) {
              return { success: false, error, message: "Failed to delete feedback item. Make sure the ID is correct." };
            }

            return {
              success: true,
              message: "Successfully deleted the feedback item.",
            };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      }),

      // Email tools (Zapier MCP integration)
      checkEmail: createCheckEmailTool(agentId),
      sendEmail: createSendEmailTool(agentId),
      replyToEmail: createReplyToEmailTool(agentId),
      archiveEmail: createArchiveEmailTool(agentId),
      createEmailDraft: createEmailDraftTool(agentId),
      // Forward email to user tool - available when handling incoming emails
      // so the agent can escalate to the user when uncertain
      ...(channelSource === "email" && profile?.email
        ? { forwardEmailToUser: createForwardEmailToUserTool(agentId, profile.email) }
        : {}),

      // Research tool (Perplexity Sonar API)
      research: createResearchTool(agentId),
    };

    // Stream the response with tools
    const result = streamText({
      model: gateway("openai/gpt-5.2"),
      system: systemPrompt,
      messages: await convertToModelMessages(messagesWithHistory),
      tools,
      toolChoice: "auto",
      stopWhen: stepCountIs(5), // Allow multiple tool calls in sequence
      onStepFinish: async ({ toolCalls, toolResults }) => {
        if (toolCalls && toolCalls.length > 0) {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            if (!tc) continue;
            console.log(`[chat/route] 🔧 Tool "${tc.toolName}" called`);
            const toolResult = toolResults?.[i];
            if (toolResult) {
              // Check if the tool result indicates an error
              // Access 'output' property which contains the tool's return value
              const output = (toolResult as { output?: unknown }).output as Record<string, unknown> | undefined;
              if (output && output.success === false && output.error) {
                console.log(`[chat/route] ⚠️ Tool "${tc.toolName}" failed:`, output.error);
                // Automatically create a bug report for tool errors
                try {
                  // Access 'input' property for tool arguments
                  const toolInput = (tc as { input?: unknown }).input as Record<string, unknown> | undefined;
                  const { skipped } = await createAutomaticBugReport(adminSupabase, agentId, {
                    toolName: tc.toolName,
                    toolInput: toolInput || {},
                    errorMessage: String(output.error),
                    conversationId: conversation.id,
                  });
                  if (!skipped) {
                    console.log(`[chat/route] 🐛 Auto-created bug report for tool error`);
                  }
                } catch (bugReportErr) {
                  console.error(`[chat/route] Failed to create auto bug report:`, bugReportErr);
                }
              } else {
                console.log(`[chat/route] ✅ Tool "${tc.toolName}" completed`);
              }
            }
          }
        }
      },
      onFinish: async ({ text, steps }) => {
        // Log summary
        const toolCallCount = steps?.reduce((acc, step) => acc + (step.toolCalls?.length || 0), 0) || 0;
        if (toolCallCount > 0) {
          console.log(`[chat/route] 📊 Response complete: ${toolCallCount} tool call(s) made`);
        }
        
        // Persist the assistant's response with channel metadata
        if (text) {
          const assistantMetadata: MessageMetadata | undefined =
            channelSource && channelSource !== "app"
              ? {
                  channel_source: channelSource,
                  slack_channel_id: channelMetadata?.slack_channel_id,
                  slack_thread_ts: channelMetadata?.slack_thread_ts,
                }
              : undefined;
          await addMessage(supabase, conversation.id, "assistant", text, assistantMetadata as Record<string, unknown> | undefined);
        }
      },
    });

    console.log("[chat/route] Streaming response");

    // Return with conversation ID in headers
    const response = result.toUIMessageStreamResponse();

    // Clone response to add headers
    const headers = new Headers(response.headers);
    headers.set("X-Conversation-Id", conversation.id);
    headers.set("X-Needs-Title", needsTitle ? "true" : "false");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("[chat/route] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
