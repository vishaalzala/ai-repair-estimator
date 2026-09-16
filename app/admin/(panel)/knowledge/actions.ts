"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/context";

export async function createGlobalKnowledge(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return;
  const { supabase, userId } = await requirePlatformAdmin();
  const { data: source, error } = await supabase.from("knowledge_sources").insert({ organization_id: null, user_id: null, scope: "global", source_type: "manual", title, content_text: content, status: "active", created_by: userId }).select("id").single();
  if (!error && source) {
    await supabase.from("platform_audit_logs").insert({ actor_user_id: userId, action: "knowledge_publish", entity_type: "knowledge_source", entity_id: source.id, metadata: { title } });
  }
  revalidatePath("/admin/knowledge");
}

export async function retireGlobalKnowledge(formData: FormData) {
  const id = String(formData.get("source_id") ?? "");
  if (!id) return;
  const { supabase, userId } = await requirePlatformAdmin();
  await Promise.all([
    supabase.from("knowledge_sources").update({ status: "retired", updated_at: new Date().toISOString() }).eq("id", id).eq("scope", "global"),
    supabase.from("platform_audit_logs").insert({ actor_user_id: userId, action: "knowledge_retire", entity_type: "knowledge_source", entity_id: id }),
  ]);
  revalidatePath("/admin/knowledge");
}
