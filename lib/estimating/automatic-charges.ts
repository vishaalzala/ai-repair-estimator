import { requireOrganizationContext } from "@/lib/auth/context";
import { roundMoney } from "@/lib/estimating/pricing-engine";

const PANEL_MATERIALS_REF = "auto:panel_materials";
const PAINT_SETUP_REF = "auto:paint_setup";
const ENVIRONMENTAL_FEE_REF = "auto:environmental_fee";

const AUTOMATIC_REFS = [PANEL_MATERIALS_REF, PAINT_SETUP_REF, ENVIRONMENTAL_FEE_REF];

export async function syncAutomaticEstimateCharges(jobId: string) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();

  const [estimateResult, settingsResult, categoriesResult] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("job_id", jobId)
      .eq("estimate_type", "primary")
      .maybeSingle(),
    supabase
      .from("workshop_settings")
      .select("panel_materials_enabled, panel_materials_percent, paint_setup_enabled, paint_setup_amount, environmental_fee_enabled, environmental_fee_amount")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("estimate_categories")
      .select("id, code, pricing_basis, sort_order")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  const estimate = estimateResult.data;
  const settings = settingsResult.data;
  const categories = categoriesResult.data ?? [];
  if (!estimate || !["draft", "ready_for_approval"].includes(estimate.status)) return;

  const { data: itemsData } = await supabase
    .from("estimate_items")
    .select("id, category_id, labour_hours, labour_rate, line_total_ex_tax, report_selected, extra_selected, source_ref")
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimate.id);

  const items = itemsData ?? [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoryByCode = new Map(categories.map((category) => [category.code, category]));

  const includedNonAutomatic = items.filter((item) =>
    !item.report_selected &&
    !item.extra_selected &&
    !AUTOMATIC_REFS.includes(item.source_ref ?? ""),
  );
  const hasActiveQuote = includedNonAutomatic.length > 0;

  const eligibleLabour = includedNonAutomatic.reduce((sum, item) => {
    const category = categoryById.get(item.category_id);
    if (!category || category.pricing_basis !== "hourly") return sum;
    return sum + Math.max(0, Number(item.labour_hours ?? 0)) * Math.max(0, Number(item.labour_rate ?? 0));
  }, 0);

  const panelPercent = Number(settings?.panel_materials_percent ?? 5);
  const panelAmount = roundMoney(eligibleLabour * (Math.max(0, panelPercent) / 100));
  const paintSetupAmount = roundMoney(Number(settings?.paint_setup_amount ?? 70));
  const environmentalFeeAmount = roundMoney(Number(settings?.environmental_fee_amount ?? 10));

  await syncAutomaticLine({
    supabase,
    organizationId,
    estimateId: estimate.id,
    userId,
    category: categoryByCode.get("panel_materials"),
    sourceRef: PANEL_MATERIALS_REF,
    component: "Materials",
    operationCode: "PANEL-MAT",
    description: `Panel Materials - ${panelPercent.toFixed(2).replace(/\.00$/, "")}% of eligible labour`,
    amount: panelAmount,
    enabled: Boolean(settings?.panel_materials_enabled ?? true) && panelAmount > 0,
    notes: `${panelPercent.toFixed(2).replace(/\.00$/, "")}% of included hourly labour (${roundMoney(eligibleLabour).toFixed(2)}).`,
  });

  await syncAutomaticLine({
    supabase,
    organizationId,
    estimateId: estimate.id,
    userId,
    category: categoryByCode.get("paint_materials"),
    sourceRef: PAINT_SETUP_REF,
    component: "Paint",
    operationCode: "PAINT-SETUP",
    description: "Paint Setup",
    amount: paintSetupAmount,
    enabled: Boolean(settings?.paint_setup_enabled ?? true) && hasActiveQuote && paintSetupAmount > 0,
    notes: "Automatic paint setup charge from workshop defaults. Applied to every active quote.",
  });

  await syncAutomaticLine({
    supabase,
    organizationId,
    estimateId: estimate.id,
    userId,
    category: categoryByCode.get("miscellaneous"),
    sourceRef: ENVIRONMENTAL_FEE_REF,
    component: "Environmental",
    operationCode: "ENV-FEE",
    description: "Environmental Fee",
    amount: environmentalFeeAmount,
    enabled: Boolean(settings?.environmental_fee_enabled ?? true) && environmentalFeeAmount > 0 && hasActiveQuote,
    notes: "Automatic environmental fee from workshop defaults. Applied to every active quote.",
  });
}

async function syncAutomaticLine({
  supabase,
  organizationId,
  estimateId,
  userId,
  category,
  sourceRef,
  component,
  operationCode,
  description,
  amount,
  enabled,
  notes,
}: {
  supabase: Awaited<ReturnType<typeof requireOrganizationContext>>["supabase"];
  organizationId: string;
  estimateId: string;
  userId: string;
  category: { id: string; sort_order: number } | undefined;
  sourceRef: string;
  component: string;
  operationCode: string;
  description: string;
  amount: number;
  enabled: boolean;
  notes: string;
}) {
  const { data: existing } = await supabase
    .from("estimate_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimateId)
    .eq("source_type", "rule")
    .eq("source_ref", sourceRef)
    .maybeSingle();

  if (!enabled || !category || !Number.isFinite(amount) || amount <= 0) {
    if (existing) {
      await supabase
        .from("estimate_items")
        .delete()
        .eq("organization_id", organizationId)
        .eq("estimate_id", estimateId)
        .eq("id", existing.id);
    }
    return;
  }

  const payload = {
    organization_id: organizationId,
    estimate_id: estimateId,
    category_id: category.id,
    component,
    side: "NA",
    operation_code: operationCode,
    description,
    quantity: 1,
    labour_hours: 0,
    labour_rate: 0,
    fixed_amount: amount,
    part_cost: 0,
    markup_percent: 0,
    freight_amount: 0,
    adjustment_amount: 0,
    line_total_ex_tax: amount,
    source_type: "rule",
    source_ref: sourceRef,
    human_verified: true,
    report_selected: false,
    blend_selected: false,
    extra_selected: false,
    notes,
    sort_order: category.sort_order * 100 + 90,
    created_by: userId,
  };

  if (existing) {
    await supabase
      .from("estimate_items")
      .update(payload)
      .eq("organization_id", organizationId)
      .eq("estimate_id", estimateId)
      .eq("id", existing.id);
  } else {
    await supabase.from("estimate_items").insert(payload);
  }
}

export async function syncAutomaticEstimateChargesForOpenEstimates() {
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: estimates } = await supabase
    .from("estimates")
    .select("job_id")
    .eq("organization_id", organizationId)
    .eq("estimate_type", "primary")
    .in("status", ["draft", "ready_for_approval"]);

  const jobIds = [...new Set((estimates ?? []).map((estimate) => estimate.job_id))];
  for (const jobId of jobIds) {
    await syncAutomaticEstimateCharges(jobId);
  }
}
