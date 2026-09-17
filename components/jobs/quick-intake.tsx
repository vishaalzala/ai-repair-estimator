"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, FileImage, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createQuickJob } from "@/app/(platform)/jobs/actions";
import { PreparingEstimateOverlay } from "@/components/jobs/preparing-estimate-overlay";
import { INSURANCE_CUSTOMERS, PRIVATE_JOB_OPTION } from "@/lib/insurance/insurers";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxBytes = 25 * 1024 * 1024;
const maxFiles = 20;

function safeFileName(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  return `${crypto.randomUUID()}${extension}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type EstimateStatus = {
  status?: "preparing" | "completed" | "failed";
  stage?: string;
  message?: string;
  itemCount?: number;
  error?: string | null;
};

const lightInputClass = "rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";

export function QuickIntake({ organizationId, userId }: { organizationId: string; userId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [registration, setRegistration] = useState("");
  const [vin, setVin] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [backgroundJobId, setBackgroundJobId] = useState<string | null>(null);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function chooseFiles(nextFiles: File[]) {
    const valid = nextFiles.filter((file) => allowedTypes.has(file.type) && file.size > 0 && file.size <= maxBytes);
    const merged = [...files, ...valid].slice(0, maxFiles);
    setFiles(merged);
    if (valid.length !== nextFiles.length) setStatus("Some files were skipped. Use JPG, PNG, WebP, HEIC or HEIF up to 25 MB each.");
    else setStatus(null);
  }

  async function waitForEstimate(jobId: string, startedAt: string) {
    let temporaryErrors = 0;
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await sleep(1800);
      try {
        const response = await fetch(`/api/jobs/${jobId}/ai-estimate/status?since=${encodeURIComponent(startedAt)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Status request failed (${response.status})`);
        const result = (await response.json()) as EstimateStatus;
        temporaryErrors = 0;
        if (result.message) setStatus(result.message);
        if (result.status === "completed") return result;
        if (result.status === "failed") throw new Error(result.error || result.message || "AI estimate generation failed");
      } catch (error) {
        temporaryErrors += 1;
        if (temporaryErrors >= 5) throw error;
      }
    }

    return {
      status: "preparing" as const,
      message: "The estimate is still running in the background. You can open the job and return when it is ready.",
    };
  }

  async function startQuickIntake() {
    if (!files.length) {
      setStatus("Add at least one vehicle photo to start AI Quick Intake.");
      return;
    }
    if (!insurerName) {
      setStatus("Select an insurer or Private Job before starting the estimate.");
      return;
    }

    setWorking(true);
    setStatus("Creating assessment…");
    setBackgroundJobId(null);
    let jobId: string | null = null;

    try {
      const created = await createQuickJob({
        registration,
        vin,
        make,
        model,
        modelYear,
        insurerName,
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

      setStatus("Starting the AI estimator…");
      const startResponse = await fetch(`/api/jobs/${jobId}/ai-estimate/start`, { method: "POST" });
      const startResult = (await startResponse.json().catch(() => ({}))) as { startedAt?: string; message?: string };
      if (!startResponse.ok || !startResult.startedAt) {
        throw new Error(startResult.message ?? "Unable to start the AI estimator.");
      }

      setBackgroundJobId(jobId);
      setStatus("Reading the vehicle, damage photos, insurer context and your notes…");
      const result = await waitForEstimate(jobId, startResult.startedAt);

      if (result.status === "completed") {
        setStatus(result.message ?? "Estimate ready. Opening it now…");
        router.push(`/jobs/${jobId}/estimate?message=${encodeURIComponent(result.message ?? "AI estimate ready for review")}`);
        router.refresh();
        return;
      }

      setStatus(result.message ?? "The estimate is still running in the background.");
      router.push(`/jobs/${jobId}`);
      router.refresh();
    } catch (error) {
      console.error("AI Quick Intake failed", error);
      const message = error instanceof Error ? error.message : "Unable to start AI Quick Intake right now.";
      setStatus(message);
      setWorking(false);
      if (jobId) {
        router.push(`/jobs/${jobId}/estimate?error=${encodeURIComponent(message)}`);
        router.refresh();
      }
    }
  }

  return (
    <>
      {working ? (
        <PreparingEstimateOverlay
          message={status ?? "Preparing the estimate…"}
          canContinueInBackground={Boolean(backgroundJobId)}
          onContinueInBackground={backgroundJobId ? () => {
            router.push(`/jobs/${backgroundJobId}`);
            router.refresh();
          } : undefined}
        />
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5">
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-white px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-sm"><Sparkles className="size-5" /></span>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">AI Quick Intake</div>
              <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Upload the car. Start the estimate.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Add vehicle photos, select the insurer or Private Job, and enter anything you already know. The selected insurer is saved before processing so insurer-specific estimating intelligence can be applied as that memory grows.</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div
            className="grid min-h-44 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-5 text-center transition hover:border-emerald-500 hover:bg-emerald-50"
            onClick={() => !working && fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!working) chooseFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100"><Camera className="size-5" /></div>
              <p className="mt-3 text-base font-semibold text-slate-900">Drop vehicle photos here, or click to upload</p>
              <p className="mt-1.5 text-sm text-slate-600">Up to {maxFiles} images · JPG, PNG, WebP, HEIC or HEIF · 25 MB each</p>
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-900">{files.length} photo{files.length === 1 ? "" : "s"} ready</span><span className="font-medium text-slate-500">{(totalSize / 1024 / 1024).toFixed(1)} MB</span></div>
              <div className="flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <span key={`${file.name}-${file.lastModified}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm">
                    <FileImage className="size-3.5 shrink-0 text-slate-500" /><span className="max-w-48 truncate">{file.name}</span>
                    <button type="button" disabled={working} aria-label={`Remove ${file.name}`} onClick={(event) => { event.stopPropagation(); setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} className="text-slate-400 transition hover:text-red-500"><X className="size-3.5" /></button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <label htmlFor="quick-insurer" className="text-sm font-semibold text-slate-800">Insurer / job type <span className="text-red-500">*</span></label>
            <select id="quick-insurer" value={insurerName} onChange={(event) => setInsurerName(event.target.value)} disabled={working} className={lightInputClass}>
              <option value="" disabled>Select insurer or Private Job</option>
              {INSURANCE_CUSTOMERS.map((insurer) => <option key={insurer} value={insurer}>{insurer}</option>)}
            </select>
            <p className="text-sm leading-6 text-slate-600">Choose <strong>{PRIVATE_JOB_OPTION}</strong> when no insurer is involved. Insurance jobs keep the insurer name on the claim for future insurer-specific approval intelligence.</p>
          </div>

          <div>
            <label className="grid gap-2 text-sm">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">Anything you already know <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Recommended</span></span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} disabled={working} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="Example: front bumper repair, LH front impact, replace RH headlamp, warning light on dash…" />
              <span className="text-sm leading-6 text-slate-600">AI combines these notes with the uploaded damage photos and selected job context when deciding what repair operations should be included in the estimate.</span>
            </label>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Add known vehicle details <span className="text-xs font-normal text-slate-500">(optional — AI fills blanks only)</span></summary>
            <div className="grid gap-4 border-t border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">Registration<input value={registration} onChange={(event) => setRegistration(event.target.value.toUpperCase())} disabled={working} className={lightInputClass} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">VIN<input value={vin} onChange={(event) => setVin(event.target.value.toUpperCase())} disabled={working} className={lightInputClass} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">Year<input value={modelYear} onChange={(event) => setModelYear(event.target.value)} inputMode="numeric" disabled={working} className={lightInputClass} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">Make<input value={make} onChange={(event) => setMake(event.target.value)} disabled={working} className={lightInputClass} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">Model<input value={model} onChange={(event) => setModel(event.target.value)} disabled={working} className={lightInputClass} /></label>
            </div>
          </details>

          <div className="flex flex-col gap-4 border-t border-slate-100 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-6 text-slate-600">
              <p>Customer name is not required. AI suggestions remain unverified until an estimator reviews them.</p>
              {status ? <p aria-live="polite" className="mt-1 font-semibold text-emerald-700">{status}</p> : null}
            </div>
            <button type="button" onClick={startQuickIntake} disabled={working || !files.length || !insurerName} className="inline-flex min-h-12 min-w-48 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
              {working ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {working ? "Preparing estimate…" : "Start AI estimate"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
