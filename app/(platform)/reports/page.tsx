import Link from "next/link";
import { FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

export default async function ReportsPage() {
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: versionsData } = await supabase
    .from("estimate_versions")
    .select("id, job_id, version_number, reason, status_snapshot, currency, total_inc_tax, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  const versions = versionsData ?? [];
  const jobIds = [...new Set(versions.map((version) => version.job_id))];
  const { data: jobsData } = jobIds.length
    ? await supabase.from("jobs").select("id, job_number, vehicle_id").eq("organization_id", organizationId).in("id", jobIds)
    : { data: [] };
  const jobs = jobsData ?? [];
  const vehicleIds = jobs.map((job) => job.vehicle_id).filter((value): value is string => Boolean(value));
  const { data: vehiclesData } = vehicleIds.length
    ? await supabase.from("vehicles").select("id, registration, make, model, model_year").eq("organization_id", organizationId).in("id", vehicleIds)
    : { data: [] };
  const vehicleById = new Map((vehiclesData ?? []).map((vehicle) => [vehicle.id, vehicle]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><FileText className="size-4" /> Versioned output</div><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Generate insurer PDFs only from formal immutable estimate versions. Every generated PDF is hashed, privately retained and linked back to the exact estimate snapshot.</p></header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="font-semibold">Insurance estimate versions</h2><p className="mt-1 text-xs text-[var(--muted)]">Choose a formal version to generate a report.</p></div><ShieldCheck className="size-5 text-[var(--brand)]" /></div>
        {versions.length === 0 ? <div className="grid min-h-72 place-items-center px-6 text-center"><div><FileCheck2 className="mx-auto size-9 text-[var(--muted)]" /><p className="mt-4 font-medium">No formal estimate versions yet</p><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Build an estimate and use Save Version before generating insurer output.</p><Link href="/jobs" className="mt-4 inline-flex text-sm font-semibold text-[var(--brand)]">Open jobs →</Link></div></div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#0a1423] text-[11px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3 font-medium">Job</th><th className="px-5 py-3 font-medium">Vehicle</th><th className="px-5 py-3 font-medium">Version</th><th className="px-5 py-3 font-medium">Snapshot status</th><th className="px-5 py-3 text-right font-medium">Total</th><th className="px-5 py-3"></th></tr></thead><tbody>{versions.map((version) => { const job = jobById.get(version.job_id); const vehicle = job?.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined; const vehicleLabel = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle"; return <tr key={version.id} className="border-t border-[var(--border)]/70"><td className="px-5 py-4"><Link href={job ? `/jobs/${job.id}` : "/jobs"} className="font-medium hover:text-[var(--brand)]">{job?.job_number || "Job"}</Link></td><td className="px-5 py-4"><div>{vehicleLabel}</div><div className="mt-1 text-xs text-[var(--muted)]">{vehicle?.registration || "—"}</div></td><td className="px-5 py-4"><span className="font-medium">V{version.version_number}</span><div className="mt-1 text-xs text-[var(--muted)]">{version.reason.replaceAll("_", " ")}</div></td><td className="px-5 py-4 text-[var(--muted)]">{version.status_snapshot.replaceAll("_", " ")}</td><td className="px-5 py-4 text-right font-semibold tabular-nums">{money(Number(version.total_inc_tax), version.currency)}</td><td className="px-5 py-4 text-right"><a href={`/api/reports/estimate/${version.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--brand)] hover:text-[#06110e]">Generate PDF</a></td></tr>; })}</tbody></table></div>}
      </section>
    </div>
  );
}
