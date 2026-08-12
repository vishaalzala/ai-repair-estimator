"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, FileImage, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createQuickJob } from "@/app/(platform)/jobs/actions";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxBytes = 25 * 1024 * 1024;
const maxFiles = 20;

function safeFileName(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  return `${crypto.randomUUID()}${extension}`;
}

export function QuickIntake({ organizationId, userId }: { organizationId: string; userId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [registration, setRegistration] = useState("");
  const [vin, setVin] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function chooseFiles(nextFiles: File[]) {
    const valid = nextFiles.filter((file) => allowedTypes.has(file.type) && file.size > 0 && file.size <= maxBytes);
    const merged = [...files, ...valid].slice(0, maxFiles);
    setFiles(merged);
    if (valid.length !== nextFiles.length) setStatus("Some files were skipped. Use JPG, PNG, WebP, HEIC or HEIF up to 25 MB each.");
    else setStatus(null);
  }

  async function startQuickIntake() {
    if (!files.length) {
      setStatus("Add at least one vehicle photo to start AI Quick Intake.");
      return;
    }

    setWorking(true);
    setStatus("Creating assessment…");
    let jobId: string | null = null;

    try {
      const created = await createQuickJob({
        registration,
        vin,
        make,
        model,
        modelYear,
        accidentDescription: notes,
      });
      jobId = created.jobId;

      const supabase = createClient();
      setStatus(`Uploading ${files.length} photo${files.length === 1 ? "" : "s"} securely…`);

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const path = `${organizationId}/${jobId}/originals/${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;

        const { error: rowError } = await supabase.from("photos").insert({
          organization_id: organizationId,
          job_id: jobId,
          category: index === 0 ? "identification" : "accident_damage",
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          storage_path_original: path,
          processing_status: "ready",
          created_by: userId,
        });

        if (rowError) {
          await supabase.storage.from("job-files").remove([path]);
          throw rowError;
        }
      }

      setStatus("Reading vehicle details and preparing the draft estimate…");
      const response = await fetch(`/api/jobs/${jobId}/ai-intake`, { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok && response.status !== 202) {
        setStatus(result.message ?? "Photos are saved, but AI intake could not finish. Opening the draft estimate.");
      } else {
        setStatus(result.message ?? "AI Quick Intake complete. Opening the draft estimate…");
      }

      router.push(`/jobs/${jobId}/estimate`);
      router.refresh();
    } catch (error) {
      console.error("AI Quick Intake failed", error);
      if (jobId) {
        setStatus("The assessment was created, but intake stopped while uploading or analysing photos. Opening the job so nothing is lost.");
        router.push(`/jobs/${jobId}/photos`);
        router.refresh();
      } else {
        setStatus(error instanceof Error ? error.message : "Unable to start AI Quick Intake right now.");
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--brand)]/30 bg-[linear-gradient(145deg,rgba(88,211,178,0.10),rgba(12,25,42,0.96)_38%)] shadow-2xl shadow-black/10">
      <div className="border-b border-[var(--border)] px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-[#06110e]"><Sparkles className="size-5" /></span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">AI Quick Intake</div>
            <h2 className="mt-1 text-xl font-semibold">Upload the car. Start the estimate.</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">Add vehicle photos and anything you already know. Customer details can stay completely empty. AI will read supported vehicle details, identify visible damage and prepare draft repair operations for estimator review.</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        <div
          className="grid min-h-44 cursor-pointer place-items-center rounded-2xl border border-dashed border-[var(--brand)]/45 bg-[#07111f]/70 px-5 text-center transition hover:border-[var(--brand)]"
          onClick={() => !working && fileRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!working) chooseFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div>
            <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-[var(--surface-3)] text-[var(--brand)]"><Camera className="size-5" /></div>
            <p className="mt-3 text-sm font-semibold">Drop vehicle photos here, or click to choose</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Up to {maxFiles} images · JPG, PNG, WebP, HEIC or HEIF · 25 MB each</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            multiple
            className="hidden"
            disabled={working}
            onChange={(event) => chooseFiles(Array.from(event.target.files ?? []))}
          />
        </div>

        {files.length ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[#091322]/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs"><span className="font-semibold">{files.length} photo{files.length === 1 ? "" : "s"} ready</span><span className="text-[var(--muted)]">{(totalSize / 1024 / 1024).toFixed(1)} MB</span></div>
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span key={`${file.name}-${file.lastModified}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs text-[var(--muted)]">
                  <FileImage className="size-3.5 shrink-0" /><span className="max-w-48 truncate">{file.name}</span>
                  <button type="button" disabled={working} aria-label={`Remove ${file.name}`} onClick={(event) => { event.stopPropagation(); setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} className="text-[var(--muted)] hover:text-white"><X className="size-3.5" /></button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <label className="grid gap-2 text-sm">
            <span className="text-xs font-medium text-[var(--muted)]">Anything you already know <span className="font-normal">(optional)</span></span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} disabled={working} className="rounded-2xl border border-[var(--border)] bg-[#091322] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)]" placeholder="Example: front left impact, insurer assessment, warning light on dash…" />
          </label>
        </div>

        <details className="rounded-2xl border border-[var(--border)] bg-[#091322]/70">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Add known vehicle details <span className="text-xs font-normal text-[var(--muted)]">(optional — AI fills blanks only)</span></summary>
          <div className="grid gap-4 border-t border-[var(--border)] p-4 md:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Registration<input value={registration} onChange={(event) => setRegistration(event.target.value.toUpperCase())} disabled={working} className="rounded-xl border border-[var(--border)] bg-[#07111f] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--brand)]" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">VIN<input value={vin} onChange={(event) => setVin(event.target.value.toUpperCase())} disabled={working} className="rounded-xl border border-[var(--border)] bg-[#07111f] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--brand)]" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Year<input value={modelYear} onChange={(event) => setModelYear(event.target.value)} inputMode="numeric" disabled={working} className="rounded-xl border border-[var(--border)] bg-[#07111f] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--brand)]" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Make<input value={make} onChange={(event) => setMake(event.target.value)} disabled={working} className="rounded-xl border border-[var(--border)] bg-[#07111f] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--brand)]" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Model<input value={model} onChange={(event) => setModel(event.target.value)} disabled={working} className="rounded-xl border border-[var(--border)] bg-[#07111f] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--brand)]" /></label>
          </div>
        </details>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs leading-5 text-[var(--muted)]">
            <p>Customer name is not required. AI suggestions remain unverified until an estimator reviews them.</p>
            {status ? <p aria-live="polite" className="mt-1 text-[var(--brand)]">{status}</p> : null}
          </div>
          <button type="button" onClick={startQuickIntake} disabled={working || !files.length} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-50">
            {working ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {working ? "Building draft…" : "Start AI estimate"}
          </button>
        </div>
      </div>
    </section>
  );
}
