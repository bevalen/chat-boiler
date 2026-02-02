/**
 * Research tool using Perplexity Sonar API
 * Provides web search and real-time information capabilities
 */

import { tool, UIToolInvocation } from "ai";
import { z } from "zod";
import OpenAI from "openai";

/**
 * Create the research tool
 */
export function createResearchTool(agentId: string) {
  return tool({
    description:
      "Search the web for current information, news, and real-time data. Use this when you need up-to-date information that's not in your training data, or when the user asks about recent events, current prices, latest news, or anything requiring live web search. Returns summarized information with source citations.",
    inputSchema: z.object({
      query: z.string().describe("The search query - be specific and detailed for best results"),
      focusArea: z
        .string()
        .optional()
        .describe("Optional focus area to narrow the search (e.g., 'technology', 'business', 'science')"),
    }),
    execute: async ({ query, focusArea }: { query: string; focusArea?: string }) => {
      try {
        // Check if Perplexity API key is configured
        if (!process.env.PERPLEXITY_API_KEY) {
          return {
            success: false,
            message: "Research capability is not configured. Please contact the administrator.",
          };
        }

        // Enhance query with focus area if provided
        const enhancedQuery = focusArea ? `${query} (focus: ${focusArea})` : query;

        // Use Perplexity Sonar API via OpenAI-compatible interface
        const perplexity = new OpenAI({
          apiKey: process.env.PERPLEXITY_API_KEY,
          baseURL: "https://api.perplexity.ai",
        });

        console.log(`[research] Searching for: ${enhancedQuery}`);

        const response = await perplexity.chat.completions.create({
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful research assistant. Provide concise, accurate, and well-cited information from reliable sources. Always include source URLs when available.",
            },
            {
              role: "user",
              content: enhancedQuery,
            },
          ],
          max_tokens: 1000,
          temperature: 0.2,
        });

        const result = response.choices[0]?.message?.content;

        if (!result) {
          return {
            success: false,
            message: "No results found. Try rephrasing your query.",
          };
        }

        console.log(`[research] Found results for: ${query}`);

        return {
          success: true,
          query: query,
          focusArea: focusArea || null,
          result: result,
          message: `Research completed for "${query}"`,
        };
      } catch (error) {
        console.error("[research] Error:", error);
        return {
          success: false,
          message: `Research failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  });
}

// Type exports for UI components (AI SDK best practice)
export type ResearchTool = ReturnType<typeof createResearchTool>;
export type ResearchToolInvocation = UIToolInvocation<ResearchTool>;
