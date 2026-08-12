import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeVehicleIntake } from "@/lib/ai/tasks/vehicle-intake";

export const runtime = "nodejs";
export const maxDuration = 300;

const supportedAiImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function empty(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ message: "Active workshop access is required." }, { status: 403 });

  const organizationId = membership.organization_id;
  const { data: job } = await supabase
    .from("jobs")
    .select("id, vehicle_id, status")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ message: "Assessment not found." }, { status: 404 });

  const [vehicleResult, claimResult, photoResult, existingEstimateResult] = await Promise.all([
    job.vehicle_id
      ? supabase.from("vehicles").select("id, registration, vin, make, model, variant, model_year, colour, paint_code, odometer_km, body_type, fuel_type, is_ev, is_hybrid, adas_present").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("claims").select("accident_description").eq("organization_id", organizationId).eq("job_id", jobId).maybeSingle(),
    supabase.from("photos").select("id, category, file_name, mime_type, storage_path_original").eq("organization_id", organizationId).eq("job_id", jobId).order("sort_order").order("created_at").limit(20),
    supabase.from("estimates").select("id, rate_card_id, tax_rate").eq("organization_id", organizationId).eq("job_id", jobId).eq("estimate_type", "primary").maybeSingle(),
  ]);

  let estimate = existingEstimateResult.data;
  if (!estimate) {
    const [{ data: rateCard }, { data: settings }] = await Promise.all([
      supabase.from("rate_cards").select("id").eq("organization_id", organizationId).eq("is_default", true).eq("is_active", true).maybeSingle(),
      supabase.from("workshop_settings").select("gst_rate, default_currency").eq("organization_id", organizationId).maybeSingle(),
    ]);

    const { data: created, error: estimateError } = await supabase
      .from("estimates")
      .insert({
        organization_id: organizationId,
        job_id: jobId,
        rate_card_id: rateCard?.id ?? null,
        estimate_type: "primary",
        status: "draft",
        currency: settings?.default_currency ?? "NZD",
        tax_rate: settings?.gst_rate ?? 15,
        created_by: auth.user.id,
      })
      .select("id, rate_card_id, tax_rate")
      .maybeSingle();

    if (estimateError || !created) {
      const { data: raced } = await supabase
        .from("estimates")
        .select("id, rate_card_id, tax_rate")
        .eq("organization_id", organizationId)
        .eq("job_id", jobId)
        .eq("estimate_type", "primary")
        .maybeSingle();
      if (!raced) return NextResponse.json({ message: "The assessment is saved, but the draft estimate could not be started." }, { status: 500 });
      estimate = raced;
    } else {
      estimate = created;
    }
  }

  await supabase.from("jobs").update({ status: "estimating" }).eq("organization_id", organizationId).eq("id", jobId);

  const model = process.env.AI_INTAKE_MODEL?.trim() || process.env.AI_DAMAGE_MODEL?.trim();
  if (!process.env.OPENAI_API_KEY || !model) {
    return NextResponse.json({
      message: "Draft estimate started and photos saved. Configure OpenAI and AI_INTAKE_MODEL (or AI_DAMAGE_MODEL) to auto-read the vehicle and prepare repair operations.",
      jobId,
      estimateId: estimate.id,
    }, { status: 202 });
  }

  const compatiblePhotos = (photoResult.data ?? []).filter((photo) => supportedAiImageTypes.has(photo.mime_type));
  if (!compatiblePhotos.length) {
    return NextResponse.json({
      message: "Draft estimate started. The uploaded originals are saved, but AI currently needs at least one JPG, PNG or WebP image for visual intake.",
      jobId,
      estimateId: estimate.id,
    }, { status: 202 });
  }

  const signed = await Promise.all(compatiblePhotos.map(async (photo) => {
    const { data, error } = await supabase.storage.from("job-files").createSignedUrl(photo.storage_path_original, 60 * 20);
    if (error || !data?.signedUrl) return null;
    return { id: photo.id, signedUrl: data.signedUrl, category: photo.category, fileName: photo.file_name };
  }));
  const aiPhotos = signed.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo));
  if (!aiPhotos.length) {
    return NextResponse.json({ message: "Draft estimate started, but private photo access could not be prepared for AI." }, { status: 202 });
  }

  const { data: run, error: runError } = await supabase.from("ai_analysis_runs").insert({
    organization_id: organizationId,
    job_id: jobId,
    task: "vehicle_intake",
    provider: "openai",
    model,
    status: "running",
    input_metadata: { photo_ids: aiPhotos.map((photo) => photo.id), photo_count: aiPhotos.length, workflow: "quick_intake" },
    created_by: auth.user.id,
  }).select("id").maybeSingle();

  if (runError || !run) {
    return NextResponse.json({ message: "Draft estimate started, but the AI intake run could not be recorded. Apply the latest database migration and retry." }, { status: 500 });
  }

  const started = Date.now();
  try {
    const vehicle = vehicleResult.data;
    const result = await analyzeVehicleIntake({
      model,
      hints: {
        registration: vehicle?.registration,
        vin: vehicle?.vin,
        make: vehicle?.make,
        model: vehicle?.model,
        variant: vehicle?.variant,
        modelYear: vehicle?.model_year,
        accidentDescription: claimResult.data?.accident_description,
      },
      photos: aiPhotos,
    });

    if (vehicle) {
      const proposed = result.analysis.vehicle;
      const confidence = result.analysis.confidence;
      const patch: Record<string, string | number | boolean | null> = {};
      const setString = (column: string, current: unknown, next: string | null, score: number, threshold: number, transform?: (value: string) => string) => {
        if (empty(current) && next?.trim() && score >= threshold) patch[column] = transform ? transform(next.trim()) : next.trim();
      };
      const setNumber = (column: string, current: unknown, next: number | null, score: number, threshold: number) => {
        if (empty(current) && next !== null && score >= threshold) patch[column] = next;
      };

      setString("registration", vehicle.registration, proposed.registration, confidence.registration, 0.9, (value) => value.toUpperCase());
      setString("vin", vehicle.vin, proposed.vin, confidence.vin, 0.9, (value) => value.toUpperCase());
      setString("make", vehicle.make, proposed.make, confidence.make, 0.72);
      setString("model", vehicle.model, proposed.model, confidence.model, 0.72);
      setString("variant", vehicle.variant, proposed.variant, confidence.variant, 0.78);
      setNumber("model_year", vehicle.model_year, proposed.modelYear, confidence.modelYear, 0.78);
      setString("colour", vehicle.colour, proposed.colour, confidence.colour, 0.75);
      setString("paint_code", vehicle.paint_code, proposed.paintCode, confidence.paintCode, 0.9, (value) => value.toUpperCase());
      setNumber("odometer_km", vehicle.odometer_km, proposed.odometerKm, confidence.odometerKm, 0.9);
      setString("body_type", vehicle.body_type, proposed.bodyType, confidence.bodyType, 0.75);
      setString("fuel_type", vehicle.fuel_type, proposed.fuelType, confidence.fuelType, 0.78);
      if (vehicle.is_ev === false && proposed.isEv === true && confidence.isEv >= 0.9) patch.is_ev = true;
      if (vehicle.is_hybrid === false && proposed.isHybrid === true && confidence.isHybrid >= 0.9) patch.is_hybrid = true;
      if (vehicle.adas_present === null && proposed.adasPresent !== null && confidence.adasPresent >= 0.85) patch.adas_present = proposed.adasPresent;

      if (Object.keys(patch).length) {
        await supabase.from("vehicles").update(patch).eq("organization_id", organizationId).eq("id", vehicle.id);
      }
    }

    const validPhotoIds = new Set(aiPhotos.map((photo) => photo.id));
    await Promise.all(result.analysis.photoClassifications
      .filter((classification) => classification.confidence >= 0.85 && validPhotoIds.has(classification.photoId))
      .map((classification) => supabase.from("photos").update({ category: classification.category }).eq("organization_id", organizationId).eq("job_id", jobId).eq("id", classification.photoId)));

    let findingCount = 0;
    if (result.analysis.visibleDamage.length) {
      const { data: findingRows, error: findingError } = await supabase.from("damage_findings").insert(result.analysis.visibleDamage.map((finding) => ({
        organization_id: organizationId,
        job_id: jobId,
        ai_run_id: run.id,
        impact_area: null,
        component: finding.component,
        side: finding.side,
        observed_damage: finding.observedDamage,
        suggested_action: finding.suggestedAction,
        confidence: finding.confidence,
        is_hidden_damage_claim: false,
        review_status: "pending",
      }))).select("id");

      if (findingError || !findingRows) throw new Error(`Unable to save quick-intake damage findings: ${findingError?.code ?? "unknown"}`);
      findingCount = findingRows.length;
      const evidenceRows = findingRows.flatMap((row, index) => (result.analysis.visibleDamage[index]?.evidencePhotoIds ?? []).map((photoId) => ({
        organization_id: organizationId,
        finding_id: row.id,
        photo_id: photoId,
        note: "AI Quick Intake visible-evidence link",
      })));
      if (evidenceRows.length) {
        const { error: evidenceError } = await supabase.from("damage_evidence").insert(evidenceRows);
        if (evidenceError) throw new Error(`Unable to save quick-intake evidence: ${evidenceError.code}`);
      }
    }

    const { data: categories } = await supabase
      .from("estimate_categories")
      .select("id, code")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    const categoryByCode = new Map((categories ?? []).map((category) => [category.code, category.id]));

    await supabase.from("estimate_items")
      .delete()
      .eq("organization_id", organizationId)
      .eq("estimate_id", estimate.id)
      .eq("source_type", "ai")
      .like("source_ref", "quick_intake:%")
      .eq("human_verified", false);

    const operationRows = result.analysis.suggestedOperations.flatMap((operation, index) => {
      const categoryId = categoryByCode.get(operation.categoryCode);
      if (!categoryId) return [];
      return [{
        organization_id: organizationId,
        estimate_id: estimate.id,
        category_id: categoryId,
        component: operation.component,
        side: operation.side,
        description: operation.description,
        quantity: 1,
        labour_hours: 0,
        labour_rate: 0,
        fixed_amount: 0,
        part_cost: 0,
        markup_percent: 0,
        freight_amount: 0,
        adjustment_amount: 0,
        line_total_ex_tax: 0,
        source_type: "ai",
        source_ref: `quick_intake:${run.id}`,
        ai_confidence: operation.confidence,
        human_verified: false,
        notes: `Draft AI suggestion. Evidence: ${operation.evidencePhotoIds.join(", ")}. Confirm operation, time, parts and price before issue.`,
        sort_order: (index + 1) * 10,
        created_by: auth.user.id,
      }];
    });

    if (operationRows.length) {
      const { error: operationError } = await supabase.from("estimate_items").insert(operationRows);
      if (operationError) throw new Error(`Unable to prepare quick-intake estimate lines: ${operationError.code}`);
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
        actor_user_id: auth.user.id,
        event_type: "ai_quick_intake_completed",
        title: "AI Quick Intake prepared draft estimate",
        details: { ai_run_id: run.id, photos: aiPhotos.length, findings: findingCount, draft_operations: operationRows.length, model },
      }),
    ]);

    return NextResponse.json({
      message: `AI Quick Intake complete: ${findingCount} visible finding${findingCount === 1 ? "" : "s"} and ${operationRows.length} draft estimate line${operationRows.length === 1 ? "" : "s"} prepared for review.`,
      jobId,
      estimateId: estimate.id,
      findings: findingCount,
      operations: operationRows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI Quick Intake failed";
    console.error("AI Quick Intake failed", message);
    await supabase.from("ai_analysis_runs").update({
      status: "failed",
      error_code: message.slice(0, 250),
      latency_ms: Date.now() - started,
      completed_at: new Date().toISOString(),
    }).eq("organization_id", organizationId).eq("id", run.id);

    return NextResponse.json({
      message: "The assessment, photos and draft estimate are saved, but AI intake could not finish. You can continue manually and retry AI later.",
      jobId,
      estimateId: estimate.id,
    }, { status: 500 });
  }
}
