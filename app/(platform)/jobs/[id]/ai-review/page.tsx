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
  if (severity === "blocking") return "border-red-400/30 bg-red-400/5 text-red-100";
  if (severity === "review") return "border-amber-300/25 bg-amber-300/5 text-amber-100";
  if (severity === "pass") return "border-[var(--brand)]/30 bg-[rgba(88,211,178,0.06)] text-[var(--brand)]";
  return "border-sky-300/20 bg-sky-300/5 text-sky-100";
}

export default async function AiReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, status, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const [vehicleResult, checkResult, estimateResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year, adas_present").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
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
    pass: checks.filter((check) => check.severity === "pass").length,
  };
  const rulesAction = runRulesReview.bind(null, job.id);
  const resolveAction = resolveReviewCheck.bind(null, job.id);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Sparkles className="size-4" /> Estimator-controlled review</div><h1 className="text-3xl font-semibold tracking-tight">Estimate review</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Deterministic rules now, OpenAI review added as a separate evidence-linked layer.</p></div><form action={rulesAction}><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><RefreshCw className="size-4" /> Run repair rules review</button></form></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Blocking" value={counts.blocking} note="Must resolve before final issue" />
        <Metric label="Requires review" value={counts.review} note="Estimator decision needed" />
        <Metric label="Information" value={counts.information} note="Contextual checks" />
        <Metric label="Resolved" value={resolved.length} note="Human decisions recorded" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="mb-5"><h2 className="font-semibold">Open review checks</h2><p className="mt-1 text-xs text-[var(--muted)]">These are prompts to review legitimate work or evidence. They are not automatically added to the estimate.</p></div>
          {!estimateResult.data ? <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Build the manual estimate before relying on the final review workflow. <Link href={`/jobs/${job.id}/estimate`} className="font-semibold underline">Open estimate</Link></div> : null}
          {unresolved.length === 0 ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[#091322] px-6 text-center"><div><ShieldCheck className="mx-auto size-9 text-[var(--brand)]" /><p className="mt-4 font-medium">No unresolved checks</p><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Run the repair rules review after the estimate or evidence changes. AI review will later add a separate set of evidence-linked suggestions.</p></div></div> : <div className="space-y-3">{unresolved.map((check) => { const Icon = severityIcon(check.severity); const evidence = Array.isArray(check.evidence) ? check.evidence[0] as Record<string, unknown> | undefined : undefined; return <article key={check.id} className={`rounded-2xl border p-4 ${severityClass(check.severity)}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 size-5 shrink-0" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{check.title}</h3><span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">{check.severity}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[var(--muted)]">{check.source_type || "review"}</span></div>{check.detail ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{check.detail}</p> : null}{evidence?.rule_name ? <p className="mt-2 text-[11px] text-[var(--muted)]">Source: {String(evidence.rule_name)}{evidence.enforcement ? ` · ${String(evidence.enforcement).replaceAll("_", " ")}` : ""}</p> : null}<form action={resolveAction} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="check_id" value={check.id} /><button name="resolution" value="already_included" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/5">Already included</button><button name="resolution" value="added" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/5">Added to estimate</button><button name="resolution" value="not_required" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/5">Not required</button><button name="resolution" value="acknowledged" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/5">Acknowledge</button></form></div></div></article>; })}</div>}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Review summary</h2><div className="mt-4 grid grid-cols-2 gap-2"><SummaryCell label="Blocking" value={counts.blocking} /><SummaryCell label="Review" value={counts.review} /><SummaryCell label="Information" value={counts.information} /><SummaryCell label="Resolved" value={resolved.length} /></div><p className="mt-4 text-xs leading-5 text-[var(--muted)]">We deliberately do not show a made-up “AI accuracy percentage.” Final readiness is based on explicit checks, evidence and estimator decisions.</p></section>
          <section className="rounded-2xl border border-[var(--brand)]/25 bg-[rgba(88,211,178,0.06)] p-5"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" /><div><h2 className="font-semibold">OpenAI layer</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">The provider-neutral AI service will add photo-based damage findings and “what might be missing?” suggestions. It will not overwrite these deterministic repair checks or pricing calculations.</p></div></div></section>
          {resolved.length ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Recent decisions</h2><div className="mt-4 space-y-3">{resolved.slice(0, 8).map((check) => <div key={check.id} className="border-l border-[var(--border)] pl-3"><p className="text-sm font-medium">{check.title}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{String(check.resolution).replaceAll("_", " ")}{check.resolved_at ? ` · ${new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(check.resolved_at))}` : ""}</p></div>)}</div></section> : null}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-xs text-[var(--muted)]">{label}</p><div className="mt-3 flex items-end justify-between gap-3"><strong className="text-3xl">{value}</strong><span className="max-w-28 text-right text-[10px] leading-4 text-[var(--muted)]">{note}</span></div></article>;
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-[var(--border)] bg-[#091322] p-3 text-center"><div className="text-xl font-semibold">{value}</div><div className="mt-1 text-[10px] text-[var(--muted)]">{label}</div></div>;
}
