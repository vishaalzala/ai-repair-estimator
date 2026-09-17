import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

export default async function NotificationsPage() {
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data } = await supabase.from("activity_events").select("id,job_id,event_type,title,details,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100);
  const events = data ?? [];
  const jobIds = [...new Set(events.map((event) => event.job_id).filter((id): id is string => Boolean(id)))];
  const { data: jobs } = jobIds.length ? await supabase.from("jobs").select("id,job_number").eq("organization_id", organizationId).in("id", jobIds) : { data: [] };
  const jobById = new Map((jobs ?? []).map((job) => [job.id, job.job_number]));

  return <div className="mx-auto max-w-[1200px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
    <header><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#178f75]"><Bell className="size-4" /> Activity centre</div><h1 className="text-3xl font-semibold">Notifications</h1><p className="mt-2 text-sm text-slate-500">Recent estimate, job, parts and review activity across your workshop.</p></header>
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {events.length ? <div className="divide-y divide-slate-100">{events.map((event) => { const jobNumber = event.job_id ? jobById.get(event.job_id) : null; return <Link key={event.id} href={event.job_id ? `/jobs/${event.job_id}` : "/dashboard"} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50"><span className="mt-1 grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f7f2] text-[#178f75]"><Bell className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{event.title}</p>{jobNumber ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{jobNumber}</span> : null}</div><p className="mt-1 text-xs capitalize text-slate-500">{event.event_type.replaceAll("_", " ")}</p><p className="mt-2 text-xs text-slate-400">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</p></div><ChevronRight className="mt-2 size-4 shrink-0 text-slate-400" /></Link>; })}</div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><Bell className="mx-auto size-9 text-slate-400" /><p className="mt-4 font-medium">No notifications yet</p><p className="mt-2 text-sm text-slate-500">Recent workshop activity will appear here.</p></div></div>}
    </section>
  </div>;
}
