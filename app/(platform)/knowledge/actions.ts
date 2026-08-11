"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

export async function teachAi(formData: FormData) {
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const scope = String(formData.get("scope") ?? "user");

  if (!title || !content) redirect("/knowledge?error=Title%20and%20knowledge%20are%20required");
  if (!new Set(["user", "organization"]).has(scope)) redirect("/knowledge?error=Invalid%20knowledge%20scope");
  if (scope === "organization" && !["owner", "admin", "manager"].includes(role)) {
    redirect("/knowledge?error=Only%20workshop%20management%20can%20publish%20workshop-wide%20knowledge");
  }

  const { data: source, error } = await supabase.from("knowledge_sources").insert({
    organization_id: organizationId,
    user_id: scope === "user" ? userId : null,
    scope,
    source_type: "manual",
    title,
    content_text: content,
    status: "active",
    created_by: userId,
  }).select("id").single();

  if (error || !source) {
    console.error("Teach AI failed", error?.code);
    redirect("/knowledge?error=Unable%20to%20save%20that%20knowledge");
  }

  await supabase.from("learning_events").insert({
    organization_id: organizationId,
    user_id: userId,
    event_type: "teach_ai",
    entity_type: "knowledge_source",
    entity_id: source.id,
    after_data: { scope, title },
    context: { source_type: "manual" },
  });

  revalidatePath("/knowledge");
  redirect("/knowledge?message=Knowledge%20saved%20and%20available%20to%20the%20AI%20review%20layer");
}

export async function retireKnowledge(formData: FormData) {
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  const sourceId = String(formData.get("source_id") ?? "");
  if (!sourceId) return;

  const { data: source } = await supabase
    .from("knowledge_sources")
    .select("id, scope, user_id")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source || source.scope === "global") return;
  if (source.scope === "user" && source.user_id !== userId) return;
  if (source.scope === "organization" && !["owner", "admin", "manager"].includes(role)) return;

  await supabase.from("knowledge_sources").update({ status: "retired" }).eq("id", sourceId).eq("organization_id", organizationId);
  revalidatePath("/knowledge");
}
