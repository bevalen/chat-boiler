import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

// Perplexity API types
interface PerplexitySearchResult {
  title: string;
  url: string;
  date?: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
  search_results?: PerplexitySearchResult[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

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
 * Call the Perplexity Sonar API for web research
 */
async function callPerplexityAPI(
  query: string,
  searchMode: "web" | "academic" = "web"
): Promise<PerplexityResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY environment variable is not set");
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant. Provide accurate, well-sourced answers based on current web information. Be concise but thorough.",
        },
        {
          role: "user",
          content: query,
        },
      ],
      search_mode: searchMode,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<PerplexityResponse>;
}

/**
 * Create the research tool with agentId captured in closure
 */
export function createResearchTool(agentId: string) {
  return tool({
    description:
      "Search the web for real-time information using Perplexity's Sonar AI. Use this when you need to research current events, look up facts, find recent information, or answer questions that require up-to-date web knowledge. Returns an AI-synthesized answer with source citations.",
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

      // Check if API key is configured
      if (!process.env.PERPLEXITY_API_KEY) {
        const result = {
          success: false,
          message:
            "Research tool is not configured. Please add PERPLEXITY_API_KEY to your environment variables.",
          answer: "",
          sources: [] as PerplexitySearchResult[],
          sourceCount: 0,
        };

        await logToolAction(agentId, "research", "search", { query, searchMode: mode }, result);

        return result;
      }

      try {
        const response = await callPerplexityAPI(query, mode);

        const answer = response.choices?.[0]?.message?.content || "";
        const sources = response.search_results || [];

        const result = {
          success: true,
          query,
          searchMode: mode,
          answer,
          sources: sources.map((s) => ({
            title: s.title,
            url: s.url,
            date: s.date,
          })),
          sourceCount: sources.length,
        };

        // Log the action
        await logToolAction(
          agentId,
          "research",
          "search",
          { query, searchMode: mode },
          { success: true, sourceCount: result.sourceCount }
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
          sources: [] as PerplexitySearchResult[],
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
