import { requireOrganizationContext } from "@/lib/auth/context";

const PARKING_SOURCE_REF = "parking_fee_daily";
const DAY_MS = 24 * 60 * 60 * 1000;

function commencedDays(startedAt: string) {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return 1;
  const elapsed = Math.max(0, Date.now() - started);
  return Math.max(1, Math.floor(elapsed / DAY_MS) + 1);
}

export async function syncAutomaticParkingFee(jobId: string) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();

  const [jobResult, settingsResult, estimateResult, categoryResult] = await Promise.all([
    supabase.from("jobs").select("id, created_at").eq("organization_id", organizationId).eq("id", jobId).maybeSingle(),
    supabase.from("workshop_settings").select("parking_fee_enabled, parking_fee_daily_rate").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("estimates").select("id, status").eq("organization_id", organizationId).eq("job_id", jobId).eq("estimate_type", "primary").maybeSingle(),
    supabase.from("estimate_categories").select("id, sort_order").eq("organization_id", organizationId).eq("code", "miscellaneous").eq("is_active", true).maybeSingle(),
  ]);

  const job = jobResult.data;
  const settings = settingsResult.data;
  const estimate = estimateResult.data;
  const category = categoryResult.data;

  if (!job || !estimate) return;

  const canMutateDraft = ["draft", "ready_for_approval"].includes(estimate.status);
  if (!canMutateDraft) return;

  const enabled = Boolean(settings?.parking_fee_enabled);
  const dailyRate = Number(settings?.parking_fee_daily_rate ?? 0);

  const { data: existing } = await supabase
    .from("estimate_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimate.id)
    .eq("source_type", "rule")
    .eq("source_ref", PARKING_SOURCE_REF)
    .maybeSingle();

  if (!enabled || !Number.isFinite(dailyRate) || dailyRate <= 0 || !category) {
    if (existing) {
      await supabase
        .from("estimate_items")
        .delete()
        .eq("organization_id", organizationId)
        .eq("estimate_id", estimate.id)
        .eq("id", existing.id);
    }
    return;
  }

  const days = commencedDays(job.created_at);
  const total = Math.round(dailyRate * days * 100) / 100;
  const payload = {
    organization_id: organizationId,
    estimate_id: estimate.id,
    category_id: category.id,
    component: "Parking",
    side: "NA",
    operation_code: "PARKING",
    description: "Parking fees",
    quantity: days,
    labour_hours: 0,
    labour_rate: 0,
    fixed_amount: total,
    part_cost: 0,
    markup_percent: 0,
    freight_amount: 0,
    adjustment_amount: 0,
    line_total_ex_tax: total,
    source_type: "rule",
    source_ref: PARKING_SOURCE_REF,
    human_verified: true,
    report_selected: true,
    blend_selected: false,
    notes: `$${dailyRate.toFixed(2)} per commenced day × ${days} day${days === 1 ? "" : "s"}. Automatically calculated from the job creation time.`,
    sort_order: category.sort_order * 100 + 95,
    created_by: userId,
  };

  if (existing) {
    await supabase
      .from("estimate_items")
      .update(payload)
      .eq("organization_id", organizationId)
      .eq("estimate_id", estimate.id)
      .eq("id", existing.id);
  } else {
    await supabase.from("estimate_items").insert(payload);
  }
}

export async function syncAutomaticParkingFeesForOpenEstimates() {
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: estimates } = await supabase
    .from("estimates")
    .select("job_id")
    .eq("organization_id", organizationId)
    .eq("estimate_type", "primary")
    .in("status", ["draft", "ready_for_approval"]);

  const jobIds = [...new Set((estimates ?? []).map((estimate) => estimate.job_id))];
  for (const jobId of jobIds) {
    await syncAutomaticParkingFee(jobId);
  }
}
