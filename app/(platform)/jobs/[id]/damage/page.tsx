import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Camera, Check, Eye, RefreshCw, Sparkles, X } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { reviewDamageFinding, runDamageAnalysis } from "./actions";

function confidenceLabel(value: number | string | null) {
  if (value == null) return "Unknown";
  const number = Number(value);
  if (number >= 0.8) return "High";
  if (number >= 0.55) return "Medium";
  return "Low";
}

export default async function DamagePage({
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
    .select("id, job_number, vehicle_id, status")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const [vehicleResult, runResult, findingResult, photoResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year, adas_present").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("ai_analysis_runs").select("id, model, status, input_tokens, cached_input_tokens, output_tokens, latency_ms, created_at, completed_at").eq("organization_id", organizationId).eq("job_id", job.id).eq("task", "damage_analysis").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("damage_findings").select("id, ai_run_id, impact_area, component, side, observed_damage, suggested_action, confidence, review_status, reviewed_at, created_at").eq("organization_id", organizationId).eq("job_id", job.id).order("created_at", { ascending: false }),
    supabase.from("photos").select("id, category, file_name, mime_type, storage_path_original").eq("organization_id", organizationId).eq("job_id", job.id),
  ]);

  const vehicle = vehicleResult.data;
  const latestRun = runResult.data;
  const allFindings = findingResult.data ?? [];
  const findings = latestRun ? allFindings.filter((finding) => finding.ai_run_id === latestRun.id) : allFindings;
  const photos = photoResult.data ?? [];
  const findingIds = findings.map((finding) => finding.id);
  const { data: evidenceData } = findingIds.length
    ? await supabase.from("damage_evidence").select("finding_id, photo_id, note").eq("organization_id", organizationId).in("finding_id", findingIds)
    : { data: [] };
  const evidence = evidenceData ?? [];
  const evidencePhotoIds = [...new Set(evidence.map((row) => row.photo_id))];
  const evidencePhotos = photos.filter((photo) => evidencePhotoIds.includes(photo.id));
  const signedEntries = await Promise.all(evidencePhotos.map(async (photo) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.mime_type)) return [photo.id, null] as const;
    const { data } = await supabase.storage.from("job-files").createSignedUrl(photo.storage_path_original, 60 * 15);
    return [photo.id, data?.signedUrl ?? null] as const;
  }));
  const signedByPhotoId = new Map(signedEntries);
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  const configured = Boolean(process.env.OPENAI_API_KEY && process.env.AI_DAMAGE_MODEL);
  const runAction = runDamageAnalysis.bind(null, job.id);
  const reviewAction = reviewDamageFinding.bind(null, job.id);
  const pending = findings.filter((finding) => finding.review_status === "pending").length;
  const accepted = findings.filter((finding) => finding.review_status === "accepted").length;
  const rejected = findings.filter((finding) => finding.review_status === "rejected").length;
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Sparkles className="size-4" /> OpenAI visible-damage draft</div><h1 className="text-3xl font-semibold tracking-tight">Damage review</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · LH/RH always use the vehicle perspective.</p></div><form action={runAction}><button type="submit" disabled={!configured} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e] disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="size-4" /> {latestRun ? "Run analysis again" : "Analyse vehicle photos"}</button></form></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}
      {!configured ? <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">OpenAI is intentionally disabled until the deployment has a secure <code>OPENAI_API_KEY</code> and <code>AI_DAMAGE_MODEL</code>. Do not place the key in GitHub or client-side code.</div> : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Pending review" value={pending} /><Metric label="Accepted" value={accepted} /><Metric label="Rejected" value={rejected} /></section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="mb-5"><h2 className="font-semibold">Visible-damage findings</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">AI findings are preliminary. Accept, reject or later modify them before they influence repair planning.</p></div>
          {findings.length === 0 ? <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[#091322] px-6 text-center"><div><Camera className="mx-auto size-9 text-[var(--muted)]" /><p className="mt-4 font-medium">No AI damage findings yet</p><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Upload wide and close-up accident photos, then run the analysis. Hidden damage must remain an inspection recommendation unless it becomes visible after strip-down.</p><Link href={`/jobs/${job.id}/photos`} className="mt-4 inline-flex text-sm font-semibold text-[var(--brand)]">Open vehicle photos →</Link></div></div> : <div className="space-y-4">{findings.map((finding) => {
            const findingEvidence = evidence.filter((row) => row.finding_id === finding.id);
            return <article key={finding.id} className="rounded-2xl border border-[var(--border)] bg-[#091322] p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{[finding.side, finding.component].filter(Boolean).join(" ")}</h3><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">{finding.suggested_action.replaceAll("_", " ")}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${finding.review_status === "accepted" ? "bg-[rgba(88,211,178,0.12)] text-[var(--brand)]" : finding.review_status === "rejected" ? "bg-red-400/10 text-red-200" : "bg-amber-300/10 text-amber-100"}`}>{finding.review_status}</span></div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{finding.observed_damage}</p><div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]"><span>Impact: {finding.impact_area || "—"}</span><span>Confidence: {confidenceLabel(finding.confidence)}</span></div></div>{finding.review_status === "pending" ? <form action={reviewAction} className="flex shrink-0 gap-2"><input type="hidden" name="finding_id" value={finding.id} /><button name="decision" value="accepted" className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand)]/25 px-2.5 py-1.5 text-xs font-semibold text-[var(--brand)] hover:bg-[rgba(88,211,178,0.08)]"><Check className="size-3.5" /> Accept</button><button name="decision" value="rejected" className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-400/5"><X className="size-3.5" /> Reject</button></form> : null}</div>
              {findingEvidence.length ? <div className="mt-4 border-t border-[var(--border)] pt-4"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><Eye className="size-3.5" /> Evidence photos</div><div className="flex gap-2 overflow-x-auto">{findingEvidence.map((row) => { const photo = photoById.get(row.photo_id); const signedUrl = signedByPhotoId.get(row.photo_id); return <div key={`${finding.id}-${row.photo_id}`} className="w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">{signedUrl ? <div className="relative aspect-[4/3]"><Image src={signedUrl} alt={`Evidence for ${finding.component}`} fill sizes="112px" className="object-cover" /></div> : <div className="grid aspect-[4/3] place-items-center text-[10px] text-[var(--muted)]">Stored</div>}<p className="truncate px-2 py-1.5 text-[9px] text-[var(--muted)]" title={photo?.file_name}>{photo?.file_name || row.photo_id}</p></div>; })}</div></div> : null}
            </article>;
          })}</div>}
        </section>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Latest AI run</h2>{latestRun ? <dl className="mt-4 space-y-3 text-sm"><Info label="Model" value={latestRun.model} /><Info label="Status" value={latestRun.status} /><Info label="Input tokens" value={latestRun.input_tokens?.toLocaleString() ?? "—"} /><Info label="Cached input" value={latestRun.cached_input_tokens?.toLocaleString() ?? "—"} /><Info label="Output tokens" value={latestRun.output_tokens?.toLocaleString() ?? "—"} /><Info label="Latency" value={latestRun.latency_ms != null ? `${(latestRun.latency_ms / 1000).toFixed(1)} sec` : "—"} /></dl> : <p className="mt-3 text-sm text-[var(--muted)]">No analysis has been run.</p>}</section>
          <section className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-200" /><div><h2 className="font-semibold">Visible evidence only</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">AI must not assert hidden structural, SRS or mechanical damage from a photo alone. Where evidence is weak, the correct result is an inspection or check-after-strip recommendation.</p></div></div></section>
          {vehicle?.adas_present ? <section className="rounded-2xl border border-sky-300/20 bg-sky-300/5 p-5"><p className="text-sm font-semibold">ADAS noted on vehicle</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Damage analysis does not decide calibration requirements. The deterministic and AI estimate review layers handle that as a separate required review.</p></section> : null}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></article>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-[var(--muted)]">{label}</dt><dd className="max-w-44 truncate text-right font-medium" title={value}>{value}</dd></div>;
}
