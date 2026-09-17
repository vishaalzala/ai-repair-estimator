import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, FileCheck2, FileText, FolderOpen, History } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

export default async function JobDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: job } = await supabase.from("jobs").select("id,job_number,vehicle_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!job) notFound();

  const [vehicleResult, versionsResult, reportsResult, photosResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration,make,model,model_year").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("estimate_versions").select("id,version_number,reason,status_snapshot,currency,total_inc_tax,created_at").eq("organization_id", organizationId).eq("job_id", job.id).order("version_number", { ascending: false }),
    supabase.from("reports").select("id,report_type,estimate_version_id,status,title,created_at,updated_at").eq("organization_id", organizationId).eq("job_id", job.id).order("created_at", { ascending: false }),
    supabase.from("photos").select("id,category,file_name,mime_type,file_size_bytes,caption,created_at").eq("organization_id", organizationId).eq("job_id", job.id).eq("category", "document").order("created_at", { ascending: false }),
  ]);
  const vehicle = vehicleResult.data;
  const versions = versionsResult.data ?? [];
  const reports = reportsResult.data ?? [];
  const documents = photosResult.data ?? [];
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return <div className="mx-auto max-w-[1300px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
    <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
    <header><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#178f75]"><FolderOpen className="size-4" /> Documents & output</div><h1 className="text-3xl font-semibold">Job documents</h1><p className="mt-2 text-sm text-slate-500">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Formal estimate versions, reports and uploaded document evidence.</p></header>

    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold">Estimate versions</h2><p className="mt-1 text-xs text-slate-500">Immutable snapshots available for insurer PDF output.</p></div><FileCheck2 className="size-5 text-[#178f75]" /></div>
          {versions.length ? <div className="divide-y divide-slate-100">{versions.map((version) => <article key={version.id} className="grid gap-3 px-5 py-4 md:grid-cols-[100px_1fr_150px_170px] md:items-center"><div><p className="font-semibold">V{version.version_number}</p><p className="mt-1 text-[10px] text-slate-400">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(version.created_at))}</p></div><div><p className="text-sm capitalize text-slate-700">{version.reason.replaceAll("_", " ")}</p><p className="mt-1 text-xs capitalize text-slate-500">{version.status_snapshot.replaceAll("_", " ")}</p></div><div className="font-semibold tabular-nums">{money(Number(version.total_inc_tax), version.currency)}</div><div className="flex justify-end gap-2"><a href={`/api/reports/estimate/${version.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">PDF</a>{versions.length > 1 ? <Link href={`/jobs/${job.id}/versions/compare?to=${version.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Compare</Link> : null}</div></article>)}</div> : <div className="grid min-h-52 place-items-center p-8 text-center"><div><FileCheck2 className="mx-auto size-8 text-slate-400" /><p className="mt-4 font-medium">No formal versions yet</p><p className="mt-2 text-sm text-slate-500">Save an estimate version before issuing insurer output.</p><Link href={`/jobs/${job.id}/estimate`} className="mt-4 inline-flex text-sm font-semibold text-[#178f75]">Open estimate →</Link></div></div>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold">Generated reports</h2><p className="mt-1 text-xs text-slate-500">Report records linked to this job.</p></div><FileText className="size-5 text-[#178f75]" /></div>
          {reports.length ? <div className="divide-y divide-slate-100">{reports.map((report) => <article key={report.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_150px_180px] md:items-center"><div><p className="font-semibold">{report.title}</p><p className="mt-1 text-xs capitalize text-slate-500">{report.report_type.replaceAll("_", " ")}</p></div><span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold capitalize text-slate-600">{report.status.replaceAll("_", " ")}</span><p className="text-xs text-slate-500 md:text-right">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.updated_at))}</p></article>)}</div> : <div className="p-8 text-center text-sm text-slate-500">No report records yet.</div>}
        </section>
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Camera className="size-5 text-[#178f75]" /><div><h2 className="font-semibold">Uploaded documents</h2><p className="text-xs text-slate-500">Files stored in the photo evidence library.</p></div></div>{documents.length ? <div className="mt-4 space-y-3">{documents.map((document) => <div key={document.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="truncate text-sm font-medium" title={document.file_name}>{document.file_name}</p><p className="mt-1 text-[10px] text-slate-500">{document.mime_type} · {(Number(document.file_size_bytes) / 1024 / 1024).toFixed(1)} MB</p>{document.caption ? <p className="mt-2 text-xs leading-5 text-slate-500">{document.caption}</p> : null}</div>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><p className="text-sm font-medium">No uploaded documents</p><p className="mt-2 text-xs leading-5 text-slate-500">Use the Photos page and choose the Document category for assessor letters or other image/PDF evidence supported by the uploader.</p><Link href={`/jobs/${job.id}/photos`} className="mt-4 inline-flex text-xs font-semibold text-[#178f75]">Open evidence capture →</Link></div>}</section>
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><History className="mt-0.5 size-5 text-[#178f75]" /><div><h2 className="font-semibold">Version-safe output</h2><p className="mt-2 text-sm leading-6 text-slate-600">Insurer PDFs are generated from saved estimate versions so later editing cannot silently change an already-issued snapshot.</p></div></div></section>
      </aside>
    </div>
  </div>;
}
