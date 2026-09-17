"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImageForUpload } from "@/lib/images/compress-upload";

const categories = [
  ["identification", "Identification"],
  ["accident_damage", "Accident damage"],
  ["pre_existing", "Pre-existing damage"],
  ["hidden_damage", "Hidden / strip findings"],
  ["extra_damage", "Extra damage"],
  ["strip_down", "Strip-down"],
  ["progress", "Repair progress"],
  ["parts", "Parts"],
  ["completed", "Completed repair"],
] as const;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxBytes = 25 * 1024 * 1024;
const immutableCacheSeconds = "31536000";

function safeFileName(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  return `${crypto.randomUUID()}${extension}`;
}

export function PhotoUploader({
  organizationId,
  jobId,
  userId,
}: {
  organizationId: string;
  jobId: string;
  userId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<(typeof categories)[number][0]>("accident_damage");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadSelected() {
    const files = Array.from(inputRef.current?.files ?? []);
    if (!files.length) {
      setMessage("Choose one or more vehicle photos first.");
      return;
    }

    const invalid = files.find((file) => !allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes);
    if (invalid) {
      setMessage(`${invalid.name} must be JPG, PNG, WebP, HEIC or HEIF and no larger than 25 MB.`);
      return;
    }

    setUploading(true);
    setMessage(null);
    const supabase = createClient();
    let uploaded = 0;

    try {
      for (const originalFile of files) {
        setMessage(`Compressing photo ${uploaded + 1} of ${files.length}…`);
        const file = await compressImageForUpload(originalFile);
        const path = `${organizationId}/${jobId}/originals/${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file, {
          cacheControl: immutableCacheSeconds,
          contentType: file.type,
          upsert: false,
        });

        if (uploadError) throw uploadError;

        const { error: rowError } = await supabase.from("photos").insert({
          organization_id: organizationId,
          job_id: jobId,
          category,
          file_name: originalFile.name,
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

        uploaded += 1;
      }

      if (inputRef.current) inputRef.current.value = "";
      setMessage(`${uploaded} compressed photo${uploaded === 1 ? "" : "s"} uploaded securely.`);
      router.refresh();
    } catch (error) {
      console.error("Photo upload failed", error);
      const reason = error instanceof Error ? error.message : "Unknown upload error.";
      setMessage(`Upload stopped after ${uploaded} successful photo${uploaded === 1 ? "" : "s"}. ${reason}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Camera className="size-4" /></span><div><h2 className="font-semibold">Add evidence photos</h2><p className="text-xs text-[var(--muted)]">Photos are resized and compressed to WebP before private workshop storage.</p></div></div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" multiple className="block w-full rounded-xl border border-dashed border-[var(--border)] bg-[#091322] p-4 text-sm text-[var(--muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--surface-3)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
        </div>
        <label className="grid min-w-52 gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">Photo category</span><select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none focus:border-[var(--brand)]">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" onClick={uploadSelected} disabled={uploading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60">{uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{uploading ? "Optimising & uploading…" : "Upload photos"}</button>
      </div>
      {message ? <p aria-live="polite" className="mt-4 text-xs text-[var(--muted)]">{message}</p> : null}
      <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">Capture front, rear, LH, RH, wide damage and close-up evidence. Avoid including unrelated personal information in photos.</p>
    </section>
  );
}
