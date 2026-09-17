import { NextResponse } from "next/server";
import { getPlatformAdminIfSignedIn } from "@/lib/admin/context";
import { extractTrainingCaseFromQuoteAndPhotos } from "@/lib/ai/tasks/training-case-ingestion";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const adminContext = await getPlatformAdminIfSignedIn();
  if (!adminContext) return NextResponse.json({ message: "Platform administrator access is required." }, { status: 403 });
  const { supabase, userId } = adminContext;

  const body = await request.json().catch(() => ({})) as { caseId?: string };
  if (!body.caseId) return NextResponse.json({ message: "Training Case id is required." }, { status: 400 });

  const { data: trainingCase } = await supabase
    .from("estimator_training_cases")
    .select("id,title,status,insurer_name,source_document_name,source_document_storage_path,source_document_mime_type,source_photo_archive_name,source_photo_archive_storage_path")
    .eq("id", body.caseId)
    .maybeSingle();

  if (!trainingCase) return NextResponse.json({ message: "Training Case not found." }, { status: 404 });
  if (trainingCase.status !== "draft") return NextResponse.json({ message: "Only draft Training Cases can be processed." }, { status: 409 });
  if (!trainingCase.source_document_storage_path || !trainingCase.source_photo_archive_storage_path) {
    return NextResponse.json({ message: "Upload both the quote and photo ZIP before processing." }, { status: 400 });
  }

  const model = process.env.AI_DOCUMENT_MODEL?.trim() || process.env.AI_ESTIMATE_MODEL?.trim() || process.env.AI_DAMAGE_MODEL?.trim();
  if (!process.env.OPENAI_API_KEY || !model) {
    return NextResponse.json({ message: "Training extraction is not configured. Set the AI document/estimate model and API key." }, { status: 503 });
  }

  await supabase.from("estimator_training_cases").update({
    ingestion_status: "processing",
    ingestion_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", trainingCase.id);

  try {
    const [{ data: quoteBlob, error: quoteError }, { data: zipBlob, error: zipError }] = await Promise.all([
      supabase.storage.from("knowledge-documents").download(trainingCase.source_document_storage_path),
      supabase.storage.from("knowledge-documents").download(trainingCase.source_photo_archive_storage_path),
    ]);
    if (quoteError || !quoteBlob) throw new Error("Unable to download the quote document.");
    if (zipError || !zipBlob) throw new Error("Unable to download the photo ZIP.");

    const result = await extractTrainingCaseFromQuoteAndPhotos({
      quoteBytes: new Uint8Array(await quoteBlob.arrayBuffer()),
      quoteFileName: trainingCase.source_document_name || "approved-estimate.pdf",
      quoteMimeType: trainingCase.source_document_mime_type || quoteBlob.type || "application/pdf",
      zipBytes: new Uint8Array(await zipBlob.arrayBuffer()),
      model,
      selectedInsurer: trainingCase.insurer_name,
    });

    const extracted = result.extracted;
    const lineRows = extracted.lines.map((line, index) => ({
      training_case_id: trainingCase.id,
      sort_order: index + 1,
      category_code: line.categoryCode.trim().toLowerCase(),
      side: line.side?.trim() || null,
      operation_code: line.operationCode?.trim() || null,
      description: line.description.trim(),
      labour_hours: line.labourHours,
      approved_amount: line.approvedAmount,
      blend_selected: line.blendSelected,
      report_selected: line.reportSelected,
      pricing_status: "approved_example",
      notes: line.notes?.trim() || null,
    }));

    await supabase.from("estimator_training_lines").delete().eq("training_case_id", trainingCase.id);
    if (lineRows.length) {
      const { error: lineError } = await supabase.from("estimator_training_lines").insert(lineRows);
      if (lineError) throw new Error(`Unable to store extracted estimate lines: ${lineError.code}`);
    }

    const selectedInsurer = trainingCase.insurer_name?.trim();
    const insurerName = selectedInsurer || extracted.insurerName?.trim() || null;
    const { error: updateError } = await supabase.from("estimator_training_cases").update({
      title: extracted.title.trim(),
      insurer_name: insurerName,
      vehicle_make: extracted.vehicleMake?.trim() || null,
      vehicle_model: extracted.vehicleModel?.trim() || null,
      vehicle_variant: extracted.vehicleVariant?.trim() || null,
      vehicle_year: extracted.vehicleYear,
      body_type: extracted.bodyType?.trim() || null,
      fuel_type: extracted.fuelType?.trim() || null,
      colour: extracted.colour?.trim() || null,
      repair_area: extracted.repairArea?.trim() || null,
      damage_summary: extracted.damageSummary.trim(),
      damage_tags: [...new Set(extracted.damageTags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 30),
      estimator_lessons: extracted.estimatorLessons.trim(),
      photo_count: result.photoCount,
      photo_manifest: result.photoManifest,
      ingestion_status: "ready",
      ingestion_error: null,
      ingestion_metadata: {
        response_id: result.responseId,
        extracted_source_reference: extracted.sourceReference,
        line_count: lineRows.length,
        vision_photo_count: result.photoManifest.filter((photo) => photo.sent_to_model).length,
        input_tokens: result.usage.inputTokens,
        cached_input_tokens: result.usage.cachedInputTokens,
        output_tokens: result.usage.outputTokens,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", trainingCase.id);
    if (updateError) throw new Error(`Unable to update the Training Case: ${updateError.code}`);

    await supabase.from("platform_audit_logs").insert({
      actor_user_id: userId,
      action: "training_case_extract",
      entity_type: "estimator_training_case",
      entity_id: trainingCase.id,
      metadata: {
        quote: trainingCase.source_document_name,
        photo_archive: trainingCase.source_photo_archive_name,
        photo_count: result.photoCount,
        line_count: lineRows.length,
        insurer_name: insurerName,
      },
    });

    return NextResponse.json({
      message: `Training Case ready for review: ${lineRows.length} estimate lines and ${result.photoCount} photos processed.`,
      caseId: trainingCase.id,
      lineCount: lineRows.length,
      photoCount: result.photoCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Training Case extraction failed.";
    await supabase.from("estimator_training_cases").update({
      ingestion_status: "failed",
      ingestion_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", trainingCase.id);
    return NextResponse.json({ message }, { status: 500 });
  }
}
