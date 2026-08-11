"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

async function ensurePartsRequest(jobId: string) {
  const context = await requireOrganizationContext();
  const { supabase, organizationId, userId } = context;

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) redirect("/jobs");

  const { data: existing } = await supabase
    .from("parts_requests")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { ...context, request: existing };

  const { data: created, error } = await supabase
    .from("parts_requests")
    .insert({ organization_id: organizationId, job_id: jobId, provider: "manual", status: "draft", created_by: userId })
    .select("id, status")
    .single();

  if (error || !created) redirect(`/jobs/${jobId}/parts?error=Unable%20to%20start%20the%20parts%20request`);
  return { ...context, request: created };
}

export async function addPartRequestItem(jobId: string, formData: FormData) {
  const { supabase, organizationId, request } = await ensurePartsRequest(jobId);
  const description = String(formData.get("description") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);

  if (!description || !Number.isFinite(quantity) || quantity <= 0) {
    redirect(`/jobs/${jobId}/parts?error=Enter%20a%20part%20description%20and%20valid%20quantity`);
  }

  const { error } = await supabase.from("parts_request_items").insert({
    organization_id: organizationId,
    parts_request_id: request.id,
    description,
    component: String(formData.get("component") ?? "").trim() || null,
    side: String(formData.get("side") ?? "").trim() || null,
    part_number: String(formData.get("part_number") ?? "").trim() || null,
    quantity,
    part_type: String(formData.get("part_type") ?? "tbc"),
    status: "tbc",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) redirect(`/jobs/${jobId}/parts?error=Unable%20to%20add%20that%20part`);
  revalidatePath(`/jobs/${jobId}/parts`);
}

export async function addManualPartQuote(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId, request } = await ensurePartsRequest(jobId);
  const requestItemId = String(formData.get("request_item_id") ?? "");
  const supplierName = String(formData.get("supplier_name") ?? "").trim();
  const unitCost = Number(formData.get("unit_cost") ?? 0);
  const markupPercent = Math.max(0, Number(formData.get("markup_percent") ?? 0) || 0);
  const freight = Math.max(0, Number(formData.get("item_freight") ?? 0) || 0);

  if (!requestItemId || !supplierName || !Number.isFinite(unitCost) || unitCost < 0) {
    redirect(`/jobs/${jobId}/parts?error=Choose%20a%20part,%20supplier%20and%20valid%20quote%20cost`);
  }

  const { data: requestItem } = await supabase
    .from("parts_request_items")
    .select("id, quantity")
    .eq("organization_id", organizationId)
    .eq("parts_request_id", request.id)
    .eq("id", requestItemId)
    .maybeSingle();
  if (!requestItem) redirect(`/jobs/${jobId}/parts?error=Invalid%20part%20selection`);

  let { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("name", supplierName)
    .limit(1)
    .maybeSingle();

  if (!supplier) {
    const result = await supabase.from("suppliers").insert({ organization_id: organizationId, name: supplierName }).select("id").single();
    supplier = result.data;
  }
  if (!supplier) redirect(`/jobs/${jobId}/parts?error=Unable%20to%20save%20the%20supplier`);

  const { data: quote, error: quoteError } = await supabase
    .from("parts_quotes")
    .insert({
      organization_id: organizationId,
      parts_request_id: request.id,
      supplier_id: supplier.id,
      provider: "manual",
      quoted_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (quoteError || !quote) redirect(`/jobs/${jobId}/parts?error=Unable%20to%20save%20the%20parts%20quote`);

  const quantity = Number(requestItem.quantity);
  const sellAmount = Math.round(((unitCost * quantity) * (1 + markupPercent / 100) + freight) * 100) / 100;
  const { error: itemError } = await supabase.from("parts_quote_items").insert({
    organization_id: organizationId,
    parts_quote_id: quote.id,
    request_item_id: requestItem.id,
    supplier_part_number: String(formData.get("supplier_part_number") ?? "").trim() || null,
    part_type: String(formData.get("part_type") ?? "other"),
    unit_cost: unitCost,
    quantity,
    markup_percent: markupPercent,
    item_freight: freight,
    sell_amount: sellAmount,
    availability: String(formData.get("availability") ?? "").trim() || null,
    lead_time: String(formData.get("lead_time") ?? "").trim() || null,
  });
  if (itemError) redirect(`/jobs/${jobId}/parts?error=Unable%20to%20save%20the%20quoted%20part`);

  await Promise.all([
    supabase.from("parts_request_items").update({ status: "quoted" }).eq("id", requestItem.id),
    supabase.from("parts_requests").update({ status: "quotes_received" }).eq("id", request.id),
  ]);
  revalidatePath(`/jobs/${jobId}/parts`);
}

export async function selectPartQuote(jobId: string, formData: FormData) {
  const quoteItemId = String(formData.get("quote_item_id") ?? "");
  const { supabase, organizationId, request } = await ensurePartsRequest(jobId);

  const { data: quoteItem } = await supabase
    .from("parts_quote_items")
    .select("id, request_item_id")
    .eq("organization_id", organizationId)
    .eq("id", quoteItemId)
    .maybeSingle();
  if (!quoteItem) return;

  const { data: siblingQuotes } = await supabase
    .from("parts_quote_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("request_item_id", quoteItem.request_item_id);

  const siblingIds = (siblingQuotes ?? []).map((row) => row.id);
  if (siblingIds.length) await supabase.from("parts_quote_items").update({ is_selected: false }).in("id", siblingIds);
  await supabase.from("parts_quote_items").update({ is_selected: true }).eq("id", quoteItem.id);
  await supabase.from("parts_request_items").update({ status: "selected" }).eq("id", quoteItem.request_item_id);
  await supabase.from("parts_requests").update({ status: "selected" }).eq("id", request.id);

  revalidatePath(`/jobs/${jobId}/parts`);
}
