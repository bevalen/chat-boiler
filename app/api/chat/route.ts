import { streamText, convertToModelMessages, UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";

export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("[chat/route] POST request received");

  try {
    const { messages }: { messages: UIMessage[] } = await request.json();
    console.log("[chat/route] Messages received:", messages.length);

    const result = streamText({
      model: openai("gpt-4o"),
      system: `You are Milo, a helpful AI assistant. Be concise and friendly.`,
      messages: await convertToModelMessages(messages),
    });

    console.log("[chat/route] Streaming response");
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[chat/route] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
