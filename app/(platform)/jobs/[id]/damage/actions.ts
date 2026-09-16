"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { analyzeVehicleDamage } from "@/lib/ai/tasks/damage-analysis";
import { generateAndPersistAiEstimate } from "@/lib/estimating/ai-estimate";
import { meterJobAiUsage } from "@/lib/billing/usage";

const supportedAiImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function runDamageAnalysis(jobId: string) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const model = process.env.AI_DAMAGE_MODEL?.trim();

  if (!process.env.OPENAI_API_KEY || !model) {
    redirect(`/jobs/${jobId}/damage?error=OpenAI%20is%20not%20configured%20yet.%20Add%20the%20API%20key%20and%20damage%20model%20securely%20in%20the%20deployment%20environment`);
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) redirect("/jobs");

  const [vehicleResult, claimResult, photosResult] = await Promise.all([
    job.vehicle_id
      ? supabase.from("vehicles").select("registration, vin, make, model, variant, model_year, body_type, fuel_type, is_ev, is_hybrid, adas_present").eq("id", job.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("claims").select("accident_description").eq("organization_id", organizationId).eq("job_id", jobId).maybeSingle(),
    supabase.from("photos").select("id, category, file_name, mime_type, storage_path_original").eq("organization_id", organizationId).eq("job_id", jobId).order("sort_order").order("created_at").limit(20),
  ]);

  const photos = (photosResult.data ?? []).filter((photo) => supportedAiImageTypes.has(photo.mime_type));
  if (!photos.length) {
    redirect(`/jobs/${jobId}/damage?error=Upload%20at%20least%20one%20JPG,%20PNG%20or%20WebP%20evidence%20photo%20before%20running%20AI`);
  }

  const signed = await Promise.all(photos.map(async (photo) => {
    const { data, error } = await supabase.storage.from("job-files").createSignedUrl(photo.storage_path_original, 60 * 20);
    if (error || !data?.signedUrl) return null;
    return { id: photo.id, signedUrl: data.signedUrl, category: photo.category, fileName: photo.file_name };
  }));
  const aiPhotos = signed.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo));
  if (!aiPhotos.length) redirect(`/jobs/${jobId}/damage?error=Unable%20to%20prepare%20private%20photo%20access%20for%20AI`);

  const { data: run, error: runError } = await supabase.from("ai_analysis_runs").insert({
    organization_id: organizationId,
    job_id: jobId,
    task: "damage_analysis",
    provider: "openai",
    model,
    status: "running",
    input_metadata: { photo_ids: aiPhotos.map((photo) => photo.id), photo_count: aiPhotos.length },
    created_by: userId,
  }).select("id").single();

  if (runError || !run) redirect(`/jobs/${jobId}/damage?error=Unable%20to%20start%20the%20AI%20analysis%20record`);

  const started = Date.now();
  let destination = `/jobs/${jobId}/damage?message=AI%20damage%20analysis%20completed,%20but%20the%20full%20estimate%20could%20not%20be%20generated.%20Check%20the%20AI%20estimate%20configuration%20and%20try%20again`;

  try {
    const vehicle = vehicleResult.data;
    const result = await analyzeVehicleDamage({
      model,
      vehicle: {
        registration: vehicle?.registration,
        vin: vehicle?.vin,
        make: vehicle?.make,
        model: vehicle?.model,
        variant: vehicle?.variant,
        modelYear: vehicle?.model_year,
        bodyType: vehicle?.body_type,
        fuelType: vehicle?.fuel_type,
        isEv: vehicle?.is_ev,
        isHybrid: vehicle?.is_hybrid,
        adasPresent: vehicle?.adas_present,
        accidentDescription: claimResult.data?.accident_description,
      },
      photos: aiPhotos,
    });

    const { data: findingRows, error: findingError } = await supabase.from("damage_findings").insert(result.analysis.findings.map((finding) => ({
      organization_id: organizationId,
      job_id: jobId,
      ai_run_id: run.id,
      impact_area: result.analysis.impactArea,
      component: finding.component,
      side: finding.side,
      observed_damage: finding.observedDamage,
      suggested_action: finding.suggestedAction,
      confidence: finding.confidence,
      is_hidden_damage_claim: false,
      review_status: "pending",
    }))).select("id");

    if (findingError || !findingRows) throw new Error(`Unable to save damage findings: ${findingError?.code ?? "unknown"}`);

    const evidenceRows = findingRows.flatMap((row, index) => (result.analysis.findings[index]?.evidencePhotoIds ?? []).map((photoId) => ({
      organization_id: organizationId,
      finding_id: row.id,
      photo_id: photoId,
      note: result.analysis.findings[index]?.inspectionNote ?? null,
    })));
    if (evidenceRows.length) {
      const { error: evidenceError } = await supabase.from("damage_evidence").insert(evidenceRows);
      if (evidenceError) throw new Error(`Unable to save damage evidence: ${evidenceError.code}`);
    }

    let generatedEstimate: { itemCount: number; estimateId: string } | null = null;
    let estimateGenerationError: string | null = null;
    try {
      generatedEstimate = await generateAndPersistAiEstimate(jobId, result.analysis);
    } catch (estimateError) {
      estimateGenerationError = estimateError instanceof Error ? estimateError.message : "unknown_error";
      console.error("AI full estimate generation failed", estimateGenerationError);
    }

    await Promise.all([
      supabase.from("ai_analysis_runs").update({
        status: "completed",
        structured_output: result.analysis,
        raw_response: { response_id: result.responseId },
        input_tokens: result.usage.inputTokens,
        cached_input_tokens: result.usage.cachedInputTokens,
        output_tokens: result.usage.outputTokens,
        latency_ms: Date.now() - started,
        completed_at: new Date().toISOString(),
      }).eq("organization_id", organizationId).eq("id", run.id),
      supabase.from("jobs").update({ status: "estimating" }).eq("organization_id", organizationId).eq("id", jobId),
      supabase.from("activity_events").insert({
        organization_id: organizationId,
        job_id: jobId,
        actor_user_id: userId,
        event_type: "ai_damage_analysis_completed",
        title: generatedEstimate ? "AI damage analysis and full estimate completed" : "AI damage analysis completed",
        details: {
          ai_run_id: run.id,
          findings: findingRows.length,
          photo_count: aiPhotos.length,
          model,
          estimate_items: generatedEstimate?.itemCount ?? 0,
          estimate_generation_error: estimateGenerationError,
        },
      }),
    ]);

    if (generatedEstimate) {
      try {
        await meterJobAiUsage({ supabase, organizationId, jobId, estimateId: generatedEstimate.estimateId });
      } catch (meteringError) {
        console.error("AI usage metering failed", meteringError instanceof Error ? meteringError.message : "unknown error");
      }
    }

    revalidatePath(`/jobs/${jobId}/damage`);
    revalidatePath(`/jobs/${jobId}/estimate`);
    revalidatePath(`/jobs/${jobId}`);

    if (generatedEstimate) {
      destination = `/jobs/${jobId}/estimate?message=AI%20analysed%20the%20photos%20and%20created%20${generatedEstimate.itemCount}%20preliminary%20estimate%20lines.%20Review%20and%20edit%20every%20line%20before%20approval`;
    }
  } catch (error) {
    console.error("OpenAI damage analysis failed", error instanceof Error ? error.message : "unknown");
    await supabase.from("ai_analysis_runs").update({
      status: "failed",
      error_code: error instanceof Error ? error.message.slice(0, 250) : "unknown_error",
      latency_ms: Date.now() - started,
      completed_at: new Date().toISOString(),
    }).eq("organization_id", organizationId).eq("id", run.id);
    redirect(`/jobs/${jobId}/damage?error=AI%20analysis%20failed.%20The%20photos%20and%20estimate%20were%20not%20changed`);
  }

  redirect(destination);
}

export async function reviewDamageFinding(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const findingId = String(formData.get("finding_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!findingId || !["accepted", "rejected"].includes(decision)) return;

  const { data: finding } = await supabase
    .from("damage_findings")
    .select("id, component, side, observed_damage, suggested_action, confidence, review_status")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("id", findingId)
    .maybeSingle();
  if (!finding) return;

  const { error } = await supabase.from("damage_findings").update({
    review_status: decision,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq("organization_id", organizationId).eq("id", findingId);
  if (error) redirect(`/jobs/${jobId}/damage?error=Unable%20to%20save%20that%20damage%20review%20decision`);

  await supabase.from("learning_events").insert({
    organization_id: organizationId,
    user_id: userId,
    job_id: jobId,
    event_type: decision === "accepted" ? "ai_accepted" : "ai_rejected",
    entity_type: "damage_finding",
    entity_id: finding.id,
    before_data: { review_status: finding.review_status },
    after_data: { review_status: decision },
    context: {
      component: finding.component,
      side: finding.side,
      observed_damage: finding.observed_damage,
      suggested_action: finding.suggested_action,
      confidence: finding.confidence,
    },
  });

  revalidatePath(`/jobs/${jobId}/damage`);
}
