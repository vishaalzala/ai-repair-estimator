import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, CircleAlert, Info, RefreshCw, Sparkles } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { resolveReviewCheck } from "../actions";
import { runOpenAiEstimateReview } from "./actions";

function iconFor(severity: string) {
  if (severity === "blocking") return CircleAlert;
  if (severity === "review") return AlertTriangle;
  if (severity === "information") return Info;
  return CheckCircle2;
}

export default async function OpenAiReviewPage({
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
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("ai_review_checks").select("id, title, detail, severity, evidence, resolution, resolved_at, ai_run_id, created_at").eq("organization_id", organizationId).eq("job_id", job.id).eq("source_type", "ai").order("created_at", { ascending: false }),
    supabase.from("ai_analysis_runs").select("id, model, status, input_tokens, cached_input_tokens, output_tokens, latency_ms, created_at, completed_at").eq("organization_id", organizationId).eq("job_id", job.id).eq("task", "estimate_review").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const vehicle = vehicleResult.data;
  const checks = checksResult.data ?? [];
  const latestRun = runResult.data;
  const currentChecks = latestRun ? checks.filter((check) => check.ai_run_id === latestRun.id) : [];
  const openChecks = currentChecks.filter((check) => !check.resolution);
  const resolved = currentChecks.filter((check) => Boolean(check.resolution));
  const configured = Boolean(process.env.OPENAI_API_KEY && process.env.AI_REVIEW_MODEL);
  const runAction = runOpenAiEstimateReview.bind(null, job.id);
  const resolveAction = resolveReviewCheck.bind(null, job.id);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Bot className="size-4" /> OpenAI second pass</div><h1 className="text-3xl font-semibold tracking-tight">What might be missing?</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Reviews the current estimate, accepted damage context, parts, rules and scoped knowledge.</p></div><form action={runAction}><button disabled={!configured} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e] disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="size-4" /> Run OpenAI review</button></form></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}
      {!configured ? <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">The OpenAI review is code-complete but disabled until <code>OPENAI_API_KEY</code> and <code>AI_REVIEW_MODEL</code> are set securely in the deployment environment.</div> : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Open checks" value={openChecks.length} /><Metric label="Blocking" value={openChecks.filter((check) => check.severity === "blocking").length} /><Metric label="Resolved by estimator" value={resolved.length} /></section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div className="mb-5"><h2 className="font-semibold">AI suggestions</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">No suggestion changes the estimate automatically. Use the estimator decision buttons after checking evidence, procedures and the vehicle.</p></div>{currentChecks.length === 0 ? <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[#091322] px-6 text-center"><div><Sparkles className="mx-auto size-9 text-[var(--muted)]" /><p className="mt-4 font-medium">No OpenAI second-pass review yet</p><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Run deterministic repair rules first, complete the draft estimate, then use this second pass to surface possible legitimate omissions and unresolved inspections.</p></div></div> : <div className="space-y-3">{currentChecks.map((check) => { const Icon = iconFor(check.severity); const evidence = check.evidence && !Array.isArray(check.evidence) ? check.evidence as Record<string, unknown> : {}; const sourceRefs = Array.isArray(evidence.source_refs) ? evidence.source_refs.map(String) : []; return <article key={check.id} className={`rounded-2xl border p-4 ${check.resolution ? "border-[var(--border)] bg-[#091322] opacity-70" : check.severity === "blocking" ? "border-red-400/25 bg-red-400/5" : check.severity === "review" ? "border-amber-300/20 bg-amber-300/5" : "border-sky-300/15 bg-sky-300/5"}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{check.title}</h3><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase text-[var(--muted)]">{check.severity}</span>{check.resolution ? <span className="rounded-full bg-[rgba(88,211,178,0.08)] px-2 py-0.5 text-[10px] text-[var(--brand)]">{String(check.resolution).replaceAll("_", " ")}</span> : null}</div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{check.detail}</p>{evidence.rationale ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]"><strong className="text-white">Why:</strong> {String(evidence.rationale)}</p> : null}{sourceRefs.length ? <p className="mt-2 text-[11px] text-[var(--muted)]">Sources: {sourceRefs.join(", ")}</p> : null}{typeof evidence.confidence === "number" ? <p className="mt-1 text-[11px] text-[var(--muted)]">Model confidence: {Math.round(evidence.confidence * 100)}% — confidence is not approval.</p> : null}{!check.resolution ? <form action={resolveAction} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="check_id" value={check.id} /><button name="resolution" value="already_included" className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-white/5">Already included</button><button name="resolution" value="added" className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-white/5">Added</button><button name="resolution" value="edited" className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-white/5">Edited estimate</button><button name="resolution" value="not_required" className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-white/5">Not required</button><button name="resolution" value="acknowledged" className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-white/5">Acknowledge</button></form> : null}</div></div></article>; })}</div>}</section>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Latest AI run</h2>{latestRun ? <dl className="mt-4 space-y-3 text-sm"><InfoRow label="Model" value={latestRun.model} /><InfoRow label="Status" value={latestRun.status} /><InfoRow label="Input tokens" value={latestRun.input_tokens?.toLocaleString() ?? "—"} /><InfoRow label="Cached" value={latestRun.cached_input_tokens?.toLocaleString() ?? "—"} /><InfoRow label="Output tokens" value={latestRun.output_tokens?.toLocaleString() ?? "—"} /><InfoRow label="Latency" value={latestRun.latency_ms != null ? `${(latestRun.latency_ms / 1000).toFixed(1)} sec` : "—"} /></dl> : <p className="mt-3 text-sm text-[var(--muted)]">No run recorded.</p>}</section><section className="rounded-2xl border border-[var(--brand)]/25 bg-[rgba(88,211,178,0.06)] p-5"><h2 className="font-semibold">Human approval boundary</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">OpenAI cannot add charges, approve a repair or issue an insurer estimate. It only creates review checks that a workshop user accepts, rejects or resolves.</p></section></aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></article>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">{label}</dt><dd className="max-w-44 truncate text-right font-medium" title={value}>{value}</dd></div>; }
