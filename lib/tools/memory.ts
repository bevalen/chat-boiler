import { tool } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";

export const searchMemoryTool = tool({
  description:
    "Search your memory for relevant information from past conversations, projects, tasks, and context. Use this when the user asks about something you've discussed before, mentions a project or task, or when you need to recall past context.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "The search query - what you're looking for in memory (e.g., 'conversations about sales automation', 'tasks related to Chris', 'project deadlines')"
      ),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results to return"),
  }),
  execute: async ({ query, limit }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");

    const supabase = getAdminClient();

    try {
      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(query);

      // Call the semantic search function
      const { data, error } = await supabase.rpc("semantic_search_all", {
        query_embedding: queryEmbedding,
        p_agent_id: agentId,
        match_count: limit || 10,
        match_threshold: 0.5, // Lower threshold to find more results
      });

      if (error) {
        console.error("Memory search error:", error);
        return {
          success: false,
          error: error.message,
          results: [],
        };
      }

      if (!data || data.length === 0) {
        return {
          success: true,
          message: "No relevant memories found for this query.",
          results: [],
          query,
        };
      }

      // Format results for the AI
      const formattedResults = data.map(
        (item: {
          source_type: string;
          source_id: string;
          title: string;
          content: string;
          metadata: Record<string, unknown>;
          created_at: string;
          similarity: number;
        }) => ({
          type: item.source_type,
          id: item.source_id,
          title: item.title,
          content:
            item.content.length > 500
              ? item.content.substring(0, 500) + "..."
              : item.content,
          metadata: item.metadata,
          createdAt: item.created_at,
          relevance: Math.round(item.similarity * 100) + "%",
        })
      );

      return {
        success: true,
        query,
        resultCount: formattedResults.length,
        results: formattedResults,
      };
    } catch (err) {
      console.error("Memory search error:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        results: [],
      };
    }
  },
});

export const saveToMemoryTool = tool({
  description:
    "Save an important piece of information to memory for future reference. Use this when the user tells you something important they want you to remember, like preferences, facts about themselves, or key decisions.",
  parameters: z.object({
    title: z.string().describe("A short title for this memory"),
    content: z.string().describe("The content to remember"),
    type: z
      .enum(["user_profile", "preferences", "identity", "tools"])
      .default("user_profile")
      .describe("The type of context block to create"),
  }),
  execute: async ({ title, content, type }, options) => {
    const agentId = (options as { agentId?: string }).agentId;
    if (!agentId) throw new Error("Agent ID is required");

    const supabase = getAdminClient();

    try {
      // Generate embedding for the content
      const textToEmbed = `${title}\n\n${content}`;
      const embedding = await generateEmbedding(textToEmbed);

      const { data, error } = await supabase
        .from("context_blocks")
        .insert({
          agent_id: agentId,
          type,
          title,
          content,
          embedding,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: `Saved "${title}" to memory.`,
        id: data.id,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});
