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
