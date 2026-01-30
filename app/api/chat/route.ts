import { streamText, convertToModelMessages, UIMessage, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAgentForUser, buildSystemPrompt } from "@/lib/db/agents";
import {
  getOrCreateDefaultConversation,
  addMessage,
} from "@/lib/db/conversations";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";

export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("[chat/route] POST request received");

  try {
    const {
      messages,
      conversationId,
    }: { messages: UIMessage[]; conversationId?: string } = await request.json();
    console.log("[chat/route] Messages received:", messages.length);

    // Get the authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from("users")
      .select("name, timezone")
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

    // Build the system prompt from agent configuration
    const systemPrompt = buildSystemPrompt(agent, {
      name: profile?.name || "User",
      timezone: profile?.timezone || undefined,
    });

    console.log("[chat/route] Using agent:", agent.name);
    console.log("[chat/route] Conversation:", conversation.id);

    // Get the last user message to persist
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    if (lastUserMessage) {
      const content = lastUserMessage.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      if (content) {
        await addMessage(supabase, conversation.id, "user", content);
      }
    }

    // Check if this is a new conversation that needs a title
    const needsTitle =
      conversation.title === "New conversation" && messages.length <= 2;

    // Get admin client for tool operations
    const adminSupabase = getAdminClient();
    const agentId = agent.id;

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
        description: "Create a new task",
        inputSchema: z.object({
          title: z.string().describe("Task title"),
          description: z.string().optional().describe("Task description"),
          priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
          dueDate: z.string().optional().describe("Due date (ISO format)"),
          projectId: z.string().optional().describe("Project ID to link to"),
        }),
        execute: async ({ title, description, priority, dueDate, projectId }: { title: string; description?: string; priority?: "high" | "medium" | "low"; dueDate?: string; projectId?: string }) => {
          const textToEmbed = description ? `${title}\n\n${description}` : title;
          const embedding = await generateEmbedding(textToEmbed);
          const { data, error } = await adminSupabase
            .from("tasks")
            .insert({
              agent_id: agentId,
              title,
              description,
              priority: priority || "medium",
              status: "pending",
              due_date: dueDate || null,
              project_id: projectId || null,
              embedding,
            })
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, task: { id: data.id, title: data.title, status: data.status, priority: data.priority } };
        },
      }),

      listTasks: tool({
        description: "List tasks",
        inputSchema: z.object({
          status: z.enum(["pending", "in_progress", "completed", "all"]).optional().default("all"),
          projectId: z.string().optional().describe("Filter by project"),
        }),
        execute: async ({ status, projectId }: { status?: "pending" | "in_progress" | "completed" | "all"; projectId?: string }) => {
          let query = adminSupabase
            .from("tasks")
            .select("id, title, description, status, priority, due_date, project_id, created_at")
            .eq("agent_id", agentId)
            .order("created_at", { ascending: false });

          if (status && status !== "all") query = query.eq("status", status);
          if (projectId) query = query.eq("project_id", projectId);

          const { data, error } = await query;
          if (error) return { success: false, error: error.message };
          return { success: true, tasks: data, count: data?.length || 0 };
        },
      }),

      getTask: tool({
        description: "Get details of a specific task by ID",
        inputSchema: z.object({
          taskId: z.string().describe("The ID of the task to retrieve"),
        }),
        execute: async ({ taskId }: { taskId: string }) => {
          const { data, error } = await adminSupabase
            .from("tasks")
            .select("id, title, description, status, priority, due_date, project_id, created_at, completed_at")
            .eq("id", taskId)
            .eq("agent_id", agentId)
            .single();

          if (error) return { success: false, error: error.message };
          if (!data) return { success: false, error: "Task not found" };
          return { success: true, task: data };
        },
      }),

      updateTask: tool({
        description: "Update an existing task's details or status",
        inputSchema: z.object({
          taskId: z.string().describe("The ID of the task to update"),
          title: z.string().optional().describe("New title for the task"),
          description: z.string().optional().describe("New description"),
          status: z.enum(["pending", "in_progress", "completed"]).optional().describe("New status"),
          priority: z.enum(["high", "medium", "low"]).optional().describe("New priority level"),
          dueDate: z.string().optional().describe("New due date in ISO format"),
          projectId: z.string().optional().describe("Project ID to link the task to"),
        }),
        execute: async ({ taskId, title, description, status, priority, dueDate, projectId }: { taskId: string; title?: string; description?: string; status?: "pending" | "in_progress" | "completed"; priority?: "high" | "medium" | "low"; dueDate?: string; projectId?: string }) => {
          const updates: Record<string, unknown> = {};
          if (title) updates.title = title;
          if (description !== undefined) updates.description = description;
          if (status) {
            updates.status = status;
            if (status === "completed") {
              updates.completed_at = new Date().toISOString();
            }
          }
          if (priority) updates.priority = priority;
          if (dueDate !== undefined) updates.due_date = dueDate || null;
          if (projectId !== undefined) updates.project_id = projectId || null;

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
          return { success: true, task: { id: data.id, title: data.title, status: data.status, priority: data.priority } };
        },
      }),

      completeTask: tool({
        description: "Mark a task as completed",
        inputSchema: z.object({
          taskId: z.string().describe("Task ID to complete"),
        }),
        execute: async ({ taskId }: { taskId: string }) => {
          const { data, error } = await adminSupabase
            .from("tasks")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", taskId)
            .eq("agent_id", agentId)
            .select()
            .single();

          if (error) return { success: false, error: error.message };
          return { success: true, task: { id: data.id, title: data.title, status: "completed" } };
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
    };

    // Stream the response with tools
    const result = streamText({
      model: openai("gpt-5.2"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      toolChoice: "auto",
      stopWhen: stepCountIs(5), // Allow multiple tool calls in sequence
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (toolCalls && toolCalls.length > 0) {
          toolCalls.forEach((tc, i) => {
            console.log(`[chat/route] 🔧 Tool "${tc.toolName}" called`);
            const toolResult = toolResults?.[i];
            if (toolResult) {
              console.log(`[chat/route] ✅ Tool "${tc.toolName}" completed`);
            }
          });
        }
      },
      onFinish: async ({ text, steps }) => {
        // Log summary
        const toolCallCount = steps?.reduce((acc, step) => acc + (step.toolCalls?.length || 0), 0) || 0;
        if (toolCallCount > 0) {
          console.log(`[chat/route] 📊 Response complete: ${toolCallCount} tool call(s) made`);
        }
        
        // Persist the assistant's response
        if (text) {
          await addMessage(supabase, conversation.id, "assistant", text);
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
