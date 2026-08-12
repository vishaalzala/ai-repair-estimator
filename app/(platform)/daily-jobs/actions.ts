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

async function getSchedule(jobId: string) {
  const context = await ensureJob(jobId);
  const { data: schedule } = await context.supabase
    .from("job_schedules")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("job_id", jobId)
    .maybeSingle();
  return { ...context, schedule };
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
  const { supabase, organizationId, userId, job } = await ensureJob(jobId);

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

  await supabase.from("activity_events").insert({
    organization_id: organizationId,
    job_id: jobId,
    actor_user_id: userId,
    event_type: "job_assignment_changed",
    title: "Job assignment changed",
    details: { from_user_id: job.assigned_to, to_user_id: assignedTo, source: "daily_jobs" },
  });
  revalidateDailyJobPaths(jobId);
}

export async function updateDailyJobSchedule(formData: FormData) {
  const jobId = value(formData, "job_id");
  const scheduledDate = nullableDate(value(formData, "scheduled_date"));
  const priority = value(formData, "priority") || "normal";
  if (!priorities.has(priority)) throw new Error("Invalid priority");

  const { supabase, organizationId, userId, schedule } = await getSchedule(jobId);
  const now = new Date().toISOString();
  const result = schedule
    ? await supabase.from("job_schedules").update({ scheduled_date: scheduledDate, priority, updated_at: now }).eq("organization_id", organizationId).eq("id", schedule.id)
    : await supabase.from("job_schedules").insert({ organization_id: organizationId, job_id: jobId, scheduled_date: scheduledDate, priority, created_by: userId, updated_at: now });
  if (result.error) throw new Error("Unable to update daily schedule");
  revalidateDailyJobPaths(jobId);
}

export async function updateDailyJobCompletion(formData: FormData) {
  const jobId = value(formData, "job_id");
  const completed = formData.get("completed") === "on";
  const { supabase, organizationId, userId, schedule } = await getSchedule(jobId);
  const now = new Date().toISOString();
  const completion = { is_completed: completed, completed_at: completed ? now : null, completed_by: completed ? userId : null, updated_at: now };
  const result = schedule
    ? await supabase.from("job_schedules").update(completion).eq("organization_id", organizationId).eq("id", schedule.id)
    : await supabase.from("job_schedules").insert({ organization_id: organizationId, job_id: jobId, ...completion, created_by: userId });
  if (result.error) throw new Error("Unable to update daily completion");
  revalidateDailyJobPaths(jobId);
}

export async function updateDailyPartsStatus(formData: FormData) {
  const jobId = value(formData, "job_id");
  const status = value(formData, "parts_status");
  if (!partsStatuses.has(status)) throw new Error("Invalid parts status");
  const { supabase, organizationId, userId } = await ensureJob(jobId);

  const { data: request } = await supabase
    .from("parts_requests")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!request || request.status === status) return;

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
  await supabase.from("activity_events").insert({
    organization_id: organizationId,
    job_id: jobId,
    actor_user_id: userId,
    event_type: "parts_status_changed",
    title: `Parts status changed to ${status.replaceAll("_", " ")}`,
    details: { from_status: request.status, to_status: status, source: "daily_jobs" },
  });
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
  if (jobId) revalidatePath(`/jobs/${jobId}/daily-tasks`);
}

export async function updateDailyTaskStatus(formData: FormData) {
  const taskId = value(formData, "task_id");
  const status = value(formData, "task_status");
  if (!taskStatuses.has(status)) throw new Error("Invalid task status");
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const { data: task } = await supabase.from("daily_tasks").select("job_id").eq("organization_id", organizationId).eq("id", taskId).maybeSingle();
  if (!task) throw new Error("Task not found");
  const { error } = await supabase
    .from("daily_tasks")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null, completed_by: status === "done" ? userId : null, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", taskId);
  if (error) throw new Error("Unable to update task");
  revalidatePath("/daily-jobs");
  if (task.job_id) revalidatePath(`/jobs/${task.job_id}/daily-tasks`);
}
