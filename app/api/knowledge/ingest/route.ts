import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractAndEmbedKnowledgeDocument } from "@/lib/ai/tasks/document-ingestion";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { documentId?: string };
  if (!body.documentId) return NextResponse.json({ message: "Document id is required." }, { status: 400 });

  const { data: document } = await supabase
    .from("knowledge_documents")
    .select("id, organization_id, source_id, file_name, mime_type, storage_path, processing_status")
    .eq("id", body.documentId)
    .maybeSingle();
  if (!document) return NextResponse.json({ message: "Document not found or not accessible." }, { status: 404 });

  const extractionModel = process.env.AI_DOCUMENT_MODEL?.trim();
  const embeddingModel = process.env.AI_EMBEDDING_MODEL?.trim();
  if (!process.env.OPENAI_API_KEY || !extractionModel || !embeddingModel) {
    await supabase.from("knowledge_documents").update({ processing_status: "pending", processing_error: null }).eq("id", document.id);
    return NextResponse.json({ message: "Document stored privately. AI ingestion will run after OpenAI document and embedding models are configured." }, { status: 202 });
  }

  await Promise.all([
    supabase.from("knowledge_documents").update({ processing_status: "processing", processing_error: null }).eq("id", document.id),
    supabase.from("knowledge_sources").update({ status: "processing" }).eq("id", document.source_id),
  ]);

  const { data: run } = await supabase.from("ai_analysis_runs").insert({
    organization_id: document.organization_id,
    task: "document_extraction",
    provider: "openai",
    model: extractionModel,
    status: "running",
    input_metadata: { document_id: document.id, source_id: document.source_id, file_name: document.file_name },
    created_by: auth.user.id,
  }).select("id").maybeSingle();

  const started = Date.now();
  try {
    const { data: blob, error: downloadError } = await supabase.storage.from("knowledge-documents").download(document.storage_path);
    if (downloadError || !blob) throw new Error("Unable to download the private knowledge document");
    if (blob.size > 20 * 1024 * 1024) throw new Error("Document exceeds the 20 MB AI ingestion limit");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const result = await extractAndEmbedKnowledgeDocument({
      bytes,
      fileName: document.file_name,
      mimeType: document.mime_type,
      extractionModel,
      embeddingModel,
    });

    await supabase.from("knowledge_chunks").delete().eq("source_id", document.source_id);
    const rows = result.chunks.map((chunk, index) => ({
      organization_id: document.organization_id,
      source_id: document.source_id,
      document_id: document.id,
      chunk_index: index,
      page_number: chunk.pageNumber,
      section_title: chunk.sectionTitle,
      content: chunk.content,
      embedding: `[${chunk.embedding.join(",")}]`,
      embedding_model: embeddingModel,
    }));

    for (let index = 0; index < rows.length; index += 100) {
      const { error: chunkError } = await supabase.from("knowledge_chunks").insert(rows.slice(index, index + 100));
      if (chunkError) throw new Error(`Unable to store knowledge chunks: ${chunkError.code}`);
    }

    await Promise.all([
      supabase.from("knowledge_sources").update({ status: "active", content_text: result.extracted.summary }).eq("id", document.source_id),
      supabase.from("knowledge_documents").update({ processing_status: "ready", processing_error: null }).eq("id", document.id),
      run ? supabase.from("ai_analysis_runs").update({
        status: "completed",
        structured_output: { title: result.extracted.title, summary: result.extracted.summary, sections: result.extracted.sections.length, chunks: result.chunks.length },
        raw_response: { response_id: result.responseId },
        input_tokens: result.usage.inputTokens,
        cached_input_tokens: result.usage.cachedInputTokens,
        output_tokens: result.usage.outputTokens,
        latency_ms: Date.now() - started,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id) : Promise.resolve(),
    ]);

    return NextResponse.json({ message: `Knowledge ready: ${result.chunks.length} searchable sections created.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge ingestion failed";
    await Promise.all([
      supabase.from("knowledge_sources").update({ status: "failed" }).eq("id", document.source_id),
      supabase.from("knowledge_documents").update({ processing_status: "failed", processing_error: message.slice(0, 500) }).eq("id", document.id),
      run ? supabase.from("ai_analysis_runs").update({ status: "failed", error_code: message.slice(0, 250), latency_ms: Date.now() - started, completed_at: new Date().toISOString() }).eq("id", run.id) : Promise.resolve(),
    ]);
    return NextResponse.json({ message: "The document is stored, but AI ingestion failed. It can be retried after the configuration or document issue is fixed." }, { status: 500 });
  }
}
