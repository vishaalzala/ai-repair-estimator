"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { syncAutomaticEstimateCharges } from "@/lib/estimating/automatic-charges";
import { syncAutomaticParkingFee } from "@/lib/estimating/parking-fees";
import { calculateLineTotal, parseNumber } from "@/lib/estimating/pricing-engine";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableNumber(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

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

async function getCategoryAndDefaults(organizationId: string, estimate: { rate_card_id: string | null }, categoryId: string) {
  const { supabase } = await requireOrganizationContext();
  const { data: category } = await supabase
    .from("estimate_categories")
    .select("id, code, pricing_basis")
    .eq("organization_id", organizationId)
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) return { category: null, defaultRate: null };

  const { data: defaultRate } = estimate.rate_card_id
    ? await supabase
        .from("rate_card_rates")
        .select("hourly_rate, fixed_rate")
        .eq("organization_id", organizationId)
        .eq("rate_card_id", estimate.rate_card_id)
        .eq("category_id", category.id)
        .maybeSingle()
    : { data: null };

  return { category, defaultRate };
}

function readLineValues(formData: FormData, defaults?: { hourly_rate?: number | string | null; fixed_rate?: number | string | null }) {
  const enteredRate = value(formData, "labour_rate");
  const enteredFixed = value(formData, "fixed_amount");
  const labourRate = enteredRate ? Math.max(0, parseNumber(formData.get("labour_rate"))) : Number(defaults?.hourly_rate ?? 0);
  const fixedAmount = enteredFixed ? parseNumber(formData.get("fixed_amount")) : Number(defaults?.fixed_rate ?? 0);
  const quantity = Math.max(0.01, parseNumber(formData.get("quantity")) || 1);
  const labourHours = Math.max(0, parseNumber(formData.get("labour_hours")));
  const partCost = Math.max(0, parseNumber(formData.get("part_cost")));
  const markupPercent = Math.max(0, parseNumber(formData.get("markup_percent")));
  const freightAmount = Math.max(0, parseNumber(formData.get("freight_amount")));
  const adjustmentAmount = parseNumber(formData.get("adjustment_amount"));
  const calculated = calculateLineTotal({ quantity, labourHours, labourRate, fixedAmount, partCost, markupPercent, freightAmount, adjustmentAmount });

  return { quantity, labourHours, labourRate, fixedAmount, partCost, markupPercent, freightAmount, adjustmentAmount, total: calculated.total };
}

async function syncEstimateDerivedCharges(jobId: string) {
  await syncAutomaticParkingFee(jobId);
  await syncAutomaticEstimateCharges(jobId);
}

export async function addEstimateItem(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId, job, estimate } = await ensureEstimate(jobId);
  const categoryId = value(formData, "category_id");
  const description = value(formData, "description");

  if (!categoryId || !description) {
    redirect(`/jobs/${jobId}/estimate?error=Category%20and%20description%20are%20required`);
  }

  const { category, defaultRate } = await getCategoryAndDefaults(organizationId, estimate, categoryId);
  if (!category) redirect(`/jobs/${jobId}/estimate?error=Invalid%20estimate%20category`);

  const line = readLineValues(formData, defaultRate ?? undefined);
  const { error } = await supabase.from("estimate_items").insert({
    organization_id: organizationId,
    estimate_id: estimate.id,
    category_id: category.id,
    component: null,
    side: value(formData, "side") || null,
    operation_code: value(formData, "operation_code") || null,
    description,
    quantity: line.quantity,
    labour_hours: line.labourHours,
    labour_rate: line.labourRate,
    fixed_amount: line.fixedAmount,
    part_cost: line.partCost,
    markup_percent: line.markupPercent,
    freight_amount: line.freightAmount,
    adjustment_amount: line.adjustmentAmount,
    line_total_ex_tax: line.total,
    source_type: "manual",
    human_verified: true,
    extra_selected: formData.get("extra_selected") === "on",
    report_selected: formData.get("report_selected") === "on",
    blend_selected: category.code === "paint" && formData.get("blend_selected") === "on",
    notes: value(formData, "notes") || null,
    created_by: userId,
  });

  if (error) {
    console.error("Estimate item insert failed", error.code);
    redirect(`/jobs/${jobId}/estimate?error=Unable%20to%20add%20the%20estimate%20item`);
  }

  if (["draft", "intake_complete", "photos_required", "damage_review"].includes(job.status)) {
    await supabase.from("jobs").update({ status: "estimating" }).eq("id", job.id).eq("organization_id", organizationId);
  }

  await syncEstimateDerivedCharges(jobId);
  revalidatePath(`/jobs/${jobId}/estimate`);
}

export async function updateEstimateItem(jobId: string, formData: FormData) {
  const itemId = value(formData, "item_id");
  const categoryId = value(formData, "category_id");
  const description = value(formData, "description");
  if (!itemId || !categoryId || !description) return;

  const { supabase, organizationId, userId, estimate } = await ensureEstimate(jobId);
  const { data: existing } = await supabase
    .from("estimate_items")
    .select("id, source_type, source_ref, human_verified, report_selected, blend_selected, extra_selected, category_id, component, side, operation_code, description, quantity, labour_hours, labour_rate, fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount, notes")
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimate.id)
    .eq("id", itemId)
    .maybeSingle();
  if (!existing) return;
  if (existing.source_type === "rule" && (existing.source_ref?.startsWith("auto:") || existing.source_ref === "parking_fee_daily")) return;

  const { category } = await getCategoryAndDefaults(organizationId, estimate, categoryId);
  if (!category) return;

  const line = readLineValues(formData);
  const after = {
    category_id: category.id,
    side: value(formData, "side") || null,
    operation_code: value(formData, "operation_code") || null,
    description,
    quantity: line.quantity,
    labour_hours: line.labourHours,
    labour_rate: line.labourRate,
    fixed_amount: line.fixedAmount,
    part_cost: line.partCost,
    markup_percent: line.markupPercent,
    freight_amount: line.freightAmount,
    adjustment_amount: line.adjustmentAmount,
    line_total_ex_tax: line.total,
    notes: value(formData, "notes") || null,
    human_verified: existing.human_verified,
    extra_selected: formData.get("extra_selected") === "on",
    report_selected: formData.get("report_selected") === "on",
    blend_selected: category.code === "paint" && formData.get("blend_selected") === "on",
  };

  const { error } = await supabase
    .from("estimate_items")
    .update(after)
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimate.id)
    .eq("id", itemId);

  if (error) {
    console.error("Estimate item update failed", error.code);
    redirect(`/jobs/${jobId}/estimate?error=Unable%20to%20update%20the%20estimate%20item`);
  }

  if (existing.source_type === "ai") {
    await supabase.from("learning_events").insert({
      organization_id: organizationId,
      user_id: userId,
      job_id: jobId,
      event_type: "ai_modified",
      entity_type: "estimate_item",
      entity_id: itemId,
      before_data: existing,
      after_data: after,
      context: { source_type: existing.source_type },
    });
  }

  await syncEstimateDerivedCharges(jobId);
  revalidatePath(`/jobs/${jobId}/estimate`);
}

export async function deleteEstimateItem(jobId: string, formData: FormData) {
  const itemId = value(formData, "item_id");
  if (!itemId) return;

  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: existing } = await supabase
    .from("estimate_items")
    .select("id, source_type, source_ref")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!existing) return;
  if (existing.source_type === "rule" && (existing.source_ref?.startsWith("auto:") || existing.source_ref === "parking_fee_daily")) return;

  await supabase.from("estimate_items").delete().eq("id", itemId).eq("organization_id", organizationId);
  await syncEstimateDerivedCharges(jobId);
  revalidatePath(`/jobs/${jobId}/estimate`);
}

export async function updateEstimateContext(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, customer_id, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;

  await supabase.from("jobs").update({
    job_reference: value(formData, "job_reference") || null,
    repair_type: value(formData, "repair_type") || null,
    repair_size: value(formData, "repair_size") || null,
    work_source: value(formData, "work_source") || null,
  }).eq("organization_id", organizationId).eq("id", jobId);

  if (job.vehicle_id) {
    const adasRaw = value(formData, "adas_present");
    await supabase.from("vehicles").update({
      registration: value(formData, "registration").toUpperCase() || null,
      vin: value(formData, "vin").toUpperCase() || null,
      make: value(formData, "make") || null,
      model: value(formData, "model") || null,
      variant: value(formData, "variant") || null,
      model_year: nullableNumber(formData, "model_year"),
      colour: value(formData, "colour") || null,
      paint_code: value(formData, "paint_code") || null,
      odometer_km: nullableNumber(formData, "odometer_km"),
      body_type: value(formData, "body_type") || null,
      fuel_type: value(formData, "fuel_type") || null,
      is_ev: formData.get("is_ev") === "on",
      is_hybrid: formData.get("is_hybrid") === "on",
      adas_present: adasRaw === "true" ? true : adasRaw === "false" ? false : null,
    }).eq("organization_id", organizationId).eq("id", job.vehicle_id);
  }

  const customerFields = {
    first_name: value(formData, "customer_first_name") || null,
    last_name: value(formData, "customer_last_name") || null,
    email: value(formData, "customer_email") || null,
    phone: value(formData, "customer_phone") || null,
  };
  const hasCustomer = Object.values(customerFields).some(Boolean);
  let customerId = job.customer_id;

  if (customerId) {
    if (hasCustomer) {
      await supabase.from("customers").update(customerFields).eq("organization_id", organizationId).eq("id", customerId);
    }
  } else if (hasCustomer) {
    const { data: created } = await supabase.from("customers").insert({
      organization_id: organizationId,
      customer_type: "individual",
      ...customerFields,
      created_by: userId,
    }).select("id").maybeSingle();
    customerId = created?.id ?? null;
    if (customerId) {
      await Promise.all([
        supabase.from("jobs").update({ customer_id: customerId }).eq("organization_id", organizationId).eq("id", jobId),
        job.vehicle_id ? supabase.from("vehicles").update({ customer_id: customerId }).eq("organization_id", organizationId).eq("id", job.vehicle_id) : Promise.resolve(),
      ]);
    }
  }

  const insurerName = value(formData, "insurer_name");
  let insurerId: string | null = null;
  if (insurerName) {
    const { data: existingInsurer } = await supabase.from("insurers").select("id").eq("organization_id", organizationId).ilike("name", insurerName).limit(1).maybeSingle();
    insurerId = existingInsurer?.id ?? null;
    if (!insurerId) {
      const { data: createdInsurer } = await supabase.from("insurers").insert({ organization_id: organizationId, name: insurerName }).select("id").maybeSingle();
      insurerId = createdInsurer?.id ?? null;
    }
  }

  await supabase.from("claims").update({
    insurer_id: insurerId,
    claim_number: value(formData, "claim_number") || null,
    policy_number: value(formData, "policy_number") || null,
    assessor_name: value(formData, "assessor_name") || null,
    assessor_email: value(formData, "assessor_email") || null,
    assessor_phone: value(formData, "assessor_phone") || null,
    excess_amount: nullableNumber(formData, "excess_amount"),
    accident_location: value(formData, "accident_location") || null,
    accident_description: value(formData, "accident_description") || null,
    authority_reference: value(formData, "authority_reference") || null,
  }).eq("organization_id", organizationId).eq("job_id", jobId);

  revalidatePath(`/jobs/${jobId}/estimate`);
  revalidatePath(`/jobs/${jobId}`);
}

export async function createPrintableEstimateVersion(jobId: string) {
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("estimate_type", "primary")
    .maybeSingle();

  if (!estimate) return { error: "Add at least one estimate item before printing." };

  await syncEstimateDerivedCharges(jobId);
  const { data: versionId, error } = await supabase.rpc("snapshot_estimate", {
    p_estimate_id: estimate.id,
    p_reason: "manual_snapshot",
  });

  if (error || !versionId) {
    console.error("snapshot_estimate print failed", error?.code);
    return { error: "Unable to prepare the estimate printout." };
  }

  revalidatePath(`/jobs/${jobId}/history`);
  return { versionId: String(versionId) };
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

  await syncEstimateDerivedCharges(jobId);
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
