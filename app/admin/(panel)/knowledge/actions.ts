"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/context";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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
