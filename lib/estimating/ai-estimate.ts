import { requireOrganizationContext } from "@/lib/auth/context";
import type { DamageAnalysis } from "@/lib/ai/tasks/damage-analysis";
import { generateRepairEstimateDraft } from "@/lib/ai/tasks/estimate-generation";
import { calculateLineTotal } from "@/lib/estimating/pricing-engine";

function clip(value: string, max = 1400) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function ensurePrimaryEstimate(jobId: string) {
  const context = await requireOrganizationContext();
  const { supabase, organizationId, userId } = context;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, vehicle_id, repair_type, repair_size, work_source")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) throw new Error("Job not found");

  const { data: existing } = await supabase
    .from("estimates")
    .select("id, rate_card_id, tax_rate, currency, notes")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("estimate_type", "primary")
    .maybeSingle();
  if (existing) return { ...context, job, estimate: existing };

  const [{ data: rateCard }, { data: settings }] = await Promise.all([
    supabase.from("rate_cards").select("id").eq("organization_id", organizationId).eq("is_default", true).eq("is_active", true).maybeSingle(),
    supabase.from("workshop_settings").select("gst_rate, default_currency").eq("organization_id", organizationId).maybeSingle(),
  ]);

  const { data: created, error } = await supabase.from("estimates").insert({
    organization_id: organizationId,
    job_id: jobId,
    rate_card_id: rateCard?.id ?? null,
    estimate_type: "primary",
    status: "draft",
    currency: settings?.default_currency ?? "NZD",
    tax_rate: settings?.gst_rate ?? 15,
    created_by: userId,
  }).select("id, rate_card_id, tax_rate, currency, notes").single();

  if (error || !created) throw new Error(`Unable to create primary estimate: ${error?.code ?? "unknown"}`);
  return { ...context, job, estimate: created };
}

export async function generateAndPersistAiEstimate(jobId: string, damageAnalysis: DamageAnalysis) {
  const { supabase, organizationId, userId, job, estimate } = await ensurePrimaryEstimate(jobId);
  const model = process.env.AI_ESTIMATE_MODEL?.trim() || process.env.AI_REVIEW_MODEL?.trim() || process.env.AI_DAMAGE_MODEL?.trim();
  if (!process.env.OPENAI_API_KEY || !model) throw new Error("OpenAI estimate generation is not configured");

  const [vehicleResult, claimResult, categoriesResult, existingItemsResult, knowledgeResult] = await Promise.all([
    job.vehicle_id
      ? supabase.from("vehicles").select("registration, vin, make, model, variant, model_year, body_type, fuel_type, is_ev, is_hybrid, adas_present, colour, paint_code").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("claims").select("claim_number, accident_date, accident_location, accident_description, excess_amount").eq("organization_id", organizationId).eq("job_id", jobId).maybeSingle(),
    supabase.from("estimate_categories").select("id, code, name, pricing_basis, sort_order").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
    supabase.from("estimate_items").select("id, category_id, description, component, side, operation_code, source_type, human_verified").eq("organization_id", organizationId).eq("estimate_id", estimate.id).order("sort_order").order("created_at"),
    supabase.from("knowledge_sources").select("id, scope, title, content_text").eq("status", "active").order("created_at", { ascending: false }).limit(15),
  ]);

  const vehicle = vehicleResult.data;
  const claim = claimResult.data;
  const categories = categoriesResult.data ?? [];
  if (!categories.length) throw new Error("No estimate categories are configured");

  const categoryByCode = new Map(categories.map((category) => [category.code, category]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const rateRowsResult = estimate.rate_card_id
    ? await supabase.from("rate_card_rates").select("category_id, hourly_rate, fixed_rate").eq("organization_id", organizationId).eq("rate_card_id", estimate.rate_card_id)
    : { data: [] };
  const rateByCategoryId = new Map((rateRowsResult.data ?? []).map((rate) => [rate.category_id, rate]));

  const existingItems = existingItemsResult.data ?? [];
  const protectedItems = existingItems.filter((item) => item.source_type !== "ai" || item.human_verified);
  const existingContext = protectedItems.length
    ? protectedItems.map((item) => {
        const category = categoryById.get(item.category_id);
        return `${category?.name ?? "Category"} | ${[item.side, item.component, item.operation_code].filter(Boolean).join(" ")} | ${item.description}`;
      }).join("\n")
    : "No manual or human-verified estimate lines yet.";

  const vehicleContext = [
    `Registration: ${clean(vehicle?.registration) || clean(damageAnalysis.vehicleIdentification.registration) || "unknown"}`,
    `VIN: ${clean(vehicle?.vin) || "unknown"}`,
    `Vehicle: ${[vehicle?.model_year ?? damageAnalysis.vehicleIdentification.modelYear, vehicle?.make ?? damageAnalysis.vehicleIdentification.make, vehicle?.model ?? damageAnalysis.vehicleIdentification.model, vehicle?.variant ?? damageAnalysis.vehicleIdentification.variant].filter(Boolean).join(" ") || "unknown"}`,
    `Body type: ${clean(vehicle?.body_type) || clean(damageAnalysis.vehicleIdentification.bodyType) || "unknown"}`,
    `Colour / paint: ${[vehicle?.colour ?? damageAnalysis.vehicleIdentification.colour, vehicle?.paint_code].filter(Boolean).join(" / ") || "unknown"}`,
    `Fuel: ${clean(vehicle?.fuel_type) || "unknown"}; EV=${vehicle?.is_ev ? "yes" : "no/unknown"}; Hybrid=${vehicle?.is_hybrid ? "yes" : "no/unknown"}; ADAS=${vehicle?.adas_present === true ? "present" : vehicle?.adas_present === false ? "not noted" : "not confirmed"}`,
    `Repair type / size: ${[job.repair_type, job.repair_size].filter(Boolean).join(" / ") || "unknown"}`,
  ].join("\n");

  const claimContext = [
    `Claim: ${clean(claim?.claim_number) || "unknown"}`,
    `Accident date/location: ${[claim?.accident_date, claim?.accident_location].filter(Boolean).join(" / ") || "not provided"}`,
    `Estimator / accident note: ${clean(claim?.accident_description) || "not provided"}`,
    `Excess: ${claim?.excess_amount ?? "not provided"}`,
  ].join("\n");

  const damageContext = [
    `Impact area: ${damageAnalysis.impactArea}`,
    `Severity: ${damageAnalysis.severity}`,
    `Vision summary: ${damageAnalysis.summary}`,
    ...damageAnalysis.findings.map((finding, index) =>
      `${index + 1}. ${[finding.side, finding.component].filter(Boolean).join(" ")} | visible=${finding.observedDamage} | suggested=${finding.suggestedAction} | confidence=${finding.confidence}${finding.inspectionNote ? ` | inspection=${finding.inspectionNote}` : ""}`,
    ),
    ...damageAnalysis.inspectionSuggestions.map((note) => `Inspection only: ${note}`),
  ].join("\n");

  const workshopContext = [
    "Configured estimate categories / rates:",
    ...categories.map((category) => {
      const rate = rateByCategoryId.get(category.id);
      return `${category.code} = ${category.name}; pricing=${category.pricing_basis}; hourly=${rate?.hourly_rate ?? "TBC"}; fixed=${rate?.fixed_rate ?? "TBC"}`;
    }),
    "\nExisting manual/human-verified lines (do not duplicate):",
    existingContext,
  ].join("\n");

  const knowledgeContext = (knowledgeResult.data ?? [])
    .filter((source) => source.content_text)
    .map((source) => `K:${source.id} | scope=${source.scope} | ${source.title}\n${clip(source.content_text ?? "")}`)
    .join("\n\n") || "No additional workshop knowledge supplied.";

  const { data: run, error: runError } = await supabase.from("ai_analysis_runs").insert({
    organization_id: organizationId,
    job_id: jobId,
    task: "estimate_generation",
    provider: "openai",
    model,
    status: "running",
    input_metadata: {
      estimate_id: estimate.id,
      damage_findings: damageAnalysis.findings.length,
      protected_existing_items: protectedItems.length,
      vision_vehicle_confidence: damageAnalysis.vehicleIdentification.confidence,
    },
    created_by: userId,
  }).select("id").single();
  if (runError || !run) throw new Error(`Unable to start AI estimate run: ${runError?.code ?? "unknown"}`);

  const started = Date.now();
  try {
    const result = await generateRepairEstimateDraft({
      model,
      vehicleContext,
      claimContext,
      damageContext,
      workshopContext,
      knowledgeContext,
    });

    const paintCategory = categoryByCode.get("paint");
    const blendCategory = categoryByCode.get("blend");
    const rows = result.draft.operations.flatMap((operation, index) => {
      const isBlend = operation.categoryCode === "blend" || operation.operationCode === "BLEND" || operation.blendSelected;
      const requestedCategory = categoryByCode.get(operation.categoryCode);
      const category = isBlend ? paintCategory : requestedCategory;
      if (!category) return [];

      const rate = rateByCategoryId.get(category.id);
      const blendRate = blendCategory ? rateByCategoryId.get(blendCategory.id) : null;
      const labourRate = category.pricing_basis === "hourly" ? Number(rate?.hourly_rate ?? 0) : 0;
      const fixedAmount = isBlend
        ? Number(blendRate?.fixed_rate ?? 0)
        : category.pricing_basis === "fixed"
          ? Number(rate?.fixed_rate ?? 0)
          : 0;
      const labourHours = category.pricing_basis === "hourly" ? operation.labourHours : 0;
      const calculated = calculateLineTotal({
        quantity: operation.quantity,
        labourHours,
        labourRate,
        fixedAmount,
        partCost: 0,
        markupPercent: 0,
        freightAmount: 0,
        adjustmentAmount: 0,
      });

      const pricingNote = operation.pricingStatus === "parts_tbc"
        ? "REPLACE — part price TBC. Obtain supplier/PartsTrader price before approval."
        : operation.pricingStatus === "manual_tbc"
          ? "Amount TBC — estimator/workshop input required before approval."
          : operation.pricingStatus === "included"
            ? "Included operation; no separate charge generated."
            : null;
      const notes = [operation.notes, pricingNote, "AI-generated preliminary line — estimator review required."].filter(Boolean).join(" ");

      return [{
        organization_id: organizationId,
        estimate_id: estimate.id,
        category_id: category.id,
        component: operation.component,
        side: operation.side,
        operation_code: operation.operationCode,
        description: operation.description,
        quantity: operation.quantity,
        labour_hours: labourHours,
        labour_rate: labourRate,
        fixed_amount: fixedAmount,
        part_cost: 0,
        markup_percent: 0,
        freight_amount: 0,
        adjustment_amount: 0,
        line_total_ex_tax: operation.pricingStatus === "included" ? 0 : calculated.total,
        source_type: "ai",
        source_ref: run.id,
        ai_confidence: operation.confidence,
        human_verified: false,
        report_selected: operation.reportSelected,
        blend_selected: isBlend,
        notes,
        sort_order: category.sort_order * 100 + index,
        created_by: userId,
      }];
    });

    if (!rows.length) throw new Error("AI returned no estimate operations that match configured categories");

    await supabase
      .from("estimate_items")
      .delete()
      .eq("organization_id", organizationId)
      .eq("estimate_id", estimate.id)
      .eq("source_type", "ai")
      .eq("human_verified", false);

    const { data: inserted, error: insertError } = await supabase.from("estimate_items").insert(rows).select("id");
    if (insertError || !inserted) throw new Error(`Unable to save AI estimate items: ${insertError?.code ?? "unknown"}`);

    if (job.vehicle_id && damageAnalysis.vehicleIdentification.confidence >= 0.8) {
      const identified = damageAnalysis.vehicleIdentification;
      const patch: Record<string, string | number> = {};
      if (!vehicle?.registration && identified.registration) patch.registration = identified.registration.toUpperCase().replace(/\s+/g, "");
      if (!vehicle?.make && identified.make) patch.make = identified.make;
      if (!vehicle?.model && identified.model) patch.model = identified.model;
      if (!vehicle?.variant && identified.variant) patch.variant = identified.variant;
      if (!vehicle?.model_year && identified.modelYear) patch.model_year = identified.modelYear;
      if (!vehicle?.body_type && identified.bodyType) patch.body_type = identified.bodyType;
      if (!vehicle?.colour && identified.colour) patch.colour = identified.colour;
      if (Object.keys(patch).length) {
        await supabase.from("vehicles").update(patch).eq("organization_id", organizationId).eq("id", job.vehicle_id);
      }
    }

    const combinedNotes = [
      estimate.notes,
      `AI draft summary: ${result.draft.summary}`,
      result.draft.inspectionNotes.length ? `Inspection / supplement checks: ${result.draft.inspectionNotes.join(" | ")}` : null,
      result.draft.estimatorNotes.length ? `Estimator review notes: ${result.draft.estimatorNotes.join(" | ")}` : null,
    ].filter(Boolean).join("\n");

    await Promise.all([
      supabase.from("estimates").update({ notes: combinedNotes || null }).eq("organization_id", organizationId).eq("id", estimate.id),
      supabase.from("jobs").update({ status: "estimating" }).eq("organization_id", organizationId).eq("id", jobId),
      supabase.from("ai_analysis_runs").update({
        status: "completed",
        structured_output: result.draft,
        raw_response: { response_id: result.responseId },
        input_tokens: result.usage.inputTokens,
        cached_input_tokens: result.usage.cachedInputTokens,
        output_tokens: result.usage.outputTokens,
        latency_ms: Date.now() - started,
        completed_at: new Date().toISOString(),
      }).eq("organization_id", organizationId).eq("id", run.id),
      supabase.from("activity_events").insert({
        organization_id: organizationId,
        job_id: jobId,
        actor_user_id: userId,
        event_type: "ai_estimate_generated",
        title: "AI full estimate generated",
        details: { ai_run_id: run.id, estimate_id: estimate.id, items: inserted.length, model },
      }),
    ]);

    return {
      estimateId: estimate.id,
      itemCount: inserted.length,
      summary: result.draft.summary,
      inspectionNotes: result.draft.inspectionNotes,
    };
  } catch (error) {
    await supabase.from("ai_analysis_runs").update({
      status: "failed",
      error_code: error instanceof Error ? error.message.slice(0, 250) : "unknown_error",
      latency_ms: Date.now() - started,
      completed_at: new Date().toISOString(),
    }).eq("organization_id", organizationId).eq("id", run.id);
    throw error;
  }
}
