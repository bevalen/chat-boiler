import { embed, embedMany } from "ai";

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: "openai/text-embedding-3-small",
    value: text,
  });

  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { embeddings } = await embedMany({
    model: "openai/text-embedding-3-small",
    values: texts,
  });

  return embeddings;
}
