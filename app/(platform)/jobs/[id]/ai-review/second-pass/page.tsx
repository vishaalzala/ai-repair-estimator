import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, Info, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { resolveReviewCheck } from "../actions";
import { runSmartEstimateReview } from "./actions";

function iconFor(severity: string) {
  if (severity === "blocking") return CircleAlert;
  if (severity === "review") return AlertTriangle;
  if (severity === "information") return Info;
  return CheckCircle2;
}

export default async function SmartReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: job } = await supabase.from("jobs").select("id, job_number, vehicle_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!job) notFound();

  const [vehicleResult, checksResult, runResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("ai_review_checks").select("id, title, detail, severity, evidence, resolution, resolved_at, ai_run_id, created_at").eq("organization_id", organizationId).eq("job_id", job.id).eq("source_type", "ai").order("created_at", { ascending: false }),
    supabase.from("ai_analysis_runs").select("id, status, created_at, completed_at").eq("organization_id", organizationId).eq("job_id", job.id).eq("task", "estimate_review").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const vehicle = vehicleResult.data;
  const checks = checksResult.data ?? [];
  const latestRun = runResult.data;
  const currentChecks = latestRun ? checks.filter((check) => check.ai_run_id === latestRun.id) : [];
  const openChecks = currentChecks.filter((check) => !check.resolution);
  const resolved = currentChecks.filter((check) => Boolean(check.resolution));
  const configured = Boolean(process.env.OPENAI_API_KEY && process.env.AI_REVIEW_MODEL);
  const runAction = runSmartEstimateReview.bind(null, job.id);
  const resolveAction = resolveReviewCheck.bind(null, job.id);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#178f75]"><Sparkles className="size-4" /> Smart second pass</div><h1 className="text-3xl font-semibold tracking-tight">What might be missing?</h1><p className="mt-2 text-sm text-slate-500">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Reviews the current estimate, accepted damage context, parts, rules and workshop knowledge.</p></div><form action={runAction}><button disabled={!configured} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="size-4" /> Run smart review</button></form></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.message}</div> : null}
      {!configured ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Smart review is temporarily unavailable. Please contact your platform administrator.</div> : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Open checks" value={openChecks.length} /><Metric label="Blocking" value={openChecks.filter((check) => check.severity === "blocking").length} /><Metric label="Resolved by estimator" value={resolved.length} /></section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5"><h2 className="font-semibold">Review suggestions</h2><p className="mt-1 text-xs leading-5 text-slate-500">Suggestions never change the estimate automatically. Confirm each item against evidence, repair procedures and the vehicle.</p></div>
          {currentChecks.length === 0 ? <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center"><div><Sparkles className="mx-auto size-9 text-slate-400" /><p className="mt-4 font-medium">No smart second-pass review yet</p><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Complete the draft estimate, then run this review to surface possible omissions and unresolved inspections.</p></div></div> : <div className="space-y-3">{currentChecks.map((check) => { const Icon = iconFor(check.severity); const evidence = check.evidence && !Array.isArray(check.evidence) ? check.evidence as Record<string, unknown> : {}; const sourceRefs = Array.isArray(evidence.source_refs) ? evidence.source_refs.map(String) : []; return <article key={check.id} className={`rounded-2xl border p-4 ${check.resolution ? "border-slate-200 bg-slate-50 opacity-75" : check.severity === "blocking" ? "border-red-200 bg-red-50" : check.severity === "review" ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-[#178f75]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{check.title}</h3><span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] uppercase text-slate-500">{check.severity}</span>{check.resolution ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800">{String(check.resolution).replaceAll("_", " ")}</span> : null}</div><p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>{evidence.rationale ? <p className="mt-2 text-xs leading-5 text-slate-500"><strong className="text-slate-700">Why:</strong> {String(evidence.rationale)}</p> : null}{sourceRefs.length ? <p className="mt-2 text-[11px] text-slate-500">Evidence refs: {sourceRefs.join(", ")}</p> : null}{!check.resolution ? <form action={resolveAction} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="check_id" value={check.id} /><DecisionButton value="already_included">Already included</DecisionButton><DecisionButton value="added">Added</DecisionButton><DecisionButton value="edited">Edited estimate</DecisionButton><DecisionButton value="not_required">Not required</DecisionButton><DecisionButton value="acknowledged">Acknowledge</DecisionButton></form> : null}</div></div></article>; })}</div>}
        </section>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Latest review</h2>{latestRun ? <dl className="mt-4 space-y-3 text-sm"><InfoRow label="Status" value={latestRun.status.replaceAll("_", " ")} /><InfoRow label="Started" value={new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(latestRun.created_at))} /><InfoRow label="Completed" value={latestRun.completed_at ? new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(latestRun.completed_at)) : "—"} /></dl> : <p className="mt-3 text-sm text-slate-500">No run recorded.</p>}</section>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#178f75]" /><div><h2 className="font-semibold">Estimator approval stays in control</h2><p className="mt-2 text-sm leading-6 text-slate-600">Smart review cannot add charges, approve a repair or issue an insurer estimate. A workshop user must accept, reject or resolve every suggestion.</p></div></div></section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p></article>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="max-w-52 text-right font-medium capitalize text-slate-800">{value}</dd></div>; }
function DecisionButton({ value, children }: { value: string; children: React.ReactNode }) { return <button name="resolution" value={value} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">{children}</button>; }
