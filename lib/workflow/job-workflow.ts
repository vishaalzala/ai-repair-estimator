import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isJobStatus, type JobStatus } from "./status";

type WorkflowContext = {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
};

export async function updateJobWorkflowStatus(
  context: WorkflowContext,
  jobId: string,
  nextStatusRaw: string,
) {
  if (!isJobStatus(nextStatusRaw)) throw new Error("Invalid job status");
  const nextStatus: JobStatus = nextStatusRaw;
  const { supabase, organizationId, userId } = context;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) throw new Error("Job not found");
  if (job.status === nextStatus) return;

  const { error } = await supabase
    .from("jobs")
    .update({ status: nextStatus })
    .eq("organization_id", organizationId)
    .eq("id", jobId);
  if (error) throw new Error("Unable to update job status");

  await Promise.all([
    supabase.from("job_status_history").insert({
      organization_id: organizationId,
      job_id: jobId,
      from_status: job.status,
      to_status: nextStatus,
      changed_by: userId,
    }),
    supabase.from("activity_events").insert({
      organization_id: organizationId,
      job_id: jobId,
      actor_user_id: userId,
      event_type: "job_status_changed",
      title: `Job status changed to ${nextStatus.replaceAll("_", " ")}`,
      details: { from_status: job.status, to_status: nextStatus, source: "daily_jobs" },
    }),
  ]);

  revalidateDailyJobPaths(jobId);
}

export function revalidateDailyJobPaths(jobId?: string) {
  revalidatePath("/daily-jobs");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/parts");
  revalidatePath("/reports");
  if (jobId) {
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/jobs/${jobId}/parts`);
    revalidatePath(`/jobs/${jobId}/estimate`);
    revalidatePath(`/jobs/${jobId}/ai-review`);
    revalidatePath(`/jobs/${jobId}/history`);
  }
}
