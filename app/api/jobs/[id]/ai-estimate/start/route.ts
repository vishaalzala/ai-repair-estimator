import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { count: photoCount } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("job_id", jobId);
  if (!photoCount) return NextResponse.json({ message: "Upload at least one vehicle photo first." }, { status: 400 });

  const startedAt = new Date().toISOString();
  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") ?? "";

  await supabase.from("activity_events").insert({
    organization_id: organizationId,
    job_id: jobId,
    actor_user_id: auth.user.id,
    event_type: "ai_estimate_pipeline_started",
    title: "AI estimate preparation started",
    details: { started_at: startedAt, photo_count: photoCount },
  });

  after(async () => {
    try {
      const headers = {
        cookie,
        "content-type": "application/json",
        "x-ai-full-pipeline": "1",
      };

      const intakeResponse = await fetch(`${origin}/api/jobs/${jobId}/ai-intake`, {
        method: "POST",
        headers,
        body: "{}",
        cache: "no-store",
      });
      const intakeBody = (await intakeResponse.json().catch(() => ({}))) as { message?: string };
      if (!intakeResponse.ok || intakeResponse.status === 202) {
        throw new Error(intakeBody.message ?? `AI intake failed with status ${intakeResponse.status}`);
      }

      const estimateResponse = await fetch(`${origin}/api/jobs/${jobId}/ai-full-estimate`, {
        method: "POST",
        headers,
        body: "{}",
        cache: "no-store",
      });
      const estimateBody = (await estimateResponse.json().catch(() => ({}))) as { message?: string; itemCount?: number };
      if (!estimateResponse.ok) {
        throw new Error(estimateBody.message ?? `Full estimate failed with status ${estimateResponse.status}`);
      }

      await supabase.from("activity_events").insert({
        organization_id: organizationId,
        job_id: jobId,
        actor_user_id: auth.user.id,
        event_type: "ai_estimate_pipeline_completed",
        title: "AI estimate preparation completed",
        details: {
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          item_count: estimateBody.itemCount ?? null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI estimate preparation failed";
      console.error("Background AI estimate pipeline failed", message);
      await supabase.from("activity_events").insert({
        organization_id: organizationId,
        job_id: jobId,
        actor_user_id: auth.user.id,
        event_type: "ai_estimate_pipeline_failed",
        title: "AI estimate preparation failed",
        details: {
          started_at: startedAt,
          failed_at: new Date().toISOString(),
          error: message.slice(0, 500),
        },
      });
    }
  });

  return NextResponse.json({
    status: "preparing",
    startedAt,
    jobId,
    message: "AI estimate preparation has started in the background.",
  }, { status: 202 });
}
