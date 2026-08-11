import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const ExtractedDocumentSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sections: z.array(z.object({
    pageNumber: z.number().int().positive().nullable(),
    sectionTitle: z.string().nullable(),
    content: z.string().min(1),
  })).min(1).max(200),
});

export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;

function splitText(text: string, maxChars = 3500) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current);
      current = "";
    }
    if (paragraph.length > maxChars) {
      if (current) { chunks.push(current); current = ""; }
      for (let start = 0; start < paragraph.length; start += maxChars) chunks.push(paragraph.slice(start, start + maxChars));
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function extractAndEmbedKnowledgeDocument(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  extractionModel: string;
  embeddingModel: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.extractionModel) throw new Error("AI_DOCUMENT_MODEL is not configured");
  if (!input.embeddingModel) throw new Error("AI_EMBEDDING_MODEL is not configured");

  const client = new OpenAI({ apiKey });
  const uploaded = await client.files.create({
    file: await toFile(input.bytes, input.fileName, { type: input.mimeType }),
    purpose: "user_data",
  });

  try {
    const response = await client.responses.parse({
      model: input.extractionModel,
      instructions: [
        "Extract workshop estimating knowledge from the provided document faithfully.",
        "Do not invent, correct or generalise beyond the document.",
        "Preserve important automotive terminology, procedures, conditions, exceptions and scope.",
        "Page numbers must reflect the supplied document when available; otherwise use null.",
        "This extraction is knowledge context only. It must not turn a recommendation into a mandatory rule unless the source explicitly states it.",
      ].join("\n"),
      input: [{
        role: "user",
        content: [
          { type: "input_file", file_id: uploaded.id },
          { type: "input_text", text: "Extract this document into concise but complete sections for retrieval by an automotive estimating assistant." },
        ],
      }],
      text: { format: zodTextFormat(ExtractedDocumentSchema, "knowledge_document_extraction") },
    });
    if (!response.output_parsed) throw new Error("OpenAI did not return structured document extraction");
    const extracted = ExtractedDocumentSchema.parse(response.output_parsed);

    const chunks = extracted.sections.flatMap((section) => splitText(section.content).map((content) => ({
      pageNumber: section.pageNumber,
      sectionTitle: section.sectionTitle,
      content,
    })));
    if (!chunks.length) throw new Error("No extractable knowledge chunks were produced");

    const embeddings: number[][] = [];
    const batchSize = 64;
    for (let index = 0; index < chunks.length; index += batchSize) {
      const batch = chunks.slice(index, index + batchSize);
      const result = await client.embeddings.create({
        model: input.embeddingModel,
        input: batch.map((chunk) => chunk.content),
        dimensions: 1536,
      });
      embeddings.push(...result.data.map((row) => row.embedding));
    }

    return {
      extracted,
      chunks: chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] })),
      responseId: response.id,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
      },
    };
  } finally {
    await client.files.delete(uploaded.id).catch(() => undefined);
  }
}
