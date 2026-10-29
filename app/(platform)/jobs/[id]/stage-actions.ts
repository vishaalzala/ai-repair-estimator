"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

export const quoteStates = [
  { value:"awaiting_quoting", label:"Awaiting quoting" },
  { value:"quoting_underway", label:"Quoting underway" },
  { value:"quote_complete", label:"Quote complete" },
  { value:"awaiting_authorisation", label:"Awaiting authorisation" },
  { value:"on_hold", label:"On hold / follow up" },
  { value:"authorised", label:"Authorised" },
  { value:"declined", label:"Declined" },
];
export const repairStates = [
  { value:"not_started", label:"Not started" },
  { value:"repair_underway", label:"Repair underway" },
  { value:"awaiting_parts", label:"Awaiting parts" },
  { value:"outwork", label:"Outwork" },
  { value:"quality_check", label:"Quality check" },
  { value:"repair_complete", label:"Repair complete" },
  { value:"delivered", label:"Delivered" },
];

export async function updateJobStages(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  if (!["owner","admin","manager","estimator","reviewer"].includes(role)) redirect(`/jobs/${jobId}?error=Permission%20denied`);
  const quoteStatus = String(formData.get("quote_status") ?? "");
  const repairStatus = String(formData.get("repair_status") ?? "");
  if (!quoteStates.some((s)=>s.value===quoteStatus) || !repairStates.some((s)=>s.value===repairStatus)) {
    redirect(`/jobs/${jobId}?error=Invalid%20progress%20status`);
  }

  const { data: existing } = await supabase.from("jobs").select("id,quote_status,repair_status")
    .eq("organization_id", organizationId).eq("id", jobId).maybeSingle();
  if (!existing) redirect("/jobs");
  if (existing.quote_status === quoteStatus && existing.repair_status === repairStatus) redirect(`/jobs/${jobId}?saved=No%20changes`);

  const { error } = await supabase.from("jobs").update({quote_status:quoteStatus,repair_status:repairStatus})
    .eq("organization_id", organizationId).eq("id", jobId);
  if (error) redirect(`/jobs/${jobId}?error=Unable%20to%20update%20progress`);

  await supabase.from("activity_events").insert({
    organization_id:organizationId,job_id:jobId,actor_user_id:userId,
    event_type:"job_progress_changed",title:"Quotation / repair progress updated",
    details:{quote_before:existing.quote_status,quote_after:quoteStatus,repair_before:existing.repair_status,repair_after:repairStatus},
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/quotes");
  revalidatePath("/jobs");
  redirect(`/jobs/${jobId}?saved=Progress%20updated`);
}
