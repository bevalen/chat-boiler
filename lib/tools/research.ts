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
 * Create the research tool with agentId captured in closure
 */
export function createResearchTool(agentId: string) {
  return tool({
    description:
      "Search the web for real-time information using Perplexity's Sonar AI. Use this when you need to research current events, look up facts, find recent information, or answer questions that require up-to-date web knowledge. Returns an AI-synthesized answer based on current web sources.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The research question or topic to search for"),
      searchMode: z
        .enum(["web", "academic"])
        .optional()
        .default("web")
        .describe(
          "Search mode: 'web' for general search, 'academic' for scholarly sources"
        ),
    }),
    execute: async ({
      query,
      searchMode,
    }: {
      query: string;
      searchMode?: "web" | "academic";
    }) => {
      const mode = searchMode ?? "web";

      try {
        // Use Perplexity through AI Gateway
        const { text } = await generateText({
          model: gateway("perplexity/sonar"),
          system:
            "You are a research assistant. Provide accurate, well-sourced answers based on current web information. Be concise but thorough. Always cite your sources.",
          prompt: query,
          temperature: 0.2,
        });

        const result = {
          success: true,
          query,
          searchMode: mode,
          answer: text,
          sourceCount: 0, // Gateway doesn't return structured sources
        };

        // Log the action
        await logToolAction(
          agentId,
          "research",
          "search",
          { query, searchMode: mode },
          { success: true }
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
          sourceCount: 0,
          error: errorMessage,
        };

        // Log the error
        await logToolAction(
          agentId,
          "research",
          "search_error",
          { query, searchMode: mode },
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
