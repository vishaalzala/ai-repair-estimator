import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, Info, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { resolveReviewCheck, runRulesReview } from "./actions";

function severityIcon(severity: string) {
  if (severity === "blocking") return CircleAlert;
  if (severity === "review") return AlertTriangle;
  if (severity === "pass") return CheckCircle2;
  return Info;
}

function severityClass(severity: string) {
  if (severity === "blocking") return "border-red-200 bg-red-50";
  if (severity === "review") return "border-amber-200 bg-amber-50";
  if (severity === "pass") return "border-emerald-200 bg-emerald-50";
  return "border-sky-200 bg-sky-50";
}

export default async function AiReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: job } = await supabase.from("jobs").select("id, job_number, status, vehicle_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!job) notFound();

  const [vehicleResult, checkResult, estimateResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year, adas_present").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("ai_review_checks").select("id, check_type, title, detail, severity, source_type, source_ref, evidence, resolution, resolved_at, created_at").eq("organization_id", organizationId).eq("job_id", job.id).order("created_at", { ascending: false }),
    supabase.from("estimates").select("id").eq("organization_id", organizationId).eq("job_id", job.id).eq("estimate_type", "primary").maybeSingle(),
  ]);

  const vehicle = vehicleResult.data;
  const checks = checkResult.data ?? [];
  const unresolved = checks.filter((check) => !check.resolution);
  const resolved = checks.filter((check) => Boolean(check.resolution));
  const counts = {
    blocking: unresolved.filter((check) => check.severity === "blocking").length,
    review: unresolved.filter((check) => check.severity === "review").length,
    information: unresolved.filter((check) => check.severity === "information").length,
  };
  const rulesAction = runRulesReview.bind(null, job.id);
  const resolveAction = resolveReviewCheck.bind(null, job.id);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#178f75]"><Sparkles className="size-4" /> Estimator-controlled review</div><h1 className="text-3xl font-semibold tracking-tight">Estimate review</h1><p className="mt-2 text-sm text-slate-500">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Repair rules and a separate smart second pass help surface items that need an estimator decision.</p></div><form action={rulesAction}><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><RefreshCw className="size-4" /> Run repair rules review</button></form></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.message}</div> : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Blocking" value={counts.blocking} note="Must resolve before final issue" />
        <Metric label="Requires review" value={counts.review} note="Estimator decision needed" />
        <Metric label="Information" value={counts.information} note="Contextual checks" />
        <Metric label="Resolved" value={resolved.length} note="Human decisions recorded" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5"><h2 className="font-semibold">Open review checks</h2><p className="mt-1 text-xs text-slate-500">These are prompts to review legitimate work or evidence. They are never added to the estimate automatically.</p></div>
          {!estimateResult.data ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Build the draft estimate before relying on the final review workflow. <Link href={`/jobs/${job.id}/estimate`} className="font-semibold underline">Open estimate</Link></div> : null}
          {unresolved.length === 0 ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center"><div><ShieldCheck className="mx-auto size-9 text-[#178f75]" /><p className="mt-4 font-medium">No unresolved checks</p><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Run the repair rules review again after estimate or evidence changes, then use Smart second pass for another omission check.</p></div></div> : <div className="space-y-3">{unresolved.map((check) => { const Icon = severityIcon(check.severity); const evidence = Array.isArray(check.evidence) ? check.evidence[0] as Record<string, unknown> | undefined : undefined; return <article key={check.id} className={`rounded-2xl border p-4 ${severityClass(check.severity)}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-[#178f75]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{check.title}</h3><span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{check.severity}</span><span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-500">{check.source_type || "review"}</span></div>{check.detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p> : null}{evidence?.rule_name ? <p className="mt-2 text-[11px] text-slate-500">Source: {String(evidence.rule_name)}{evidence.enforcement ? ` · ${String(evidence.enforcement).replaceAll("_", " ")}` : ""}</p> : null}<form action={resolveAction} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="check_id" value={check.id} /><Decision value="already_included">Already included</Decision><Decision value="added">Added to estimate</Decision><Decision value="not_required">Not required</Decision><Decision value="acknowledged">Acknowledge</Decision></form></div></div></article>; })}</div>}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Review summary</h2><div className="mt-4 grid grid-cols-2 gap-2"><SummaryCell label="Blocking" value={counts.blocking} /><SummaryCell label="Review" value={counts.review} /><SummaryCell label="Information" value={counts.information} /><SummaryCell label="Resolved" value={resolved.length} /></div><p className="mt-4 text-xs leading-5 text-slate-500">Final readiness is based on explicit checks, evidence and estimator decisions—not a made-up accuracy score.</p></section>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 shrink-0 text-[#178f75]" /><div><h2 className="font-semibold">Smart review</h2><p className="mt-2 text-sm leading-6 text-slate-600">A separate second pass can surface photo-based findings and possible missing operations. It does not overwrite repair checks or pricing calculations.</p><Link href={`/jobs/${job.id}/ai-review/second-pass`} className="mt-4 inline-flex text-sm font-semibold text-[#178f75]">Open smart second pass →</Link></div></div></section>
          {resolved.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Recent decisions</h2><div className="mt-4 space-y-3">{resolved.slice(0, 8).map((check) => <div key={check.id} className="border-l border-slate-200 pl-3"><p className="text-sm font-medium text-slate-800">{check.title}</p><p className="mt-1 text-[11px] text-slate-500">{String(check.resolution).replaceAll("_", " ")}{check.resolved_at ? ` · ${new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(check.resolved_at))}` : ""}</p></div>)}</div></section> : null}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><div className="mt-3 flex items-end justify-between gap-3"><strong className="text-3xl text-slate-950">{value}</strong><span className="max-w-28 text-right text-[10px] leading-4 text-slate-500">{note}</span></div></article>;
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center"><div className="text-xl font-semibold text-slate-950">{value}</div><div className="mt-1 text-[10px] text-slate-500">{label}</div></div>;
}

function Decision({ value, children }: { value: string; children: React.ReactNode }) {
  return <button name="resolution" value={value} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">{children}</button>;
}
