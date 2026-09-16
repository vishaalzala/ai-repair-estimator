import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw).toISOString() : null;

  let runQuery = supabase
    .from("ai_analysis_runs")
    .select("id, task, status, error_code, created_at, completed_at")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .in("task", ["vehicle_intake", "estimate_generation"])
    .order("created_at", { ascending: false })
    .limit(12);
  if (since) runQuery = runQuery.gte("created_at", since);

  let eventQuery = supabase
    .from("activity_events")
    .select("event_type, title, details, created_at")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .in("event_type", ["ai_estimate_pipeline_started", "ai_estimate_pipeline_completed", "ai_estimate_pipeline_failed"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (since) eventQuery = eventQuery.gte("created_at", since);

  const [{ data: runs }, { data: events }] = await Promise.all([runQuery, eventQuery]);
  const runList = runs ?? [];
  const eventList = events ?? [];
  const estimateRun = runList.find((run) => run.task === "estimate_generation");
  const intakeRun = runList.find((run) => run.task === "vehicle_intake");
  const failedEvent = eventList.find((event) => event.event_type === "ai_estimate_pipeline_failed");
  const completedEvent = eventList.find((event) => event.event_type === "ai_estimate_pipeline_completed");

  if (estimateRun?.status === "completed" || completedEvent) {
    const { data: estimate } = await supabase
      .from("estimates")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("job_id", jobId)
      .eq("estimate_type", "primary")
      .maybeSingle();
    let itemCount = 0;
    if (estimate) {
      const { count } = await supabase
        .from("estimate_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("estimate_id", estimate.id);
      itemCount = count ?? 0;
    }
    return NextResponse.json({
      status: "completed",
      stage: "completed",
      message: `Estimate ready${itemCount ? ` with ${itemCount} line${itemCount === 1 ? "" : "s"}` : ""}.`,
      itemCount,
    });
  }

  if (estimateRun?.status === "failed") {
    return NextResponse.json({
      status: "failed",
      stage: "estimate",
      message: "The AI could not finish the full estimate. The assessment and photos are still saved.",
      error: estimateRun.error_code,
    });
  }

  if (failedEvent) {
    const details = failedEvent.details as { error?: string } | null;
    return NextResponse.json({
      status: "failed",
      stage: "pipeline",
      message: "The AI estimate stopped before completion. The assessment and photos are still saved.",
      error: details?.error ?? null,
    });
  }

  if (estimateRun?.status === "running") {
    return NextResponse.json({
      status: "preparing",
      stage: "estimate",
      message: "Building the line-by-line estimate and applying workshop rates…",
    });
  }

  if (intakeRun?.status === "failed") {
    return NextResponse.json({
      status: "failed",
      stage: "photos",
      message: "The AI could not finish reading the vehicle photos. The uploaded photos are still saved.",
      error: intakeRun.error_code,
    });
  }

  if (intakeRun?.status === "completed") {
    return NextResponse.json({
      status: "preparing",
      stage: "estimate",
      message: "Photo analysis is complete. Preparing the full estimate…",
    });
  }

  if (intakeRun?.status === "running") {
    return NextResponse.json({
      status: "preparing",
      stage: "photos",
      message: "Reading the vehicle, damage photos and your notes…",
    });
  }

  return NextResponse.json({
    status: "preparing",
    stage: "queued",
    message: "Starting the AI estimate in the background…",
  });
}
