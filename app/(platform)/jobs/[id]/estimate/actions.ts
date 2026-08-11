"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { calculateLineTotal, parseNumber } from "@/lib/estimating/pricing-engine";

async function ensureEstimate(jobId: string) {
  const context = await requireOrganizationContext();
  const { supabase, organizationId, userId } = context;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();

  if (!job) redirect("/jobs");

  const { data: existing } = await supabase
    .from("estimates")
    .select("id, rate_card_id, tax_rate")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("estimate_type", "primary")
    .maybeSingle();

  if (existing) return { ...context, job, estimate: existing };

  const [{ data: rateCard }, { data: settings }] = await Promise.all([
    supabase.from("rate_cards").select("id").eq("organization_id", organizationId).eq("is_default", true).eq("is_active", true).maybeSingle(),
    supabase.from("workshop_settings").select("gst_rate, default_currency").eq("organization_id", organizationId).maybeSingle(),
  ]);

  const { data: created, error } = await supabase
    .from("estimates")
    .insert({
      organization_id: organizationId,
      job_id: jobId,
      rate_card_id: rateCard?.id ?? null,
      estimate_type: "primary",
      status: "draft",
      currency: settings?.default_currency ?? "NZD",
      tax_rate: settings?.gst_rate ?? 15,
      created_by: userId,
    })
    .select("id, rate_card_id, tax_rate")
    .single();

  if (error || !created) {
    const { data: raced } = await supabase
      .from("estimates")
      .select("id, rate_card_id, tax_rate")
      .eq("organization_id", organizationId)
      .eq("job_id", jobId)
      .eq("estimate_type", "primary")
      .maybeSingle();

    if (!raced) redirect(`/jobs/${jobId}/estimate?error=Unable%20to%20start%20the%20estimate`);
    return { ...context, job, estimate: raced };
  }

  return { ...context, job, estimate: created };
}

export async function addEstimateItem(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId, job, estimate } = await ensureEstimate(jobId);
  const categoryId = String(formData.get("category_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  if (!categoryId || !description) {
    redirect(`/jobs/${jobId}/estimate?error=Category%20and%20description%20are%20required`);
  }

  const { data: category } = await supabase
    .from("estimate_categories")
    .select("id, pricing_basis")
    .eq("organization_id", organizationId)
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) redirect(`/jobs/${jobId}/estimate?error=Invalid%20estimate%20category`);

  const { data: defaultRate } = estimate.rate_card_id
    ? await supabase
        .from("rate_card_rates")
        .select("hourly_rate, fixed_rate")
        .eq("rate_card_id", estimate.rate_card_id)
        .eq("category_id", category.id)
        .maybeSingle()
    : { data: null };

  const enteredRate = String(formData.get("labour_rate") ?? "").trim();
  const enteredFixed = String(formData.get("fixed_amount") ?? "").trim();
  const labourRate = enteredRate ? parseNumber(formData.get("labour_rate")) : Number(defaultRate?.hourly_rate ?? 0);
  const fixedAmount = enteredFixed ? parseNumber(formData.get("fixed_amount")) : Number(defaultRate?.fixed_rate ?? 0);
  const quantity = Math.max(0.01, parseNumber(formData.get("quantity")) || 1);
  const labourHours = Math.max(0, parseNumber(formData.get("labour_hours")));
  const partCost = Math.max(0, parseNumber(formData.get("part_cost")));
  const markupPercent = Math.max(0, parseNumber(formData.get("markup_percent")));
  const freightAmount = Math.max(0, parseNumber(formData.get("freight_amount")));
  const adjustmentAmount = parseNumber(formData.get("adjustment_amount"));

  const calculated = calculateLineTotal({
    quantity,
    labourHours,
    labourRate,
    fixedAmount,
    partCost,
    markupPercent,
    freightAmount,
    adjustmentAmount,
  });

  const { error } = await supabase.from("estimate_items").insert({
    organization_id: organizationId,
    estimate_id: estimate.id,
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
    source_type: "manual",
    human_verified: true,
    created_by: userId,
  });

  if (error) {
    console.error("Estimate item insert failed", error.code);
    redirect(`/jobs/${jobId}/estimate?error=Unable%20to%20add%20the%20estimate%20item`);
  }

  if (["draft", "intake_complete", "photos_required", "damage_review"].includes(job.status)) {
    await supabase.from("jobs").update({ status: "estimating" }).eq("id", job.id).eq("organization_id", organizationId);
  }

  revalidatePath(`/jobs/${jobId}/estimate`);
}

export async function deleteEstimateItem(jobId: string, formData: FormData) {
  const itemId = String(formData.get("item_id") ?? "");
  if (!itemId) return;

  const { supabase, organizationId } = await requireOrganizationContext();
  await supabase.from("estimate_items").delete().eq("id", itemId).eq("organization_id", organizationId);
  revalidatePath(`/jobs/${jobId}/estimate`);
}

export async function saveEstimateVersion(jobId: string) {
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("estimate_type", "primary")
    .maybeSingle();

  if (!estimate) {
    redirect(`/jobs/${jobId}/estimate?error=Add%20at%20least%20one%20estimate%20item%20before%20creating%20a%20version`);
  }

  const { error } = await supabase.rpc("snapshot_estimate", {
    p_estimate_id: estimate.id,
    p_reason: "manual_snapshot",
  });

  if (error) {
    console.error("snapshot_estimate failed", error.code);
    redirect(`/jobs/${jobId}/estimate?error=Unable%20to%20create%20the%20estimate%20version`);
  }

  revalidatePath(`/jobs/${jobId}/history`);
  redirect(`/jobs/${jobId}/history?message=Estimate%20version%20saved`);
}
