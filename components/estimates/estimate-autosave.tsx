"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Printer } from "lucide-react";

type ServerFormAction = (formData: FormData) => Promise<void>;
type PrintAction = () => Promise<{ versionId?: string; error?: string }>;

type FlushDetail = { pending: Promise<boolean>[] };

function emitStatus(status: "saving" | "saved" | "error") {
  window.dispatchEvent(new CustomEvent("estimate:save-status", { detail: status }));
}

export function AutoSaveForm({
  action,
  children,
  className,
  debounceMs = 700,
}: {
  action: ServerFormAction;
  children: ReactNode;
  className?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);
  const editVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    const form = formRef.current;
    if (!form || !dirtyRef.current) return true;
    if (savingRef.current) return savingRef.current;

    const versionToSave = editVersionRef.current;
    let needsFollowup = false;

    const task = (async () => {
      try {
        emitStatus("saving");
        await action(new FormData(form));
        savedVersionRef.current = Math.max(savedVersionRef.current, versionToSave);
        dirtyRef.current = savedVersionRef.current < editVersionRef.current;
        needsFollowup = dirtyRef.current;

        if (dirtyRef.current) {
          emitStatus("saving");
        } else {
          emitStatus("saved");
          router.refresh();
        }
        return true;
      } catch (error) {
        console.error("Estimate autosave failed", error);
        dirtyRef.current = true;
        emitStatus("error");
        return false;
      } finally {
        savingRef.current = null;
        if (needsFollowup && dirtyRef.current) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => void save(), 0);
        }
      }
    })();

    savingRef.current = task;
    return task;
  }, [action, router]);

  const scheduleSave = useCallback(() => {
    editVersionRef.current += 1;
    dirtyRef.current = true;
    emitStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), debounceMs);
  }, [debounceMs, save]);

  useEffect(() => {
    const flush = (event: Event) => {
      const detail = (event as CustomEvent<FlushDetail>).detail;
      if (!detail?.pending) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      const flushAll = async () => {
        while (dirtyRef.current || savingRef.current) {
          const ok = savingRef.current ? await savingRef.current : await save();
          if (!ok) return false;
        }
        return true;
      };

      detail.pending.push(flushAll());
    };

    window.addEventListener("estimate:flush", flush);
    return () => {
      window.removeEventListener("estimate:flush", flush);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [save]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    if (submitter?.dataset.nativeSubmit === "true") return;
    event.preventDefault();
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    void save();
  }

  return (
    <form
      ref={formRef}
      className={className}
      onInput={scheduleSave}
      onChange={scheduleSave}
      onSubmit={onSubmit}
    >
      {children}
    </form>
  );
}

async function flushEstimateForms() {
  const detail: FlushDetail = { pending: [] };
  window.dispatchEvent(new CustomEvent("estimate:flush", { detail }));
  if (!detail.pending.length) return true;
  const results = await Promise.all(detail.pending);
  return results.every(Boolean);
}

export function AutosaveLink({ href, className, children, ariaLabel }: { href: string; className?: string; children: ReactNode; ariaLabel?: string }) {
  const router = useRouter();

  async function navigate(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const saved = await flushEstimateForms();
    if (!saved) return;
    router.push(href);
  }

  return <Link href={href} onClick={navigate} className={className} aria-label={ariaLabel}>{children}</Link>;
}

export function EstimateSaveStatus() {
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");

  useEffect(() => {
    const listener = (event: Event) => setStatus((event as CustomEvent<typeof status>).detail);
    window.addEventListener("estimate:save-status", listener);
    return () => window.removeEventListener("estimate:save-status", listener);
  }, []);

  if (status === "saving") return <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]"><Loader2 className="size-3.5 animate-spin" /> Saving…</span>;
  if (status === "error") return <span className="text-xs font-medium text-red-500">Autosave failed — changes not saved</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><Check className="size-3.5" /> Saved</span>;
}

export function PrintEstimateButton({ action }: { action: PrintAction }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function print() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const popup = window.open("", "_blank");
    try {
      const saved = await flushEstimateForms();
      if (!saved) throw new Error("Please retry after the estimate finishes saving.");
      const result = await action();
      if (!result.versionId) throw new Error(result.error || "Unable to prepare printout");
      const url = `/api/reports/estimate/${result.versionId}/pdf`;
      if (popup) popup.location.href = url;
      else window.location.href = url;
    } catch (caught) {
      popup?.close();
      setError(caught instanceof Error ? caught.message : "Unable to prepare printout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="hidden text-[10px] text-red-500 md:inline">{error}</span> : null}
      <button type="button" onClick={print} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text)] shadow-sm transition hover:bg-[var(--surface-2)] disabled:opacity-60">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
        <span className="hidden sm:inline">Print</span>
      </button>
    </div>
  );
}
