import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleAlert, ClipboardCheck, ListChecks, Plus, Search, Sparkles } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { DAILY_JOB_STATUS_OPTIONS, jobStatusLabel } from "@/lib/workflow/status";
import { AutoSubmitCheckbox, AutoSubmitSelect } from "@/components/daily-jobs/auto-submit";
import { DatePriorityForm } from "@/components/daily-jobs/date-priority-form";
import { RowDetails } from "@/components/daily-jobs/row-details";
import {
  createDailyTask,
  updateDailyJobAssignment,
  updateDailyJobCompletion,
  updateDailyJobSchedule,
  updateDailyJobStatus,
  updateDailyPartsStatus,
  updateDailyTaskStatus,
} from "./actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";

const taskStatusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const partsStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "requested", label: "Requested" },
  { value: "quotes_received", label: "Quotes Received" },
  { value: "selected", label: "Selected" },
  { value: "ordered", label: "Ordered" },
  { value: "closed", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
];

type NativeStatusRow = { id: string; job_id: string; status: string; updated_at: string };
type SupplementRow = NativeStatusRow & { supplement_number: number };

function localDateString(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-NZ", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shortDate(dateString: string | null | undefined) {
  if (!dateString) return "Unscheduled";
  return new Intl.DateTimeFormat("en-NZ", { day: "2-digit", month: "short" }).format(new Date(`${dateString}T12:00:00Z`));
}

function statusTone(status: string) {
  if (["completed", "approved", "authorised", "issued", "generated", "closed", "done", "ready"].includes(status)) return "border-[var(--brand)]/25 bg-[rgba(88,211,178,0.08)] text-[var(--brand)]";
  if (["awaiting_parts", "awaiting_response", "waiting", "requested", "ordered", "quotes_received"].includes(status)) return "border-amber-300/20 bg-amber-300/5 text-amber-200";
  if (["revision_requested", "cancelled", "failed"].includes(status)) return "border-red-300/20 bg-red-300/5 text-red-200";
  return "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]";
}

function StatusPill({ children, status }: { children: React.ReactNode; status: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-medium ${statusTone(status)}`}>{children}</span>;
}

export default async function DailyJobsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; staff?: string }> }) {
  const query = await searchParams;
  const view = query.view || "today";
  const search = (query.q || "").trim().toLowerCase();
  const staffFilter = query.staff || "";
  const { supabase, organizationId } = await requireOrganizationContext();

  const [{ data: org }, { data: jobsData }, { data: schedulesData }, { data: membersData }, { data: tasksData }] = await Promise.all([
    supabase.from("organizations").select("timezone").eq("id", organizationId).maybeSingle(),
    supabase.from("jobs").select("id, job_number, status, customer_id, vehicle_id, assigned_to, job_reference, repair_type, repair_size, work_source, created_at, updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(250),
    supabase.from("job_schedules").select("job_id, scheduled_date, due_at, priority, is_completed").eq("organization_id", organizationId),
    supabase.from("organization_members").select("user_id, role, status").eq("organization_id", organizationId).eq("status", "active"),
    supabase.from("daily_tasks").select("id, job_id, title, notes, category, status, priority, assigned_to, due_at, created_at").eq("organization_id", organizationId).neq("status", "cancelled").order("due_at", { ascending: true, nullsFirst: false }).limit(100),
  ]);

  const jobs = jobsData ?? [];
  const schedules = schedulesData ?? [];
  const members = membersData ?? [];
  const tasks = tasksData ?? [];
  const timezone = org?.timezone || "Pacific/Auckland";
  const today = localDateString(new Date(), timezone);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 6);

  const customerIds = jobs.map((job) => job.customer_id).filter((value): value is string => Boolean(value));
  const vehicleIds = jobs.map((job) => job.vehicle_id).filter((value): value is string => Boolean(value));
  const jobIds = jobs.map((job) => job.id);
  const memberIds = members.map((member) => member.user_id);

  const [customersResult, vehiclesResult, claimsResult, estimatesResult, photosResult, partsResult, aiChecksResult, reportsResult, supplementsResult, profilesResult] = await Promise.all([
    customerIds.length ? supabase.from("customers").select("id, first_name, last_name, business_name, email, phone").eq("organization_id", organizationId).in("id", customerIds) : Promise.resolve({ data: [] }),
    vehicleIds.length ? supabase.from("vehicles").select("id, registration, vin, make, model, variant, model_year, colour").eq("organization_id", organizationId).in("id", vehicleIds) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from("claims").select("id, job_id, insurer_id, claim_number, assessor_name, authority_reference").eq("organization_id", organizationId).in("job_id", jobIds) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from("estimates").select("id, job_id, status, updated_at").eq("organization_id", organizationId).in("job_id", jobIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from("photos").select("id, job_id, processing_status").eq("organization_id", organizationId).in("job_id", jobIds) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from("parts_requests").select("id, job_id, status, updated_at").eq("organization_id", organizationId).in("job_id", jobIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from("ai_review_checks").select("id, job_id, severity, resolution").eq("organization_id", organizationId).in("job_id", jobIds) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from("reports").select("id, job_id, status, updated_at").eq("organization_id", organizationId).in("job_id", jobIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from("supplements").select("id, job_id, supplement_number, status, updated_at").eq("organization_id", organizationId).in("job_id", jobIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
    memberIds.length ? supabase.from("profiles").select("id, full_name").in("id", memberIds) : Promise.resolve({ data: [] }),
  ]);

  const claims = claimsResult.data ?? [];
  const insurerIds = claims.map((claim) => claim.insurer_id).filter((value): value is string => Boolean(value));
  const { data: insurersData } = insurerIds.length
    ? await supabase.from("insurers").select("id, name").eq("organization_id", organizationId).in("id", insurerIds)
    : { data: [] };

  const customerById = new Map((customersResult.data ?? []).map((row) => [row.id, row]));
  const vehicleById = new Map((vehiclesResult.data ?? []).map((row) => [row.id, row]));
  const claimByJob = new Map(claims.map((row) => [row.job_id, row]));
  const insurerById = new Map((insurersData ?? []).map((row) => [row.id, row.name]));
  const scheduleByJob = new Map(schedules.map((row) => [row.job_id, row]));
  const profileById = new Map((profilesResult.data ?? []).map((row) => [row.id, row.full_name || "Workshop user"]));

  const estimateByJob = new Map<string, NativeStatusRow>();
  for (const row of (estimatesResult.data ?? []) as NativeStatusRow[]) if (!estimateByJob.has(row.job_id)) estimateByJob.set(row.job_id, row);
  const partsByJob = new Map<string, NativeStatusRow>();
  for (const row of (partsResult.data ?? []) as NativeStatusRow[]) if (!partsByJob.has(row.job_id) && row.status !== "cancelled") partsByJob.set(row.job_id, row);
  const reportByJob = new Map<string, NativeStatusRow>();
  for (const row of (reportsResult.data ?? []) as NativeStatusRow[]) if (!reportByJob.has(row.job_id)) reportByJob.set(row.job_id, row);
  const supplementByJob = new Map<string, SupplementRow>();
  for (const row of (supplementsResult.data ?? []) as SupplementRow[]) if (!supplementByJob.has(row.job_id)) supplementByJob.set(row.job_id, row);

  const photoCounts = new Map<string, { total: number; ready: number }>();
  for (const photo of photosResult.data ?? []) {
    const current = photoCounts.get(photo.job_id) ?? { total: 0, ready: 0 };
    current.total += 1;
    if (photo.processing_status === "ready") current.ready += 1;
    photoCounts.set(photo.job_id, current);
  }
  const aiChecks = new Map<string, { open: number; blocking: number }>();
  for (const check of aiChecksResult.data ?? []) {
    const current = aiChecks.get(check.job_id) ?? { open: 0, blocking: 0 };
    if (!check.resolution) {
      current.open += 1;
      if (check.severity === "blocking") current.blocking += 1;
    }
    aiChecks.set(check.job_id, current);
  }

  const memberOptions = [{ value: "", label: "Unassigned" }, ...members.map((member) => ({ value: member.user_id, label: profileById.get(member.user_id) || member.role.replaceAll("_", " ") }))];

  const rows = jobs.filter((job) => {
    const schedule = scheduleByJob.get(job.id);
    const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined;
    const customer = job.customer_id ? customerById.get(job.customer_id) : undefined;
    const claim = claimByJob.get(job.id);
    const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
    const searchText = [job.job_number, vehicle?.registration, vehicle?.make, vehicle?.model, customerName, claim?.claim_number, job.job_reference].filter(Boolean).join(" ").toLowerCase();
    if (search && !searchText.includes(search)) return false;
    if (staffFilter && job.assigned_to !== staffFilter) return false;
    const date = schedule?.scheduled_date || null;
    const completed = Boolean(schedule?.is_completed) || job.status === "completed";
    if (view === "all") return true;
    if (view === "completed") return completed;
    if (view === "overdue") return !completed && Boolean(date && date < today);
    if (view === "tomorrow") return !completed && date === tomorrow;
    if (view === "week") return !completed && Boolean(date && date >= today && date <= weekEnd);
    return !completed && (!date || date <= today);
  });

  const dueToday = jobs.filter((job) => { const schedule = scheduleByJob.get(job.id); return !schedule?.is_completed && (!schedule?.scheduled_date || schedule.scheduled_date <= today) && job.status !== "completed" && job.status !== "cancelled"; }).length;
  const overdue = jobs.filter((job) => { const schedule = scheduleByJob.get(job.id); return !schedule?.is_completed && Boolean(schedule?.scheduled_date && schedule.scheduled_date < today) && job.status !== "completed"; }).length;
  const awaitingParts = jobs.filter((job) => job.status === "awaiting_parts").length;
  const awaitingInsurer = jobs.filter((job) => ["sent_to_insurer", "awaiting_response"].includes(job.status)).length;
  const activeTasks = tasks.filter((task) => view === "completed" ? task.status === "done" : task.status !== "done");

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><CalendarDays className="size-4" /> Workshop command centre</div><h1 className="text-3xl font-semibold tracking-tight">Daily Jobs</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Manage the real job, parts, estimate, AI, report and workshop task state from one operational sheet. Changes here write back to the owning module.</p></div>
        <Link href="/jobs/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><Plus className="size-4" /> New job</Link>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Due / carry forward" value={dueToday} icon={<ListChecks className="size-4" />} /><Metric label="Overdue" value={overdue} icon={<CircleAlert className="size-4" />} /><Metric label="Awaiting parts" value={awaitingParts} icon={<ClipboardCheck className="size-4" />} /><Metric label="Waiting insurer" value={awaitingInsurer} icon={<Sparkles className="size-4" />} /></div>

      <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><nav className="flex gap-1 overflow-x-auto">{[["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This Week"], ["overdue", "Overdue"], ["completed", "Completed"], ["all", "All Jobs"]].map(([key, label]) => <Link key={key} href={`/daily-jobs?view=${key}${search ? `&q=${encodeURIComponent(search)}` : ""}`} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${view === key ? "bg-[var(--surface-3)] text-white" : "text-[var(--muted)] hover:text-white"}`}>{label}</Link>)}</nav><form className="flex flex-col gap-2 sm:flex-row" action="/daily-jobs"><input type="hidden" name="view" value={view} /><label className="relative min-w-[260px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" /><input name="q" defaultValue={query.q || ""} placeholder="Search job, rego, customer, claim…" className={`${inputClass} w-full pl-9`} /></label><select name="staff" defaultValue={staffFilter} className={inputClass}><option value="">All staff</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{profileById.get(member.user_id) || member.role}</option>)}</select><button className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]">Filter</button></form></div></section>

      <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="font-semibold">Workshop tasks</h2><p className="mt-1 text-xs text-[var(--muted)]">Only standalone work lives here. Job/parts/estimate/report statuses stay in their native modules.</p></div><details className="group"><summary className="cursor-pointer list-none rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold group-open:bg-[var(--surface-2)]">+ Add task</summary><form action={createDailyTask} className="mt-3 grid min-w-[300px] gap-2 rounded-xl border border-[var(--border)] bg-[#091322] p-3 sm:grid-cols-2 xl:min-w-[820px] xl:grid-cols-6"><input name="title" required placeholder="Task *" className={`${inputClass} sm:col-span-2 xl:col-span-2`} /><select name="job_id" className={inputClass} defaultValue=""><option value="">No linked job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.job_number || "Job"}</option>)}</select><select name="assigned_to" className={inputClass} defaultValue=""><option value="">Unassigned</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{profileById.get(member.user_id) || member.role}</option>)}</select><select name="priority" className={inputClass} defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><input name="due_at" type="datetime-local" className={inputClass} /><select name="category" className={inputClass} defaultValue="general"><option value="general">General</option><option value="customer">Customer</option><option value="insurer">Insurer</option><option value="parts">Parts</option><option value="estimate">Estimate</option><option value="photos">Photos</option><option value="admin">Admin</option><option value="workshop">Workshop</option><option value="other">Other</option></select><input name="notes" placeholder="Notes" className={`${inputClass} sm:col-span-2 xl:col-span-4`} /><button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Add task</button></form></details></div>{activeTasks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#0a1423] text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-3">Task</th><th className="px-4 py-3">Job</th><th className="px-4 py-3">Assigned</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{activeTasks.map((task) => { const linkedJob = task.job_id ? jobs.find((job) => job.id === task.job_id) : undefined; return <tr key={task.id} className="border-t border-[var(--border)]/70"><td className="px-4 py-3"><div className="font-medium">{task.title}</div><div className="mt-1 text-xs text-[var(--muted)]">{task.category}{task.notes ? ` · ${task.notes}` : ""}</div></td><td className="px-4 py-3">{linkedJob ? <Link href={`/jobs/${linkedJob.id}`} className="font-semibold text-[var(--brand)]">{linkedJob.job_number}</Link> : <span className="text-[var(--muted)]">—</span>}</td><td className="px-4 py-3 text-xs">{task.assigned_to ? profileById.get(task.assigned_to) || "Workshop user" : "Unassigned"}</td><td className="px-4 py-3"><StatusPill status={task.priority}>{task.priority}</StatusPill></td><td className="px-4 py-3 text-xs text-[var(--muted)]">{task.due_at ? new Intl.DateTimeFormat("en-NZ", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(task.due_at)) : "—"}</td><td className="px-4 py-3"><AutoSubmitSelect action={updateDailyTaskStatus} name="task_status" value={task.status} options={taskStatusOptions} hidden={{ task_id: task.id }} /></td></tr>; })}</tbody></table></div> : <div className="px-5 py-6 text-sm text-[var(--muted)]">No active standalone tasks.</div>}</section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4"><div><h2 className="font-semibold">Daily workshop sheet</h2><p className="mt-1 text-xs text-[var(--muted)]">{rows.length} jobs shown · native module status, not copied data</p></div><CheckCircle2 className="size-5 text-[var(--brand)]" /></div><div className="overflow-x-auto"><table className="w-full min-w-[1850px] text-left text-sm"><thead className="sticky top-0 z-10 bg-[#08111e] text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="sticky left-0 z-20 bg-[#08111e] px-3 py-3">Job / Rego</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Vehicle / Customer</th><th className="px-3 py-3">Insurer / Claim</th><th className="px-3 py-3">Assigned</th><th className="px-3 py-3">Job status</th><th className="px-3 py-3">Photos</th><th className="px-3 py-3">Estimate</th><th className="px-3 py-3">AI review</th><th className="px-3 py-3">Parts</th><th className="px-3 py-3">Report</th><th className="px-3 py-3">Supplement</th><th className="px-3 py-3">Insurer stage</th><th className="px-3 py-3">Done</th><th className="px-3 py-3">More</th></tr></thead><tbody>{rows.map((job) => { const schedule = scheduleByJob.get(job.id); const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined; const customer = job.customer_id ? customerById.get(job.customer_id) : undefined; const claim = claimByJob.get(job.id); const estimate = estimateByJob.get(job.id); const parts = partsByJob.get(job.id); const report = reportByJob.get(job.id); const supplement = supplementByJob.get(job.id); const photos = photoCounts.get(job.id) ?? { total: 0, ready: 0 }; const ai = aiChecks.get(job.id) ?? { open: 0, blocking: 0 }; const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer pending"; const vehicleName = [vehicle?.model_year, vehicle?.make, vehicle?.model, vehicle?.variant].filter(Boolean).join(" ") || "Vehicle pending"; const insurerName = claim?.insurer_id ? insurerById.get(claim.insurer_id) || "Insurer" : "No insurer"; const insurerStage = ["sent_to_insurer", "awaiting_response", "authorised", "revision_requested"].includes(job.status) ? jobStatusLabel(job.status) : "—"; const photoLabel = photos.total ? `${photos.ready}/${photos.total} ready` : "No photos"; const aiLabel = ai.blocking ? `${ai.blocking} blocking` : ai.open ? `${ai.open} review` : "Clear"; return <tr key={job.id} className="border-t border-[var(--border)]/70 align-top hover:bg-white/[0.015]"><td className="sticky left-0 z-[5] bg-[var(--surface)] px-3 py-3"><Link href={`/jobs/${job.id}`} className="font-semibold hover:text-[var(--brand)]">{job.job_number || "Job"}</Link><div className="mt-1 text-xs font-medium text-[var(--brand)]">{vehicle?.registration || "No rego"}</div></td><td className="px-3 py-3"><DatePriorityForm action={updateDailyJobSchedule} jobId={job.id} scheduledDate={schedule?.scheduled_date || ""} priority={schedule?.priority || "normal"} /><div className="mt-1 text-[10px] text-[var(--muted)]">{shortDate(schedule?.scheduled_date)}</div></td><td className="max-w-[220px] px-3 py-3"><div className="text-xs font-medium">{vehicleName}</div><div className="mt-1 truncate text-xs text-[var(--muted)]">{customerName}</div></td><td className="max-w-[180px] px-3 py-3"><div className="truncate text-xs">{insurerName}</div><div className="mt-1 text-xs text-[var(--muted)]">{claim?.claim_number || "No claim #"}</div></td><td className="px-3 py-3"><AutoSubmitSelect action={updateDailyJobAssignment} name="assigned_to" value={job.assigned_to || ""} options={memberOptions} hidden={{ job_id: job.id }} className="max-w-[150px]" /></td><td className="px-3 py-3"><AutoSubmitSelect action={updateDailyJobStatus} name="status" value={job.status} options={DAILY_JOB_STATUS_OPTIONS} hidden={{ job_id: job.id }} className="max-w-[170px]" /></td><td className="px-3 py-3"><Link href={`/jobs/${job.id}/photos`}><StatusPill status={photos.total ? "ready" : "draft"}>{photoLabel}</StatusPill></Link></td><td className="px-3 py-3"><Link href={`/jobs/${job.id}/estimate`}><StatusPill status={estimate?.status || "draft"}>{estimate?.status?.replaceAll("_", " ") || "Not started"}</StatusPill></Link></td><td className="px-3 py-3"><Link href={`/jobs/${job.id}/ai-review`}><StatusPill status={ai.blocking ? "failed" : ai.open ? "waiting" : "completed"}>{aiLabel}</StatusPill></Link></td><td className="px-3 py-3">{parts ? <AutoSubmitSelect action={updateDailyPartsStatus} name="parts_status" value={parts.status} options={partsStatusOptions} hidden={{ job_id: job.id }} className="max-w-[145px]" /> : <Link href={`/jobs/${job.id}/parts`} className="text-xs font-semibold text-[var(--brand)]">Add parts</Link>}</td><td className="px-3 py-3"><Link href="/reports"><StatusPill status={report?.status || "draft"}>{report?.status || (estimate ? "Ready" : "No version")}</StatusPill></Link></td><td className="px-3 py-3">{supplement ? <Link href={`/jobs/${job.id}/supplements`}><StatusPill status={supplement.status}>#{supplement.supplement_number} {supplement.status}</StatusPill></Link> : <span className="text-xs text-[var(--muted)]">—</span>}</td><td className="px-3 py-3"><StatusPill status={job.status}>{insurerStage}</StatusPill></td><td className="px-3 py-3"><AutoSubmitCheckbox action={updateDailyJobCompletion} name="completed" checked={Boolean(schedule?.is_completed) || job.status === "completed"} hidden={{ job_id: job.id }} label="Done" /></td><td className="px-3 py-3"><RowDetails jobId={job.id} details={[{ label: "Job reference", value: job.job_reference || "—" }, { label: "Repair", value: [job.repair_type, job.repair_size].filter(Boolean).join(" · ") || "—" }, { label: "Work source", value: job.work_source || "—" }, { label: "VIN", value: vehicle?.vin || "—" }, { label: "Customer", value: customerName }, { label: "Customer contact", value: customer?.phone || customer?.email || "—" }, { label: "Assessor", value: claim?.assessor_name || "—" }, { label: "Authority", value: claim?.authority_reference || "—" }, { label: "Claim", value: claim?.claim_number || "—" }]} /></td></tr>; })}</tbody></table></div>{!rows.length ? <div className="grid min-h-44 place-items-center px-6 text-center text-sm text-[var(--muted)]">No jobs match this Daily Jobs view.</div> : null}</section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between"><div><div className="text-2xl font-semibold tabular-nums">{value}</div><div className="mt-1 text-xs text-[var(--muted)]">{label}</div></div><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]">{icon}</span></div></div>;
}
