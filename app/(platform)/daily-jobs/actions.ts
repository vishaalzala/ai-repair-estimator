"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/context";
import { updateJobWorkflowStatus, revalidateDailyJobPaths } from "@/lib/workflow/job-workflow";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableDate(valueRaw: string) {
  const trimmed = valueRaw.trim();
  return trimmed || null;
}

const priorities = new Set(["low", "normal", "high", "urgent"]);
const taskStatuses = new Set(["todo", "in_progress", "waiting", "done", "cancelled"]);
const taskCategories = new Set(["general", "customer", "insurer", "parts", "estimate", "photos", "admin", "workshop", "other"]);
const partsStatuses = new Set(["draft", "requested", "quotes_received", "selected", "ordered", "closed", "cancelled"]);

async function ensureJob(jobId: string) {
  const context = await requireOrganizationContext();
  const { data: job } = await context.supabase
    .from("jobs")
    .select("id, status, assigned_to")
    .eq("organization_id", context.organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!job) throw new Error("Job not found");
  return { ...context, job };
}

export async function updateDailyJobStatus(formData: FormData) {
  const jobId = value(formData, "job_id");
  const status = value(formData, "status");
  const context = await ensureJob(jobId);
  await updateJobWorkflowStatus(context, jobId, status);
}

export async function updateDailyJobAssignment(formData: FormData) {
  const jobId = value(formData, "job_id");
  const assignedTo = value(formData, "assigned_to") || null;
  const { supabase, organizationId } = await ensureJob(jobId);

  if (assignedTo) {
    const { data: member } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", assignedTo)
      .eq("status", "active")
      .maybeSingle();
    if (!member) throw new Error("Invalid workshop member");
  }

  const { error } = await supabase
    .from("jobs")
    .update({ assigned_to: assignedTo })
    .eq("organization_id", organizationId)
    .eq("id", jobId);
  if (error) throw new Error("Unable to update assignment");
  revalidateDailyJobPaths(jobId);
}

export async function updateDailyJobSchedule(formData: FormData) {
  const jobId = value(formData, "job_id");
  const scheduledDate = nullableDate(value(formData, "scheduled_date"));
  const priority = value(formData, "priority") || "normal";
  if (!priorities.has(priority)) throw new Error("Invalid priority");

  const { supabase, organizationId, userId } = await ensureJob(jobId);
  const { error } = await supabase.from("job_schedules").upsert({
    organization_id: organizationId,
    job_id: jobId,
    scheduled_date: scheduledDate,
    priority,
    created_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,job_id" });
  if (error) throw new Error("Unable to update daily schedule");
  revalidateDailyJobPaths(jobId);
}

export async function updateDailyJobCompletion(formData: FormData) {
  const jobId = value(formData, "job_id");
  const completed = formData.get("completed") === "on";
  const { supabase, organizationId, userId } = await ensureJob(jobId);
  const { error } = await supabase.from("job_schedules").upsert({
    organization_id: organizationId,
    job_id: jobId,
    is_completed: completed,
    completed_at: completed ? new Date().toISOString() : null,
    completed_by: completed ? userId : null,
    created_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,job_id" });
  if (error) throw new Error("Unable to update daily completion");
  revalidateDailyJobPaths(jobId);
}

export async function updateDailyPartsStatus(formData: FormData) {
  const jobId = value(formData, "job_id");
  const status = value(formData, "parts_status");
  if (!partsStatuses.has(status)) throw new Error("Invalid parts status");
  const { supabase, organizationId } = await ensureJob(jobId);

  const { data: request } = await supabase
    .from("parts_requests")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!request) return;

  const { error } = await supabase
    .from("parts_requests")
    .update({ status })
    .eq("organization_id", organizationId)
    .eq("id", request.id);
  if (error) throw new Error("Unable to update parts status");

  if (status === "ordered") {
    await supabase.from("parts_request_items").update({ status: "ordered" }).eq("organization_id", organizationId).eq("parts_request_id", request.id).eq("status", "selected");
  }
  if (status === "closed") {
    await supabase.from("parts_request_items").update({ status: "received" }).eq("organization_id", organizationId).eq("parts_request_id", request.id).in("status", ["selected", "ordered"]);
  }
  revalidateDailyJobPaths(jobId);
}

export async function createDailyTask(formData: FormData) {
  const title = value(formData, "title");
  const jobId = value(formData, "job_id") || null;
  const category = value(formData, "category") || "general";
  const priority = value(formData, "priority") || "normal";
  const assignedTo = value(formData, "assigned_to") || null;
  const dueAt = nullableDate(value(formData, "due_at"));
  if (!title) throw new Error("Task title is required");
  if (!taskCategories.has(category) || !priorities.has(priority)) throw new Error("Invalid task values");

  const { supabase, organizationId, userId } = await requireOrganizationContext();
  if (jobId) {
    const { data: job } = await supabase.from("jobs").select("id").eq("organization_id", organizationId).eq("id", jobId).maybeSingle();
    if (!job) throw new Error("Invalid job");
  }
  if (assignedTo) {
    const { data: member } = await supabase.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("user_id", assignedTo).eq("status", "active").maybeSingle();
    if (!member) throw new Error("Invalid assignee");
  }

  const { error } = await supabase.from("daily_tasks").insert({
    organization_id: organizationId,
    job_id: jobId,
    title,
    notes: value(formData, "notes") || null,
    category,
    priority,
    assigned_to: assignedTo,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    created_by: userId,
  });
  if (error) throw new Error("Unable to create task");
  revalidatePath("/daily-jobs");
}

export async function updateDailyTaskStatus(formData: FormData) {
  const taskId = value(formData, "task_id");
  const status = value(formData, "task_status");
  if (!taskStatuses.has(status)) throw new Error("Invalid task status");
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const { error } = await supabase
    .from("daily_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      completed_by: status === "done" ? userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", taskId);
  if (error) throw new Error("Unable to update task");
  revalidatePath("/daily-jobs");
}
