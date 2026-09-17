"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Archive, CheckCircle2, FileText, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { INSURANCE_CUSTOMERS } from "@/lib/insurance/insurers";
import { approveExtractedTrainingCase } from "@/app/admin/(panel)/knowledge/training-actions";

const quoteExtensions = new Set(["pdf", "docx", "txt", "md"]);
const maxQuoteBytes = 25 * 1024 * 1024;
const maxZipBytes = 120 * 1024 * 1024;

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-140);
}

export function TrainingCaseBundleUploader({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ), []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [readyCaseId, setReadyCaseId] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const quote = formData.get("quote");
    const archive = formData.get("photos_zip");
    const insurerName = String(formData.get("insurer_name") ?? "").trim();
    if (!(quote instanceof File) || !(archive instanceof File)) return;

    setReadyCaseId(null);
    if (!quoteExtensions.has(extension(quote.name))) {
      setStatus("Quote must be PDF, DOCX, TXT or Markdown.");
      return;
    }
    if (quote.size <= 0 || quote.size > maxQuoteBytes) {
      setStatus("Keep the quote at 25 MB or less.");
      return;
    }
    if (extension(archive.name) !== "zip") {
      setStatus("Damage photos must be supplied as a ZIP archive.");
      return;
    }
    if (archive.size <= 0 || archive.size > maxZipBytes) {
      setStatus("Keep the photo ZIP at 120 MB or less.");
      return;
    }

    setBusy(true);
    setStatus("Creating a draft Training Case…");
    const temporaryTitle = quote.name.replace(/\.[^.]+$/, "") || "Uploaded approved estimate";
    const { data: trainingCase, error: caseError } = await supabase.from("estimator_training_cases").insert({
      scope: "global",
      organization_id: null,
      title: temporaryTitle,
      source_type: "approved_estimate_upload",
      source_document_name: quote.name,
      source_document_mime_type: quote.type || "application/octet-stream",
      source_photo_archive_name: archive.name,
      status: "draft",
      insurer_name: insurerName || null,
      damage_summary: "Processing uploaded quote and damage photos for administrator review.",
      estimator_lessons: null,
      photo_count: 0,
      ingestion_status: "pending",
      ingestion_error: null,
      created_by: userId,
    }).select("id").single();

    if (caseError || !trainingCase) {
      setBusy(false);
      setStatus("Unable to create the draft Training Case.");
      return;
    }

    const basePath = `admin-global/training-cases/${trainingCase.id}`;
    const quotePath = `${basePath}/quote-${crypto.randomUUID()}-${safeFileName(quote.name)}`;
    const archivePath = `${basePath}/photos-${crypto.randomUUID()}-${safeFileName(archive.name)}`;
    const uploadedPaths: string[] = [];

    try {
      setStatus("Uploading final quote…");
      const { error: quoteUploadError } = await supabase.storage.from("knowledge-documents").upload(quotePath, quote, {
        contentType: quote.type || undefined,
        upsert: false,
      });
      if (quoteUploadError) throw new Error("Quote upload failed.");
      uploadedPaths.push(quotePath);

      setStatus("Uploading damage-photo ZIP…");
      const { error: zipUploadError } = await supabase.storage.from("knowledge-documents").upload(archivePath, archive, {
        contentType: archive.type || "application/zip",
        upsert: false,
      });
      if (zipUploadError) throw new Error("Photo ZIP upload failed.");
      uploadedPaths.push(archivePath);

      const { error: updateError } = await supabase.from("estimator_training_cases").update({
        source_document_storage_path: quotePath,
        source_photo_archive_storage_path: archivePath,
        ingestion_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", trainingCase.id);
      if (updateError) throw new Error("Uploaded files could not be registered.");

      setStatus("Reading the quote and matching damage photos…");
      const response = await fetch("/api/admin/knowledge/training-case-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: trainingCase.id }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string; caseId?: string };
      if (!response.ok) throw new Error(result.message || "Training Case extraction failed.");

      setReadyCaseId(result.caseId || trainingCase.id);
      setStatus(result.message || "Training Case ready for approval.");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process the Training Case.";
      await supabase.from("estimator_training_cases").update({
        ingestion_status: "failed",
        ingestion_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", trainingCase.id);
      if (uploadedPaths.length) await supabase.storage.from("knowledge-documents").remove(uploadedPaths);
      setStatus(message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <form action={submit} className="grid gap-4 rounded-2xl border border-[var(--brand)]/30 bg-[linear-gradient(145deg,rgba(88,211,178,0.09),rgba(12,25,42,0.97)_48%)] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[rgba(88,211,178,0.12)] text-[var(--brand)]"><Sparkles className="size-5" /></span>
          <div>
            <h2 className="font-semibold">Learn from damage photos + final quote</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">Upload one ZIP containing the matching damage photos and the final human-approved quote/estimate. AI extracts the vehicle, visible damage, approved line structure and reusable estimator lessons into a draft Training Case. Nothing becomes global estimator memory until you approve it.</p>
          </div>
        </div>

        <label className="grid gap-1.5 text-xs text-[var(--muted)]">Insurer / job type <span className="text-[10px]">(optional)</span>
          <select name="insurer_name" defaultValue="" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--brand)]">
            <option value="">Auto-detect from quote</option>
            {INSURANCE_CUSTOMERS.map((insurer) => <option key={insurer} value={insurer}>{insurer}</option>)}
          </select>
        </label>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="grid gap-2 rounded-xl border border-[var(--border)] bg-[#091322] p-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-2 font-semibold text-white"><Archive className="size-4 text-[var(--brand)]" /> Damage photos ZIP</span>
            <span>JPG, PNG and WebP are used for visual learning. HEIC/HEIF remain recorded in the source archive.</span>
            <input name="photos_zip" type="file" accept=".zip,application/zip" required disabled={busy} className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-3)] file:px-3 file:py-2 file:text-white disabled:opacity-50" />
            <span className="text-[10px]">Maximum ZIP size: 120 MB</span>
          </label>

          <label className="grid gap-2 rounded-xl border border-[var(--border)] bg-[#091322] p-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-2 font-semibold text-white"><FileText className="size-4 text-[var(--brand)]" /> Final approved quote / estimate</span>
            <span>The quote is the authoritative source for the approved estimate line structure. Historical prices/hours may be retained for audit but are not taught as future default pricing.</span>
            <input name="quote" type="file" accept=".pdf,.docx,.txt,.md" required disabled={busy} className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-3)] file:px-3 file:py-2 file:text-white disabled:opacity-50" />
            <span className="text-[10px]">PDF, DOCX, TXT or Markdown · maximum 25 MB</span>
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-5 text-[var(--muted)]">After extraction, review the new draft in <strong className="text-white">Training Cases</strong>, then approve it below to publish it into estimator memory.</p>
          <button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[#06110e] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? "Learning from files…" : "Upload & build Training Case"}
          </button>
        </div>
        {status ? <p aria-live="polite" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-xs text-[var(--muted)]">{status}</p> : null}
      </form>

      {readyCaseId ? (
        <form action={approveExtractedTrainingCase} className="flex flex-col gap-3 rounded-2xl border border-[var(--brand)]/40 bg-[rgba(88,211,178,0.08)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <input type="hidden" name="training_case_id" value={readyCaseId} />
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" /><div><div className="text-sm font-semibold">Training Case extracted and ready</div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Review the draft case details on this page. When satisfied, publish its price-neutral structure and lessons to future estimates.</p></div></div>
          <button className="shrink-0 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Approve & Teach Estimator</button>
        </form>
      ) : null}
    </div>
  );
}
