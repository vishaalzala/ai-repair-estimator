"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { evaluateRules, type RuleAction, type RuleCondition, type RuleForEvaluation } from "@/lib/rules/evaluator";

export async function runRulesReview(jobId: string) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, repair_type, repair_size, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) redirect("/jobs");

  const [vehicleResult, claimResult, estimateResult, damageResult, partsRequestResult, globalRulesResult, orgRulesResult] = await Promise.all([
    job.vehicle_id
      ? supabase.from("vehicles").select("adas_present, make, model, model_year, body_type, fuel_type").eq("id", job.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("claims").select("accident_description, accident_location").eq("job_id", job.id).maybeSingle(),
    supabase.from("estimates").select("id").eq("organization_id", organizationId).eq("job_id", job.id).eq("estimate_type", "primary").maybeSingle(),
    supabase.from("damage_findings").select("component, side, observed_damage, suggested_action, review_status").eq("organization_id", organizationId).eq("job_id", job.id),
    supabase.from("parts_requests").select("id").eq("organization_id", organizationId).eq("job_id", job.id).neq("status", "cancelled"),
    supabase.from("rules").select("id, code, name, enforcement_level, current_version_id").eq("scope", "global").eq("status", "active"),
    supabase.from("rules").select("id, code, name, enforcement_level, current_version_id").eq("scope", "organization").eq("organization_id", organizationId).eq("status", "active"),
  ]);

  const estimate = estimateResult.data;
  const estimateItemsResult = estimate
    ? await supabase.from("estimate_items").select("component, side, operation_code, description, source_type").eq("organization_id", organizationId).eq("estimate_id", estimate.id)
    : { data: [] };
  const partsRequestIds = (partsRequestResult.data ?? []).map((row) => row.id);
  const partsItemsResult = partsRequestIds.length
    ? await supabase.from("parts_request_items").select("description, component, side, status, part_type").eq("organization_id", organizationId).in("parts_request_id", partsRequestIds)
    : { data: [] };

  const rules = [...(globalRulesResult.data ?? []), ...(orgRulesResult.data ?? [])].filter((rule) => rule.current_version_id);
  const versionIds = rules.map((rule) => rule.current_version_id).filter((value): value is string => Boolean(value));
  const versionsResult = versionIds.length
    ? await supabase.from("rule_versions").select("id, conditions, actions").in("id", versionIds)
    : { data: [] };
  const versionById = new Map((versionsResult.data ?? []).map((version) => [version.id, version]));

  const evaluatable: RuleForEvaluation[] = rules.flatMap((rule) => {
    const version = rule.current_version_id ? versionById.get(rule.current_version_id) : undefined;
    if (!version) return [];
    return [{
      id: rule.id,
      code: rule.code,
      name: rule.name,
      enforcement_level: rule.enforcement_level,
      conditions: version.conditions as RuleCondition,
      actions: version.actions as RuleAction[],
    }];
  });

  const estimateItems = estimateItemsResult.data ?? [];
  const damageFindings = damageResult.data ?? [];
  const partsItems = partsItemsResult.data ?? [];
  const claimText = [claimResult.data?.accident_description, claimResult.data?.accident_location].filter(Boolean).join(" ");
  const estimateText = estimateItems.map((item) => [item.side, item.component, item.operation_code, item.description].filter(Boolean).join(" ")).join(" ");
  const damageText = damageFindings.map((finding) => [finding.side, finding.component, finding.observed_damage, finding.suggested_action].filter(Boolean).join(" ")).join(" ");
  const partsText = partsItems.map((item) => [item.side, item.component, item.description, item.part_type, item.status].filter(Boolean).join(" ")).join(" ");

  const checks = evaluateRules(evaluatable, {
    vehicle: vehicleResult.data ?? {},
    job: { repair_type: job.repair_type, repair_size: job.repair_size },
    claim_text: claimText,
    estimate_text: estimateText,
    damage_text: damageText,
    parts_text: partsText,
    combined_text: [claimText, estimateText, damageText, partsText].join(" "),
    parts_statuses: partsItems.map((item) => item.status),
  });

  await supabase
    .from("ai_review_checks")
    .delete()
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("source_type", "rule")
    .is("resolution", null);

  if (checks.length) {
    const { error } = await supabase.from("ai_review_checks").insert(checks.map((check) => ({
      organization_id: organizationId,
      job_id: jobId,
      check_type: check.check_type,
      title: check.title,
      detail: check.detail ?? null,
      severity: check.severity,
      source_type: "rule",
      source_ref: check.ruleId,
      evidence: [{ rule_code: check.ruleCode, rule_name: check.ruleName, enforcement: check.enforcementLevel }],
    })));
    if (error) {
      console.error("Rule review insert failed", error.code);
      redirect(`/jobs/${jobId}/ai-review?error=Unable%20to%20save%20the%20rules%20review`);
    }
  }

  if (estimate) {
    await supabase.from("jobs").update({ status: "ai_review" }).eq("organization_id", organizationId).eq("id", jobId);
  }
  await supabase.from("activity_events").insert({
    organization_id: organizationId,
    job_id: jobId,
    actor_user_id: userId,
    event_type: "rules_review_completed",
    title: "Rules review completed",
    details: { matched_checks: checks.length },
  });

  revalidatePath(`/jobs/${jobId}/ai-review`);
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}/ai-review?message=Repair%20rules%20review%20completed`);
}

export async function resolveReviewCheck(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const checkId = String(formData.get("check_id") ?? "");
  const resolution = String(formData.get("resolution") ?? "");
  const allowed = new Set(["added", "edited", "not_required", "already_included", "acknowledged"]);
  if (!checkId || !allowed.has(resolution)) return;

  const { error } = await supabase
    .from("ai_review_checks")
    .update({ resolution, resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("id", checkId);
  if (error) {
    redirect(`/jobs/${jobId}/ai-review?error=Unable%20to%20save%20that%20review%20decision`);
  }

  revalidatePath(`/jobs/${jobId}/ai-review`);
}
