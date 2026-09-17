import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, Info, RefreshCw, Sparkles } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { resolveReviewCheck } from "../actions";
import { runOpenAiEstimateReview as runSmartEstimateReview } from "../openai/actions";

function iconFor(severity: string) {
  if (severity === "blocking") return CircleAlert;
  if (severity === "review") return AlertTriangle;
  if (severity === "information") return Info;
  return CheckCircle2;
}

export default async function SmartSecondPassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: job } = await supabase.from("jobs").select("id, job_number, vehicle_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!job) notFound();

  const [vehicleResult, checksResult, runResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("ai_review_checks").select("id, title, detail, severity, evidence, resolution, resolved_at, ai_run_id, created_at").eq("organization_id", organizationId).eq("job_id", job.id).eq("source_type", "ai").order("created_at", { ascending: false }),
    supabase.from("ai_analysis_runs").select("id, status, latency_ms, created_at, completed_at").eq("organization_id", organizationId).eq("job_id", job.id).eq("task", "estimate_review").order("created_at", { ascending: false }).limit(1).maybeSingle(),
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
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand-strong)]"><Sparkles className="size-4" /> Smart second pass</div><h1 className="text-3xl font-semibold tracking-tight">What might be missing?</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Reviews the current estimate, accepted damage context, parts, rules and workshop knowledge.</p></div><form action={runAction}><button disabled={!configured} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#05291f] disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="size-4" /> Run Smart review</button></form></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Smart review could not complete. The estimate was not changed.</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Smart review completed. Every suggestion still requires an estimator decision.</div> : null}
      {!configured ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Smart review is temporarily unavailable. Please contact your platform administrator.</div> : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Open checks" value={openChecks.length} /><Metric label="Blocking" value={openChecks.filter((check) => check.severity === "blocking").length} /><Metric label="Resolved by estimator" value={resolved.length} /></section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="app-card p-5 sm:p-6"><div className="mb-5"><h2 className="font-semibold">Review suggestions</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Suggestions never change the estimate automatically. Check the evidence, procedures and vehicle before making a decision.</p></div>{currentChecks.length === 0 ? <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-6 text-center"><div><Sparkles className="mx-auto size-9 text-[var(--muted)]" /><p className="mt-4 font-medium">No Smart second-pass review yet</p><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Complete the draft estimate and repair-rule review first, then run this pass to surface possible legitimate omissions.</p></div></div> : <div className="space-y-3">{currentChecks.map((check) => { const Icon = iconFor(check.severity); const evidence = check.evidence && !Array.isArray(check.evidence) ? check.evidence as Record<string, unknown> : {}; return <article key={check.id} className={`rounded-2xl border p-4 ${check.resolution ? "border-[var(--border)] bg-[var(--surface-2)] opacity-75" : check.severity === "blocking" ? "border-red-200 bg-red-50" : check.severity === "review" ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-[var(--brand-strong)]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{check.title}</h3><span className="rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] uppercase text-[var(--muted)]">{check.severity}</span>{check.resolution ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">{String(check.resolution).replaceAll("_", " ")}</span> : null}</div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{check.detail}</p>{evidence.rationale ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]"><strong className="text-[var(--text)]">Why:</strong> {String(evidence.rationale)}</p> : null}{!check.resolution ? <form action={resolveAction} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="check_id" value={check.id} />{[["already_included","Already included"],["added","Added"],["edited","Edited estimate"],["not_required","Not required"],["acknowledged","Acknowledge"]].map(([value,label]) => <button key={value} name="resolution" value={value} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--surface-2)]">{label}</button>)}</form> : null}</div></div></article>; })}</div>}</section>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start"><section className="app-card p-5"><h2 className="font-semibold">Latest analysis</h2>{latestRun ? <dl className="mt-4 space-y-3 text-sm"><InfoRow label="Status" value={String(latestRun.status).replaceAll("_", " ")} /><InfoRow label="Completed" value={latestRun.completed_at ? new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(latestRun.completed_at)) : "In progress"} /><InfoRow label="Processing time" value={latestRun.latency_ms != null ? `${(latestRun.latency_ms / 1000).toFixed(1)} sec` : "—"} /></dl> : <p className="mt-3 text-sm text-[var(--muted)]">No review recorded.</p>}</section><section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-semibold">Human approval boundary</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Smart review cannot add charges, approve a repair or issue an insurer estimate. It creates checks that a workshop user accepts, rejects or resolves.</p></section></aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <article className="app-card p-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></article>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">{label}</dt><dd className="max-w-44 truncate text-right font-medium" title={value}>{value}</dd></div>; }
