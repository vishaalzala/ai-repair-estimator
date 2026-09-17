import { NextResponse } from "next/server";
import { getPlatformAdminIfSignedIn } from "@/lib/admin/context";
import { extractTrainingCaseFromQuoteAndPhotos } from "@/lib/ai/tasks/training-case-ingestion";

export const runtime = "nodejs";
export const maxDuration = 300;

function trainingKnowledgeText(input: {
  title: string;
  insurerName: string | null;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleVariant: string | null;
  repairArea: string | null;
  damageSummary: string;
  estimatorLessons: string;
  lines: Array<{ category_code: string; side: string | null; operation_code: string | null; description: string; blend_selected: boolean }>;
}) {
  const vehicle = [input.vehicleYear, input.vehicleMake, input.vehicleModel, input.vehicleVariant].filter(Boolean).join(" ") || "Vehicle not specified";
  const lineText = input.lines.length
    ? input.lines.map((line) => `- ${line.category_code} | ${line.side || "NA"} | ${line.operation_code || ""} | ${line.description}${line.blend_selected ? " | BLEND" : ""}`).join("\n")
    : "No structured example lines supplied.";

  return [
    "TRAINING CASE — APPROVED HUMAN ESTIMATE",
    `CASE: ${input.title}`,
    input.insurerName ? `INSURER / JOB TYPE: ${input.insurerName}` : null,
    `VEHICLE: ${vehicle}`,
    input.repairArea ? `REPAIR AREA: ${input.repairArea}` : null,
    `VISIBLE DAMAGE / CONTEXT: ${input.damageSummary}`,
    `REUSABLE ESTIMATOR LESSONS: ${input.estimatorLessons}`,
    "APPROVED LINE STRUCTURE (historical example only; do not copy prices or hours blindly):",
    lineText,
    "Use this case only when it is relevant to the current vehicle/damage and insurer/job context. Current photos, estimator instructions and workshop settings always override this precedent. Hidden damage remains TBC/check-after-strip unless current evidence supports it.",
  ].filter(Boolean).join("\n\n");
}

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
    const extractedCase = {
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
    };

    const { error: updateError } = await supabase.from("estimator_training_cases").update(extractedCase).eq("id", trainingCase.id);
    if (updateError) throw new Error(`Unable to update the Training Case: ${updateError.code}`);

    const contentText = trainingKnowledgeText({
      title: extractedCase.title,
      insurerName,
      vehicleYear: extractedCase.vehicle_year,
      vehicleMake: extractedCase.vehicle_make,
      vehicleModel: extractedCase.vehicle_model,
      vehicleVariant: extractedCase.vehicle_variant,
      repairArea: extractedCase.repair_area,
      damageSummary: extractedCase.damage_summary,
      estimatorLessons: extractedCase.estimator_lessons,
      lines: lineRows,
    });

    const { data: knowledgeSource, error: knowledgeError } = await supabase.from("knowledge_sources").insert({
      organization_id: null,
      user_id: null,
      scope: "global",
      source_type: "learned_pattern",
      title: `Training Case: ${extractedCase.title}`,
      content_text: contentText,
      status: "active",
      created_by: userId,
    }).select("id").single();

    if (knowledgeError || !knowledgeSource) {
      await supabase.from("estimator_training_cases").update({
        ingestion_status: "ready",
        ingestion_error: "Extraction succeeded but the knowledge entry could not be published.",
        updated_at: new Date().toISOString(),
      }).eq("id", trainingCase.id);
      return NextResponse.json({ message: "The Training Case was extracted, but it could not be published to estimator memory." }, { status: 500 });
    }

    const approvedAt = new Date().toISOString();
    const { error: approveError } = await supabase.from("estimator_training_cases").update({
      status: "approved",
      approved_at: approvedAt,
      approved_by: userId,
      knowledge_source_id: knowledgeSource.id,
      ingestion_status: "ready",
      ingestion_error: null,
      updated_at: approvedAt,
    }).eq("id", trainingCase.id);

    if (approveError) {
      await supabase.from("knowledge_sources").update({ status: "retired", updated_at: new Date().toISOString() }).eq("id", knowledgeSource.id);
      throw new Error(`The case was extracted but could not be approved: ${approveError.code}`);
    }

    await supabase.from("platform_audit_logs").insert({
      actor_user_id: userId,
      action: "training_case_publish",
      entity_type: "estimator_training_case",
      entity_id: trainingCase.id,
      metadata: {
        quote: trainingCase.source_document_name,
        photo_archive: trainingCase.source_photo_archive_name,
        photo_count: result.photoCount,
        line_count: lineRows.length,
        insurer_name: insurerName,
        knowledge_source_id: knowledgeSource.id,
        source: "zip_quote_ingestion",
      },
    });

    return NextResponse.json({
      message: `Learned and added to estimator memory: ${lineRows.length} estimate lines and ${result.photoCount} photos processed.`,
      caseId: trainingCase.id,
      lineCount: lineRows.length,
      photoCount: result.photoCount,
      knowledgeSourceId: knowledgeSource.id,
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
