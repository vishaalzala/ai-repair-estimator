"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { PreparingEstimateOverlay } from "@/components/jobs/preparing-estimate-overlay";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type StatusResult = {
  status?: "preparing" | "completed" | "failed";
  message?: string;
  error?: string | null;
};

export function RebuildAiEstimateButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("Preparing the estimate…");
  const [startedAt, setStartedAt] = useState<string | null>(null);

  async function rebuild() {
    setWorking(true);
    setMessage("Starting the AI estimator…");
    try {
      const startResponse = await fetch(`/api/jobs/${jobId}/ai-estimate/start`, { method: "POST" });
      const startResult = (await startResponse.json().catch(() => ({}))) as { startedAt?: string; message?: string };
      if (!startResponse.ok || !startResult.startedAt) throw new Error(startResult.message ?? "Unable to start the AI estimator.");
      setStartedAt(startResult.startedAt);
      setMessage("Reading the vehicle, damage photos and your notes…");

      let temporaryErrors = 0;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await sleep(1800);
        try {
          const statusResponse = await fetch(`/api/jobs/${jobId}/ai-estimate/status?since=${encodeURIComponent(startResult.startedAt)}`, { cache: "no-store" });
          if (!statusResponse.ok) throw new Error(`Status request failed (${statusResponse.status})`);
          const result = (await statusResponse.json()) as StatusResult;
          temporaryErrors = 0;
          if (result.message) setMessage(result.message);
          if (result.status === "completed") {
            router.refresh();
            setWorking(false);
            return;
          }
          if (result.status === "failed") throw new Error(result.error || result.message || "AI estimate generation failed");
        } catch (error) {
          temporaryErrors += 1;
          if (temporaryErrors >= 5) throw error;
        }
      }

      setMessage("The estimate is still running in the background. You can continue using the job and refresh this page later.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to rebuild the AI estimate.");
      setWorking(false);
    }
  }

  return (
    <>
      {working ? (
        <PreparingEstimateOverlay
          message={message}
          canContinueInBackground={Boolean(startedAt)}
          onContinueInBackground={startedAt ? () => setWorking(false) : undefined}
        />
      ) : null}
      <button
        type="button"
        onClick={rebuild}
        disabled={working}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand)]/40 bg-[rgba(88,211,178,0.08)] px-3 py-2 text-xs font-semibold text-[var(--brand)] transition hover:bg-[rgba(88,211,178,0.14)] disabled:opacity-50"
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">Rebuild AI estimate</span>
        <span className="sm:hidden">AI rebuild</span>
      </button>
    </>
  );
}
