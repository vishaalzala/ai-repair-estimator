"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { reviewRepairEstimate } from "@/lib/ai/tasks/estimate-review";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function clip(value: string, max = 1600) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export async function runSmartEstimateReview(jobId: string) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const model = process.env.AI_REVIEW_MODEL?.trim();
  if (!process.env.OPENAI_API_KEY || !model) {
    redirect(`/jobs/${jobId}/ai-review/second-pass?error=Smart%20review%20is%20not%20available%20right%20now.%20Please%20contact%20your%20platform%20administrator`);
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, vehicle_id, repair_type, repair_size, work_source")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) redirect("/jobs");

  const [vehicleResult, claimResult, estimateResult, damageResult, ruleCheckResult, knowledgeResult] = await Promise.all([
    job.vehicle_id
      ? supabase.from("vehicles").select("registration, vin, make, model, variant, model_year, body_type, fuel_type, is_ev, is_hybrid, adas_present, colour, paint_code").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("claims").select("claim_number, insurer_id, excess_amount, accident_date, accident_location, accident_description").eq("organization_id", organizationId).eq("job_id", jobId).maybeSingle(),
    supabase.from("estimates").select("id, currency, tax_rate, status").eq("organization_id", organizationId).eq("job_id", jobId).eq("estimate_type", "primary").maybeSingle(),
    supabase.from("damage_findings").select("id, component, side, observed_damage, suggested_action, confidence, review_status").eq("organization_id", organizationId).eq("job_id", jobId).order("created_at", { ascending: false }),
    supabase.from("ai_review_checks").select("id, check_type, title, detail, severity, source_type, source_ref, resolution").eq("organization_id", organizationId).eq("job_id", jobId).eq("source_type", "rule"),
    supabase.from("knowledge_sources").select("id, scope, source_type, title, content_text, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(20),
  ]);

  const estimate = estimateResult.data;
  if (!estimate) redirect(`/jobs/${jobId}/ai-review/second-pass?error=Build%20the%20draft%20estimate%20before%20running%20the%20smart%20second%20pass`);

  const [estimateItemResult, partsRequestResult, knowledgeChunkResult] = await Promise.all([
    supabase.from("estimate_items").select("id, category_id, component, side, operation_code, description, quantity, labour_hours, labour_rate, fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount, line_total_ex_tax, source_type, human_verified").eq("organization_id", organizationId).eq("estimate_id", estimate.id).order("sort_order").order("created_at"),
    supabase.from("parts_requests").select("id, status, provider").eq("organization_id", organizationId).eq("job_id", jobId).neq("status", "cancelled"),
    supabase.from("knowledge_chunks").select("id, source_id, page_number, section_title, content").order("created_at", { ascending: false }).limit(20),
  ]);

  const estimateItems = estimateItemResult.data ?? [];
  if (!estimateItems.length) redirect(`/jobs/${jobId}/ai-review/second-pass?error=Add%20estimate%20operations%20before%20running%20the%20smart%20review`);

  const partsRequestIds = (partsRequestResult.data ?? []).map((row) => row.id);
  const partsItemsResult = partsRequestIds.length
    ? await supabase.from("parts_request_items").select("description, component, side, part_number, quantity, part_type, status").eq("organization_id", organizationId).in("parts_request_id", partsRequestIds)
    : { data: [] };

  const categoryIds = [...new Set(estimateItems.map((item) => item.category_id))];
  const categoryResult = categoryIds.length
    ? await supabase.from("estimate_categories").select("id, code, name").eq("organization_id", organizationId).in("id", categoryIds)
    : { data: [] };
  const categoryById = new Map((categoryResult.data ?? []).map((category) => [category.id, category]));

  const vehicle = vehicleResult.data;
  const claim = claimResult.data;
  const vehicleContext = [
    `Registration: ${clean(vehicle?.registration) || "unknown"}`,
    `VIN: ${clean(vehicle?.vin) || "unknown"}`,
    `Vehicle: ${[vehicle?.model_year, vehicle?.make, vehicle?.model, vehicle?.variant].filter(Boolean).join(" ") || "unknown"}`,
    `Body/fuel: ${[vehicle?.body_type, vehicle?.fuel_type].filter(Boolean).join(" / ") || "unknown"}`,
    `EV=${vehicle?.is_ev ? "yes" : "no/unknown"}; Hybrid=${vehicle?.is_hybrid ? "yes" : "no/unknown"}; ADAS=${vehicle?.adas_present === true ? "present" : vehicle?.adas_present === false ? "not noted" : "not confirmed"}`,
    `Paint: ${[vehicle?.colour, vehicle?.paint_code].filter(Boolean).join(" / ") || "unknown"}`,
    `Repair type/size: ${[job.repair_type, job.repair_size].filter(Boolean).join(" / ") || "unknown"}`,
  ].join("\n");

  const claimContext = [
    `Claim: ${clean(claim?.claim_number) || "unknown"}`,
    `Accident date/location: ${[claim?.accident_date, claim?.accident_location].filter(Boolean).join(" / ") || "not provided"}`,
    `Reported accident: ${clean(claim?.accident_description) || "not provided"}`,
  ].join("\n");

  const damageContext = (damageResult.data ?? []).slice(0, 80).map((finding) =>
    `D:${finding.id} | ${finding.review_status.toUpperCase()} | ${[finding.side, finding.component].filter(Boolean).join(" ")} | ${finding.observed_damage} | suggested=${finding.suggested_action} | confidence=${finding.confidence ?? "unknown"}`,
  ).join("\n") || "No damage findings recorded.";

  const estimateContext = estimateItems.map((item) => {
    const category = categoryById.get(item.category_id);
    return `E:${item.id} | ${category?.name ?? "Category"} | ${[item.side, item.component, item.operation_code].filter(Boolean).join(" ")} | ${item.description} | qty=${item.quantity} | hours=${item.labour_hours} | source=${item.source_type} | verified=${item.human_verified}`;
  }).join("\n");

  const partsContext = (partsItemsResult.data ?? []).map((item) =>
    `${[item.side, item.component].filter(Boolean).join(" ")} | ${item.description} | part#=${item.part_number ?? "TBC"} | type=${item.part_type} | status=${item.status}`,
  ).join("\n") || "No parts request items recorded.";

  const ruleContext = (ruleCheckResult.data ?? []).map((check) =>
    `R:${check.source_ref ?? check.id} | ${check.severity} | ${check.title} | ${check.detail ?? ""} | resolution=${check.resolution ?? "open"}`,
  ).join("\n") || "No deterministic rule checks recorded.";

  const sourceMap = new Map((knowledgeResult.data ?? []).map((source) => [source.id, source]));
  const manualKnowledge = (knowledgeResult.data ?? []).filter((source) => source.content_text).map((source) =>
    `K:${source.id} | scope=${source.scope} | ${source.title}\n${clip(source.content_text ?? "")}`,
  );
  const chunkKnowledge = (knowledgeChunkResult.data ?? []).flatMap((chunk) => {
    const source = sourceMap.get(chunk.source_id);
    if (!source && !chunk.source_id) return [];
    return [`K:${chunk.source_id} | ${source?.title ?? "Document knowledge"}${chunk.page_number ? ` | page ${chunk.page_number}` : ""}${chunk.section_title ? ` | ${chunk.section_title}` : ""}\n${clip(chunk.content, 1200)}`];
  });
  const knowledgeContext = [...manualKnowledge, ...chunkKnowledge].slice(0, 25).join("\n\n") || "No workshop/user knowledge retrieved.";

  const { data: run, error: runError } = await supabase.from("ai_analysis_runs").insert({
    organization_id: organizationId,
    job_id: jobId,
    task: "estimate_review",
    provider: "openai",
    model,
    status: "running",
    input_metadata: { estimate_id: estimate.id, estimate_items: estimateItems.length, knowledge_sources: manualKnowledge.length + chunkKnowledge.length },
    created_by: userId,
  }).select("id").single();
  if (runError || !run) redirect(`/jobs/${jobId}/ai-review/second-pass?error=Unable%20to%20start%20the%20smart%20review`);

  const started = Date.now();
  try {
    const result = await reviewRepairEstimate({ model, vehicleContext, claimContext, damageContext, estimateContext, partsContext, ruleContext, knowledgeContext });

    await supabase.from("ai_review_checks").delete().eq("organization_id", organizationId).eq("job_id", jobId).eq("source_type", "ai").is("resolution", null);
    if (result.review.checks.length) {
      const { error: checkError } = await supabase.from("ai_review_checks").insert(result.review.checks.map((check) => ({
        organization_id: organizationId,
        job_id: jobId,
        ai_run_id: run.id,
        check_type: check.checkType,
        title: check.title,
        detail: check.detail,
        severity: check.severity,
        source_type: "ai",
        source_ref: run.id,
        evidence: {
          confidence: check.confidence,
          recommendation: check.recommendation,
          rationale: check.rationale,
          source_refs: check.sourceRefs,
          related_estimate_item_ids: check.relatedEstimateItemIds,
        },
      })));
      if (checkError) throw new Error(`Unable to save smart review checks: ${checkError.code}`);
    }

    await Promise.all([
      supabase.from("ai_analysis_runs").update({
        status: "completed",
        structured_output: result.review,
        raw_response: { response_id: result.responseId },
        input_tokens: result.usage.inputTokens,
        cached_input_tokens: result.usage.cachedInputTokens,
        output_tokens: result.usage.outputTokens,
        latency_ms: Date.now() - started,
        completed_at: new Date().toISOString(),
      }).eq("organization_id", organizationId).eq("id", run.id),
      supabase.from("jobs").update({ status: "ai_review" }).eq("organization_id", organizationId).eq("id", jobId),
      supabase.from("activity_events").insert({
        organization_id: organizationId,
        job_id: jobId,
        actor_user_id: userId,
        event_type: "ai_estimate_review_completed",
        title: "Smart estimate review completed",
        details: { ai_run_id: run.id, checks: result.review.checks.length },
      }),
    ]);

    revalidatePath(`/jobs/${jobId}/ai-review`);
    revalidatePath(`/jobs/${jobId}/ai-review/second-pass`);
    redirect(`/jobs/${jobId}/ai-review/second-pass?message=Smart%20second-pass%20review%20completed.%20Every%20suggestion%20still%20requires%20an%20estimator%20decision`);
  } catch (error) {
    console.error("Smart estimate review failed", error instanceof Error ? error.message : "unknown");
    await supabase.from("ai_analysis_runs").update({
      status: "failed",
      error_code: error instanceof Error ? error.message.slice(0, 250) : "unknown_error",
      latency_ms: Date.now() - started,
      completed_at: new Date().toISOString(),
    }).eq("organization_id", organizationId).eq("id", run.id);
    redirect(`/jobs/${jobId}/ai-review/second-pass?error=Smart%20review%20failed.%20The%20estimate%20was%20not%20changed`);
  }
}
