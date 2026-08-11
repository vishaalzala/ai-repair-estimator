"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { calculateLineTotal, parseNumber } from "@/lib/estimating/pricing-engine";

export async function startSupplement(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const reason = String(formData.get("reason") ?? "").trim();

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) redirect("/jobs");

  const { data: existing } = await supabase
    .from("supplements")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("status", "draft")
    .order("supplement_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/jobs/${jobId}/supplements`);

  const { data: baseVersion } = await supabase
    .from("estimate_versions")
    .select("id, currency, tax_rate")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!baseVersion) {
    redirect(`/jobs/${jobId}/supplements?error=Save%20a%20formal%20estimate%20version%20before%20starting%20a%20supplement`);
  }

  const { data: previous } = await supabase
    .from("supplements")
    .select("supplement_number")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .order("supplement_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const supplementNumber = Number(previous?.supplement_number ?? 0) + 1;
  const { error } = await supabase.from("supplements").insert({
    organization_id: organizationId,
    job_id: jobId,
    base_estimate_version_id: baseVersion.id,
    supplement_number: supplementNumber,
    status: "draft",
    reason: reason || null,
    currency: baseVersion.currency,
    tax_rate: baseVersion.tax_rate,
    created_by: userId,
  });

  if (error) {
    console.error("Supplement start failed", error.code);
    redirect(`/jobs/${jobId}/supplements?error=Unable%20to%20start%20the%20supplement`);
  }

  await supabase.from("jobs").update({ status: "supplement_required" }).eq("organization_id", organizationId).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}/supplements`);
  redirect(`/jobs/${jobId}/supplements?message=Supplement%20started`);
}

export async function addSupplementItem(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const supplementId = String(formData.get("supplement_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  const { data: supplement } = await supabase
    .from("supplements")
    .select("id, base_estimate_version_id, status")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("id", supplementId)
    .maybeSingle();
  if (!supplement || supplement.status !== "draft") redirect(`/jobs/${jobId}/supplements?error=No%20editable%20supplement%20was%20found`);

  const { data: category } = await supabase
    .from("estimate_categories")
    .select("id, code")
    .eq("organization_id", organizationId)
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();
  if (!category || !description) redirect(`/jobs/${jobId}/supplements?error=Category%20and%20description%20are%20required`);

  const { data: baseVersion } = await supabase
    .from("estimate_versions")
    .select("rate_card_snapshot")
    .eq("organization_id", organizationId)
    .eq("id", supplement.base_estimate_version_id)
    .maybeSingle();

  const snapshot = (baseVersion?.rate_card_snapshot ?? {}) as { rates?: Array<{ category_code?: string; hourly_rate?: number | string | null; fixed_rate?: number | string | null }> };
  const rateRow = snapshot.rates?.find((row) => row.category_code === category.code);
  const enteredRate = String(formData.get("labour_rate") ?? "").trim();
  const enteredFixed = String(formData.get("fixed_amount") ?? "").trim();
  const labourRate = enteredRate ? parseNumber(formData.get("labour_rate")) : Number(rateRow?.hourly_rate ?? 0);
  const fixedAmount = enteredFixed ? parseNumber(formData.get("fixed_amount")) : Number(rateRow?.fixed_rate ?? 0);
  const quantity = Math.max(0.01, parseNumber(formData.get("quantity")) || 1);
  const labourHours = Math.max(0, parseNumber(formData.get("labour_hours")));
  const partCost = Math.max(0, parseNumber(formData.get("part_cost")));
  const markupPercent = Math.max(0, parseNumber(formData.get("markup_percent")));
  const freightAmount = Math.max(0, parseNumber(formData.get("freight_amount")));
  const adjustmentAmount = parseNumber(formData.get("adjustment_amount"));
  const calculated = calculateLineTotal({ quantity, labourHours, labourRate, fixedAmount, partCost, markupPercent, freightAmount, adjustmentAmount });

  const { error } = await supabase.from("supplement_items").insert({
    organization_id: organizationId,
    supplement_id: supplement.id,
    category_id: category.id,
    component: String(formData.get("component") ?? "").trim() || null,
    side: String(formData.get("side") ?? "").trim() || null,
    operation_code: String(formData.get("operation_code") ?? "").trim() || null,
    description,
    quantity,
    labour_hours: labourHours,
    labour_rate: labourRate,
    fixed_amount: fixedAmount,
    part_cost: partCost,
    markup_percent: markupPercent,
    freight_amount: freightAmount,
    adjustment_amount: adjustmentAmount,
    line_total_ex_tax: calculated.total,
    source_type: "supplement",
    created_by: userId,
  });

  if (error) redirect(`/jobs/${jobId}/supplements?error=Unable%20to%20add%20the%20supplement%20item`);
  revalidatePath(`/jobs/${jobId}/supplements`);
}

export async function deleteSupplementItem(jobId: string, formData: FormData) {
  const itemId = String(formData.get("item_id") ?? "");
  const { supabase, organizationId } = await requireOrganizationContext();
  if (itemId) await supabase.from("supplement_items").delete().eq("organization_id", organizationId).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}/supplements`);
}

export async function saveSupplementVersion(jobId: string, formData: FormData) {
  const supplementId = String(formData.get("supplement_id") ?? "");
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: supplement } = await supabase
    .from("supplements")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("id", supplementId)
    .maybeSingle();
  if (!supplement) redirect(`/jobs/${jobId}/supplements?error=Supplement%20not%20found`);

  const { error } = await supabase.rpc("snapshot_supplement", { p_supplement_id: supplement.id });
  if (error) {
    console.error("snapshot_supplement failed", error.code);
    redirect(`/jobs/${jobId}/supplements?error=Unable%20to%20save%20the%20supplement%20version`);
  }
  revalidatePath(`/jobs/${jobId}/supplements`);
  revalidatePath(`/jobs/${jobId}/history`);
  redirect(`/jobs/${jobId}/supplements?message=Supplement%20version%20saved`);
}
