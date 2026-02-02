import { tool, UIToolInvocation, generateText, gateway } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

// Log tool action to the action_log table
async function logToolAction(
  agentId: string,
  toolName: string,
  action: string,
  params: Record<string, unknown>,
  result: Record<string, unknown>
) {
  const supabase = getAdminClient();
  await supabase.from("action_log").insert({
    agent_id: agentId,
    tool_name: toolName,
    action,
    params,
    result,
  });
}

/**
 * Execute a single search query using Perplexity
 */
async function executeSearch(
  query: string,
  mode: "web" | "academic"
): Promise<{ success: boolean; answer: string; error?: string }> {
  try {
    const { text } = await generateText({
      model: gateway("perplexity/sonar"),
      system:
        mode === "academic"
          ? "You are an academic research assistant. Provide accurate, well-sourced answers based on scholarly and peer-reviewed sources. Include citations where possible."
          : "You are a research assistant. Provide accurate, well-sourced answers based on current web information. Be concise but thorough. Cite your sources when available.",
      prompt: query,
      temperature: 0.2,
    });

    return { success: true, answer: text };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, answer: "", error: errorMessage };
  }
}

/**
 * Create the research tool with agentId captured in closure
 */
export function createResearchTool(agentId: string) {
  return tool({
    description:
      "Search the web for real-time information using Perplexity's Sonar AI. Use this when you need to research current events, look up facts, find recent information, or answer questions that require up-to-date web knowledge. Returns an AI-synthesized answer based on current web sources. Can perform deep research with multiple related queries.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The primary research question or topic to search for"),
      searchMode: z
        .enum(["web", "academic"])
        .optional()
        .default("web")
        .describe(
          "Search mode: 'web' for general search, 'academic' for scholarly sources"
        ),
      followUpQueries: z
        .array(z.string())
        .optional()
        .describe(
          "Additional related queries to search for deeper research. Use this for complex topics that need multiple angles. Each query is searched separately and results are combined."
        ),
    }),
    execute: async ({
      query,
      searchMode,
      followUpQueries,
    }: {
      query: string;
      searchMode?: "web" | "academic";
      followUpQueries?: string[];
    }) => {
      const mode = searchMode ?? "web";
      const allQueries = [query, ...(followUpQueries || [])];

      try {
        // Execute all searches (primary + follow-ups)
        const searchResults = await Promise.all(
          allQueries.map((q) => executeSearch(q, mode))
        );

        // Check if primary search succeeded
        const primaryResult = searchResults[0];
        if (!primaryResult.success) {
          const result = {
            success: false,
            message: `Research failed: ${primaryResult.error}`,
            query,
            answer: "",
            searchCount: 1,
            error: primaryResult.error,
          };

          await logToolAction(
            agentId,
            "research",
            "search_error",
            { query, searchMode: mode, followUpQueries },
            { success: false, error: primaryResult.error }
          );

          return result;
        }

        // Combine results
        let combinedAnswer = primaryResult.answer;

        // Add follow-up results if any
        const followUpResults = searchResults.slice(1);
        const successfulFollowUps = followUpResults.filter((r) => r.success);

        if (successfulFollowUps.length > 0) {
          combinedAnswer += "\n\n---\n\n**Additional Research:**\n\n";
          successfulFollowUps.forEach((result, index) => {
            const followUpQuery = followUpQueries?.[index] || "";
            combinedAnswer += `**${followUpQuery}:**\n${result.answer}\n\n`;
          });
        }

        const result = {
          success: true,
          query,
          searchMode: mode,
          answer: combinedAnswer,
          searchCount: allQueries.length,
          successfulSearches: 1 + successfulFollowUps.length,
          followUpQueries: followUpQueries || [],
        };

        // Log the action
        await logToolAction(
          agentId,
          "research",
          "search",
          { query, searchMode: mode, followUpQueries, searchCount: allQueries.length },
          { success: true, searchCount: allQueries.length }
        );

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        const result = {
          success: false,
          message: `Research failed: ${errorMessage}`,
          query,
          answer: "",
          searchCount: 0,
          error: errorMessage,
        };

        // Log the error
        await logToolAction(
          agentId,
          "research",
          "search_error",
          { query, searchMode: mode, followUpQueries },
          { success: false, error: errorMessage }
        );

        return result;
      }
    },
  });
}

// Type helpers for UI components
export type ResearchTool = ReturnType<typeof createResearchTool>;
export type ResearchToolInvocation = UIToolInvocation<ResearchTool>;
