"use client";

import { LoaderCircle, Sparkles } from "lucide-react";

export function PreparingEstimateOverlay({
  message,
  canContinueInBackground,
  onContinueInBackground,
}: {
  message: string;
  canContinueInBackground: boolean;
  onContinueInBackground?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-[#030812]/80 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[var(--brand)]/30 bg-[#0a1626] p-7 text-center shadow-2xl shadow-black/40 sm:p-9">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[rgba(88,211,178,0.12)] text-[var(--brand)]">
          <LoaderCircle className="size-7 animate-spin" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          <Sparkles className="size-3.5" /> AI estimator
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Preparing estimate…</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">{message}</p>
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[#07111f] px-4 py-3 text-xs leading-5 text-[var(--muted)]">
          Photos, your notes and workshop pricing are being processed into a full line-by-line estimate. The AI job continues on the server even if you move to another page.
        </div>
        {canContinueInBackground && onContinueInBackground ? (
          <button
            type="button"
            onClick={onContinueInBackground}
            className="mt-5 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--surface-2)]"
          >
            Continue in background
          </button>
        ) : null}
      </div>
    </div>
  );
}
