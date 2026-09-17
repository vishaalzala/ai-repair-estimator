"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/context";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableNumber(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTags(raw: string) {
  return [...new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 30);
}

function parseTrainingLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const [categoryCode, side, operationCode, ...descriptionParts] = line.split("|").map((part) => part.trim());
      const description = descriptionParts.join(" | ").trim();
      if (!categoryCode || !description) return [];
      const blendSelected = operationCode?.toUpperCase() === "BLEND";
      return [{
        sort_order: index + 1,
        category_code: categoryCode.toLowerCase(),
        side: side || null,
        operation_code: operationCode || null,
        description,
        blend_selected: blendSelected,
        report_selected: false,
        pricing_status: "approved_example",
      }];
    })
    .slice(0, 200);
}

function trainingKnowledgeText(input: {
  title: string;
  vehicleYear: number | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleVariant: string;
  repairArea: string;
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
    `VEHICLE: ${vehicle}`,
    input.repairArea ? `REPAIR AREA: ${input.repairArea}` : null,
    `VISIBLE DAMAGE / CONTEXT: ${input.damageSummary}`,
    input.estimatorLessons ? `REUSABLE ESTIMATOR LESSONS: ${input.estimatorLessons}` : null,
    "APPROVED LINE STRUCTURE (historical example only; do not copy prices or hours blindly):",
    lineText,
    "Use this case only when it is relevant to the current vehicle/damage. Current photos, estimator instructions and workshop settings always override this precedent. Hidden damage remains TBC/check-after-strip unless current evidence supports it.",
  ].filter(Boolean).join("\n\n");
}

export async function createTrainingCase(formData: FormData) {
  const title = value(formData, "training_title");
  const damageSummary = value(formData, "damage_summary");
  if (!title || !damageSummary) return;

  const vehicleYear = nullableNumber(formData, "vehicle_year");
  const vehicleMake = value(formData, "vehicle_make");
  const vehicleModel = value(formData, "vehicle_model");
  const vehicleVariant = value(formData, "vehicle_variant");
  const repairArea = value(formData, "repair_area");
  const estimatorLessons = value(formData, "estimator_lessons");
  const sourceReference = value(formData, "source_reference");
  const sourceDocumentName = value(formData, "source_document_name");
  const sourcePhotoArchiveName = value(formData, "source_photo_archive_name");
  const photoCount = Math.max(0, Math.round(nullableNumber(formData, "photo_count") ?? 0));
  const damageTags = parseTags(value(formData, "damage_tags"));
  const lines = parseTrainingLines(value(formData, "training_lines"));

  const { supabase, userId } = await requirePlatformAdmin();
  const { data: trainingCase, error: caseError } = await supabase.from("estimator_training_cases").insert({
    scope: "global",
    organization_id: null,
    title,
    source_type: "approved_estimate",
    source_reference: sourceReference || null,
    source_document_name: sourceDocumentName || null,
    source_photo_archive_name: sourcePhotoArchiveName || null,
    status: "approved",
    vehicle_make: vehicleMake || null,
    vehicle_model: vehicleModel || null,
    vehicle_variant: vehicleVariant || null,
    vehicle_year: vehicleYear,
    repair_area: repairArea || null,
    damage_summary: damageSummary,
    damage_tags: damageTags,
    estimator_lessons: estimatorLessons || null,
    photo_count: photoCount,
    approved_at: new Date().toISOString(),
    approved_by: userId,
    created_by: userId,
  }).select("id").single();

  if (caseError || !trainingCase) {
    console.error("Training case insert failed", caseError?.code);
    return;
  }

  if (lines.length) {
    const { error: lineError } = await supabase.from("estimator_training_lines").insert(
      lines.map((line) => ({ ...line, training_case_id: trainingCase.id })),
    );
    if (lineError) {
      console.error("Training line insert failed", lineError.code);
      await supabase.from("estimator_training_cases").delete().eq("id", trainingCase.id);
      return;
    }
  }

  const contentText = trainingKnowledgeText({
    title,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleVariant,
    repairArea,
    damageSummary,
    estimatorLessons,
    lines,
  });

  const { data: knowledgeSource, error: knowledgeError } = await supabase.from("knowledge_sources").insert({
    organization_id: null,
    user_id: null,
    scope: "global",
    source_type: "learned_pattern",
    title: `Training Case: ${title}`,
    content_text: contentText,
    status: "active",
    created_by: userId,
  }).select("id").single();

  if (knowledgeError || !knowledgeSource) {
    console.error("Training case knowledge publish failed", knowledgeError?.code);
    await supabase.from("estimator_training_cases").update({ status: "draft" }).eq("id", trainingCase.id);
    revalidatePath("/admin/knowledge");
    return;
  }

  await Promise.all([
    supabase.from("estimator_training_cases").update({ knowledge_source_id: knowledgeSource.id, updated_at: new Date().toISOString() }).eq("id", trainingCase.id),
    supabase.from("platform_audit_logs").insert({
      actor_user_id: userId,
      action: "training_case_publish",
      entity_type: "estimator_training_case",
      entity_id: trainingCase.id,
      metadata: { title, source_reference: sourceReference || null, line_count: lines.length, photo_count: photoCount, knowledge_source_id: knowledgeSource.id },
    }),
  ]);

  revalidatePath("/admin/knowledge");
}

export async function retireTrainingCase(formData: FormData) {
  const id = value(formData, "training_case_id");
  if (!id) return;

  const { supabase, userId } = await requirePlatformAdmin();
  const { data: trainingCase } = await supabase
    .from("estimator_training_cases")
    .select("id,title,knowledge_source_id")
    .eq("id", id)
    .maybeSingle();
  if (!trainingCase) return;

  const operations = [
    supabase.from("estimator_training_cases").update({ status: "retired", updated_at: new Date().toISOString() }).eq("id", id),
    supabase.from("platform_audit_logs").insert({
      actor_user_id: userId,
      action: "training_case_retire",
      entity_type: "estimator_training_case",
      entity_id: id,
      metadata: { title: trainingCase.title },
    }),
  ];

  if (trainingCase.knowledge_source_id) {
    operations.push(supabase.from("knowledge_sources").update({ status: "retired", updated_at: new Date().toISOString() }).eq("id", trainingCase.knowledge_source_id));
  }

  await Promise.all(operations);
  revalidatePath("/admin/knowledge");
}

export async function createGlobalKnowledge(formData: FormData) {
  const title = value(formData, "title");
  const directContent = value(formData, "content");
  const ruleType = value(formData, "rule_type") || "estimating_rule";
  const scenario = value(formData, "scenario");
  const expected = value(formData, "expected");
  const tbc = value(formData, "tbc");
  const notes = value(formData, "notes");

  const structuredContent = [
    `RULE TYPE\n${ruleType}`,
    scenario ? `WHEN THIS APPLIES\n${scenario}` : null,
    expected ? `WHAT THE AI ESTIMATOR SHOULD ADD / CHECK\n${expected}` : null,
    tbc ? `WHAT MUST STAY TBC / CHECK-AFTER-STRIP\n${tbc}` : null,
    notes ? `ADDITIONAL GUIDANCE\n${notes}` : null,
  ].filter(Boolean).join("\n\n");

  const content = directContent || structuredContent;
  if (!title || !content) return;

  const { supabase, userId } = await requirePlatformAdmin();
  const { data: source, error } = await supabase.from("knowledge_sources").insert({
    organization_id: null,
    user_id: null,
    scope: "global",
    source_type: "manual",
    title,
    content_text: content,
    status: "active",
    created_by: userId,
  }).select("id").single();

  if (!error && source) {
    await supabase.from("platform_audit_logs").insert({
      actor_user_id: userId,
      action: "knowledge_publish",
      entity_type: "knowledge_source",
      entity_id: source.id,
      metadata: { title, rule_type: ruleType },
    });
  }

  revalidatePath("/admin/knowledge");
}

export async function retireGlobalKnowledge(formData: FormData) {
  const id = value(formData, "source_id");
  if (!id) return;

  const { supabase, userId } = await requirePlatformAdmin();
  await Promise.all([
    supabase.from("knowledge_sources").update({ status: "retired", updated_at: new Date().toISOString() }).eq("id", id).eq("scope", "global"),
    supabase.from("platform_audit_logs").insert({ actor_user_id: userId, action: "knowledge_retire", entity_type: "knowledge_source", entity_id: id }),
  ]);
  revalidatePath("/admin/knowledge");
}
