"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/context";

export async function approveLearningCandidate(formData: FormData) {
  const id = String(formData.get("candidate_id") ?? "");
  if (!id) return;
  const { supabase, userId } = await requirePlatformAdmin();
  const { data: candidate } = await supabase.from("learning_candidates").select("id,title,pattern_summary,status").eq("id", id).maybeSingle();
  if (!candidate || candidate.status === "approved") return;
  const { data: source } = await supabase.from("knowledge_sources").insert({
    organization_id: null,
    user_id: null,
    scope: "global",
    source_type: "learning_candidate",
    title: candidate.title,
    content_text: candidate.pattern_summary,
    status: "active",
    created_by: userId,
  }).select("id").single();
  await Promise.all([
    supabase.from("learning_candidates").update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", id),
    supabase.from("platform_audit_logs").insert({ actor_user_id: userId, action: "learning_candidate_approved", entity_type: "learning_candidate", entity_id: id, metadata: { knowledge_source_id: source?.id ?? null } }),
  ]);
  revalidatePath("/admin/learning"); revalidatePath("/admin/knowledge");
}

export async function rejectLearningCandidate(formData: FormData) {
  const id = String(formData.get("candidate_id") ?? "");
  if (!id) return;
  const { supabase, userId } = await requirePlatformAdmin();
  await Promise.all([
    supabase.from("learning_candidates").update({ status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", id),
    supabase.from("platform_audit_logs").insert({ actor_user_id: userId, action: "learning_candidate_rejected", entity_type: "learning_candidate", entity_id: id }),
  ]);
  revalidatePath("/admin/learning");
}
