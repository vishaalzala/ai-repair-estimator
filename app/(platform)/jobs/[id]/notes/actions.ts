"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

const noteTypes = new Set(["repair", "general", "insurer", "technician", "parts", "supplement", "internal", "ai"]);
const visibilities = new Set(["internal", "insurer_pdf", "technician_sheet", "customer_output"]);

export async function addJobNote(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const noteType = String(formData.get("note_type") ?? "general");
  const visibility = String(formData.get("visibility") ?? "internal");
  const content = String(formData.get("content") ?? "").trim();
  if (!content || !noteTypes.has(noteType) || !visibilities.has(visibility)) {
    redirect(`/jobs/${jobId}/notes?error=Enter%20a%20valid%20note`);
  }

  const { data: job } = await supabase.from("jobs").select("id").eq("organization_id", organizationId).eq("id", jobId).maybeSingle();
  if (!job) redirect("/jobs");

  const { error } = await supabase.from("job_notes").insert({
    organization_id: organizationId,
    job_id: jobId,
    note_type: noteType,
    visibility,
    content,
    created_by: userId,
  });
  if (error) {
    console.error("Job note insert failed", error.code);
    redirect(`/jobs/${jobId}/notes?error=Unable%20to%20save%20the%20note`);
  }
  await supabase.from("activity_events").insert({ organization_id: organizationId, job_id: jobId, actor_user_id: userId, event_type: "job_note_added", title: "Job note added", details: { note_type: noteType, visibility } });
  revalidatePath(`/jobs/${jobId}/notes`);
}

export async function deleteJobNote(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  const noteId = String(formData.get("note_id") ?? "");
  if (!noteId) return;
  const { data: note } = await supabase.from("job_notes").select("id, created_by").eq("organization_id", organizationId).eq("job_id", jobId).eq("id", noteId).maybeSingle();
  if (!note) return;
  if (note.created_by !== userId && !["owner", "admin", "manager"].includes(role)) return;
  await supabase.from("job_notes").delete().eq("organization_id", organizationId).eq("id", noteId);
  revalidatePath(`/jobs/${jobId}/notes`);
}
