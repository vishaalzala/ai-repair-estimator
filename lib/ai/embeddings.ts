import OpenAI from "openai";

export async function createRetrievalEmbedding(text: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_EMBEDDING_MODEL?.trim();
  if (!apiKey || !model) return null;

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    model,
    input: normalized.slice(0, 24_000),
    dimensions: 1536,
  });

  return response.data[0]?.embedding ?? null;
}
