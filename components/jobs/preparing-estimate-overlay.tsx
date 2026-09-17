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
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 px-5 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-2xl shadow-slate-950/25 sm:p-9">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <LoaderCircle className="size-7 animate-spin" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">
          <Sparkles className="size-3.5" /> AI estimator
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Preparing estimate…</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-6 text-slate-600">{message}</p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
          Photos, notes and workshop pricing are being processed into a full line-by-line estimate for estimator review. The job continues in the background even if you move to another page.
        </div>
        {canContinueInBackground && onContinueInBackground ? (
          <button
            type="button"
            onClick={onContinueInBackground}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            Continue in background
          </button>
        ) : (
          <div className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-500">
            Preparing…
          </div>
        )}
      </div>
    </div>
  );
}
