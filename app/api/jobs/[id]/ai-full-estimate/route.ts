import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VehicleIntakeSchema } from "@/lib/ai/tasks/vehicle-intake";
import type { DamageAnalysis } from "@/lib/ai/tasks/damage-analysis";
import { generateAndPersistAiEstimate } from "@/lib/estimating/ai-estimate";
import { syncAutomaticEstimateCharges } from "@/lib/estimating/automatic-charges";
import { syncAutomaticParkingFee } from "@/lib/estimating/parking-fees";
import { meterJobAiUsage } from "@/lib/billing/usage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ message: "Active workshop access is required." }, { status: 403 });

  const organizationId = membership.organization_id;
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ message: "Assessment not found." }, { status: 404 });

  const { data: intakeRun } = await supabase
    .from("ai_analysis_runs")
    .select("id, structured_output")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .eq("task", "vehicle_intake")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!intakeRun?.structured_output) {
    return NextResponse.json({ message: "AI Quick Intake must finish before the full estimate can be generated." }, { status: 409 });
  }

  try {
    const intake = VehicleIntakeSchema.parse(intakeRun.structured_output);
    const confidenceValues = [
      intake.confidence.registration,
      intake.confidence.make,
      intake.confidence.model,
      intake.confidence.variant,
      intake.confidence.colour,
      intake.confidence.bodyType,
    ];
    const identityConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0;

    const intakeOperationContext = intake.suggestedOperations.map((operation) =>
      `Photo-intake operation to consider: ${operation.categoryCode} | ${[operation.side, operation.component].filter(Boolean).join(" ") || "general"} | ${operation.description} | confidence ${operation.confidence}`,
    );

    const damageAnalysis: DamageAnalysis = {
      impactArea: "AI Quick Intake visible-damage assessment",
      severity: "unknown",
      summary: intake.summary,
      vehicleIdentification: {
        registration: intake.vehicle.registration,
        make: intake.vehicle.make,
        model: intake.vehicle.model,
        variant: intake.vehicle.variant,
        modelYear: intake.vehicle.modelYear,
        bodyType: intake.vehicle.bodyType,
        colour: intake.vehicle.colour,
        confidence: identityConfidence,
        evidenceNote: "Vehicle identity derived from the AI Quick Intake photo pass and user-supplied hints.",
      },
      findings: intake.visibleDamage.map((finding) => ({
        component: finding.component,
        side: finding.side,
        observedDamage: finding.observedDamage,
        suggestedAction: finding.suggestedAction,
        confidence: finding.confidence,
        evidencePhotoIds: finding.evidencePhotoIds,
        inspectionNote: null,
      })),
      inspectionSuggestions: [...intake.warnings, ...intakeOperationContext].slice(0, 30),
    };

    const estimate = await generateAndPersistAiEstimate(jobId, damageAnalysis);
    await syncAutomaticParkingFee(jobId);
    await syncAutomaticEstimateCharges(jobId);
    const metering = await meterJobAiUsage({
      supabase,
      organizationId,
      jobId,
      estimateId: estimate.estimateId,
    });

    return NextResponse.json({
      message: `Full AI estimate created with ${estimate.itemCount} priced/reviewable line${estimate.itemCount === 1 ? "" : "s"}.`,
      itemCount: estimate.itemCount,
      estimateId: estimate.estimateId,
      summary: estimate.summary,
      aiUsageChargeNzd: metering?.customerChargeNzd ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the full AI estimate";
    console.error("AI Quick Intake full estimate failed", message);
    return NextResponse.json({
      message: "The assessment and photo analysis are saved, but the full priced estimate could not be generated. You can retry from Damage review.",
      detail: message.slice(0, 250),
    }, { status: 500 });
  }
}
