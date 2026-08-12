import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { AutoSubmitSelect } from "@/components/daily-jobs/auto-submit";
import { createDailyTask, updateDailyTaskStatus } from "@/app/(platform)/daily-jobs/actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";
const taskStatusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function JobDailyTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: job } = await supabase.from("jobs").select("id, job_number").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!job) notFound();

  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase.from("daily_tasks").select("id, title, notes, category, status, priority, assigned_to, due_at").eq("organization_id", organizationId).eq("job_id", job.id).order("created_at", { ascending: false }),
    supabase.from("organization_members").select("user_id, role").eq("organization_id", organizationId).eq("status", "active"),
  ]);
  const userIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || "Workshop user"]));

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><ListChecks className="size-4" /> Job tasks</div><h1 className="text-3xl font-semibold tracking-tight">Tasks</h1><p className="mt-2 text-sm text-[var(--muted)]">Standalone follow-ups for this job. Core job, estimate, parts and report states stay in their own modules and are surfaced on Daily Jobs.</p></header>
      <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><form action={createDailyTask} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><input type="hidden" name="job_id" value={job.id} /><input name="title" required placeholder="Task *" className={`${inputClass} md:col-span-2 xl:col-span-2`} /><select name="assigned_to" className={inputClass} defaultValue=""><option value="">Unassigned</option>{(members ?? []).map((member) => <option key={member.user_id} value={member.user_id}>{profileById.get(member.user_id) || member.role}</option>)}</select><select name="priority" className={inputClass} defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><input name="due_at" type="datetime-local" className={inputClass} /><select name="category" className={inputClass} defaultValue="general"><option value="general">General</option><option value="customer">Customer</option><option value="insurer">Insurer</option><option value="parts">Parts</option><option value="estimate">Estimate</option><option value="photos">Photos</option><option value="admin">Admin</option><option value="workshop">Workshop</option><option value="other">Other</option></select><input name="notes" placeholder="Notes" className={`${inputClass} md:col-span-2 xl:col-span-5`} /><button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Add task</button></form></section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold">Job tasks</h2></div>{(tasks ?? []).length ? <div className="divide-y divide-[var(--border)]/70">{(tasks ?? []).map((task) => <div key={task.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto] md:items-center"><div><div className="font-medium">{task.title}</div><div className="mt-1 text-xs text-[var(--muted)]">{task.category} · {task.priority}{task.notes ? ` · ${task.notes}` : ""}</div></div><div className="text-xs text-[var(--muted)]">{task.assigned_to ? profileById.get(task.assigned_to) || "Workshop user" : "Unassigned"}</div><AutoSubmitSelect action={updateDailyTaskStatus} name="task_status" value={task.status} options={taskStatusOptions} hidden={{ task_id: task.id }} /></div>)}</div> : <div className="px-5 py-8 text-sm text-[var(--muted)]">No tasks for this job.</div>}</section>
    </div>
  );
}
