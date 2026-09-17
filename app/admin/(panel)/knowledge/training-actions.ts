"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/context";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function trainingKnowledgeText(input: {
  title: string;
  insurerName: string;
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
    input.insurerName ? `INSURER / JOB TYPE: ${input.insurerName}` : null,
    `VEHICLE: ${vehicle}`,
    input.repairArea ? `REPAIR AREA: ${input.repairArea}` : null,
    `VISIBLE DAMAGE / CONTEXT: ${input.damageSummary}`,
    input.estimatorLessons ? `REUSABLE ESTIMATOR LESSONS: ${input.estimatorLessons}` : null,
    "APPROVED LINE STRUCTURE (historical example only; do not copy prices or hours blindly):",
    lineText,
    "Use this case only when it is relevant to the current vehicle/damage and insurer/job context. Current photos, estimator instructions and workshop settings always override this precedent. Hidden damage remains TBC/check-after-strip unless current evidence supports it.",
  ].filter(Boolean).join("\n\n");
}

export async function approveExtractedTrainingCase(formData: FormData) {
  const id = value(formData, "training_case_id");
  if (!id) return;

  const { supabase, userId } = await requirePlatformAdmin();
  const { data: trainingCase } = await supabase
    .from("estimator_training_cases")
    .select("id,title,status,ingestion_status,knowledge_source_id,insurer_name,vehicle_year,vehicle_make,vehicle_model,vehicle_variant,repair_area,damage_summary,estimator_lessons,source_reference,photo_count")
    .eq("id", id)
    .maybeSingle();
  if (!trainingCase || trainingCase.status !== "draft" || trainingCase.ingestion_status !== "ready") return;

  const { data: lines } = await supabase
    .from("estimator_training_lines")
    .select("category_code,side,operation_code,description,blend_selected")
    .eq("training_case_id", id)
    .order("sort_order");

  const contentText = trainingKnowledgeText({
    title: trainingCase.title,
    insurerName: trainingCase.insurer_name ?? "",
    vehicleYear: trainingCase.vehicle_year,
    vehicleMake: trainingCase.vehicle_make ?? "",
    vehicleModel: trainingCase.vehicle_model ?? "",
    vehicleVariant: trainingCase.vehicle_variant ?? "",
    repairArea: trainingCase.repair_area ?? "",
    damageSummary: trainingCase.damage_summary,
    estimatorLessons: trainingCase.estimator_lessons ?? "",
    lines: lines ?? [],
  });

  let knowledgeSourceId = trainingCase.knowledge_source_id as string | null;
  if (knowledgeSourceId) {
    const { error } = await supabase.from("knowledge_sources").update({
      title: `Training Case: ${trainingCase.title}`,
      content_text: contentText,
      status: "active",
      updated_at: new Date().toISOString(),
    }).eq("id", knowledgeSourceId);
    if (error) return;
  } else {
    const { data: source, error } = await supabase.from("knowledge_sources").insert({
      organization_id: null,
      user_id: null,
      scope: "global",
      source_type: "learned_pattern",
      title: `Training Case: ${trainingCase.title}`,
      content_text: contentText,
      status: "active",
      created_by: userId,
    }).select("id").single();
    if (error || !source) return;
    knowledgeSourceId = source.id;
  }

  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("estimator_training_cases").update({
      status: "approved",
      approved_at: now,
      approved_by: userId,
      knowledge_source_id: knowledgeSourceId,
      updated_at: now,
    }).eq("id", id),
    supabase.from("platform_audit_logs").insert({
      actor_user_id: userId,
      action: "training_case_publish",
      entity_type: "estimator_training_case",
      entity_id: id,
      metadata: {
        title: trainingCase.title,
        source_reference: trainingCase.source_reference,
        line_count: lines?.length ?? 0,
        photo_count: trainingCase.photo_count,
        insurer_name: trainingCase.insurer_name,
        knowledge_source_id: knowledgeSourceId,
        source: "zip_quote_ingestion",
      },
    }),
  ]);

  revalidatePath("/admin/knowledge");
}
