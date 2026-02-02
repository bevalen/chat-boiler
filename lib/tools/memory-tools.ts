/**
 * Memory and conversation tools
 * Handles semantic search, memory storage, and conversation history
 */

import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { generateEmbedding } from "@/lib/embeddings";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface MemoryToolContext {
  agentId: string;
  supabase: SupabaseClient<any>;
}

export function createMemoryTools(context: MemoryToolContext) {
  const { agentId, supabase } = context;

  return {
    searchMemory: tool({
      description:
        "Search your memory for relevant information from past conversations, projects, tasks, and saved context. Use this when the user asks about something you discussed before or when you need to recall past information.",
      inputSchema: z.object({
        query: z.string().describe("What to search for in memory"),
        limit: z.number().optional().default(10).describe("Max results"),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        try {
          const queryEmbedding = await generateEmbedding(query);
          const { data, error } = await supabase.rpc("semantic_search_all", {
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

          const results = data.map(
            (item: {
              source_type: string;
              title: string;
              content: string;
              similarity: number;
              created_at: string;
            }) => ({
              type: item.source_type,
              title: item.title,
              content:
                item.content.length > 300
                  ? item.content.substring(0, 300) + "..."
                  : item.content,
              relevance: Math.round(item.similarity * 100) + "%",
              date: new Date(item.created_at).toLocaleDateString(),
            })
          );

          return { success: true, query, resultCount: results.length, results };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
            results: [],
          };
        }
      },
    }),

    saveToMemory: tool({
      description:
        "Save important information to memory for future reference. Set alwaysInclude=true for critical information that should be in every conversation.",
      inputSchema: z.object({
        title: z.string().describe("Short title for this memory"),
        content: z.string().describe("Content to remember"),
        alwaysInclude: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "If true, this memory will ALWAYS be included in every conversation's system prompt"
          ),
        category: z
          .enum([
            "work_preferences",
            "personal_background",
            "communication_style",
            "technical_preferences",
            "general",
          ])
          .optional()
          .default("general")
          .describe("Category for organizing this memory"),
      }),
      execute: async ({
        title,
        content,
        alwaysInclude,
        category,
      }: {
        title: string;
        content: string;
        alwaysInclude?: boolean;
        category?: string;
      }) => {
        try {
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
          const alwaysIncludeMsg = alwaysInclude
            ? " This will always be included in your context."
            : "";
          return {
            success: true,
            message: `Saved "${title}" to memory.${alwaysIncludeMsg}`,
            id: data.id,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      },
    }),

    getRecentConversations: tool({
      description:
        "Get recent conversations and their messages. Use this to recall what was discussed recently, summarize past conversations, or find specific discussions. This is a direct database query, not semantic search.",
      inputSchema: z.object({
        daysBack: z.number().optional().default(7).describe("How many days back to look (default 7)"),
        limit: z.number().optional().default(5).describe("Max number of conversations to return (default 5)"),
        includeMessages: z.boolean().optional().default(true).describe("Whether to include message content"),
        messagesPerConversation: z
          .number()
          .optional()
          .default(10)
          .describe("Max messages per conversation (default 10)"),
      }),
      execute: async ({
        daysBack,
        limit,
        includeMessages,
        messagesPerConversation,
      }: {
        daysBack?: number;
        limit?: number;
        includeMessages?: boolean;
        messagesPerConversation?: number;
      }) => {
        try {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - (daysBack || 7));

          // Get recent conversations
          const { data: conversations, error: convError } = await supabase
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
              conversations: [],
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
              const { data: messages } = await supabase
                .from("messages")
                .select("role, content, created_at")
                .eq("conversation_id", conv.id)
                .order("created_at", { ascending: true })
                .limit(messagesPerConversation || 10);

              if (messages && messages.length > 0) {
                convResult.messages = messages.map((m) => ({
                  role: m.role,
                  content:
                    m.content.length > 500
                      ? m.content.substring(0, 500) + "..."
                      : m.content,
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
          return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
            conversations: [],
          };
        }
      },
    }),
  };
}

// Type exports for UI components (AI SDK best practice)
export type MemoryTools = ReturnType<typeof createMemoryTools>;
export type SearchMemoryToolInvocation = UIToolInvocation<MemoryTools["searchMemory"]>;
export type SaveToMemoryToolInvocation = UIToolInvocation<MemoryTools["saveToMemory"]>;
export type GetRecentConversationsToolInvocation = UIToolInvocation<MemoryTools["getRecentConversations"]>;
