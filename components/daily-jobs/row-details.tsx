"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

type Detail = { label: string; value: string };

export function RowDetails({ jobId, details }: { jobId: string; details: Detail[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)]">
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {open ? "Hide" : "Details"}
      </button>
      {open ? (
        <div className="mt-3 grid min-w-[560px] gap-3 rounded-xl border border-[var(--border)] bg-[#08111e] p-4 sm:grid-cols-2 xl:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.label}>
              <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">{detail.label}</div>
              <div className="mt-1 text-xs text-white">{detail.value || "—"}</div>
            </div>
          ))}
          <Link href={`/jobs/${jobId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] sm:col-span-2 xl:col-span-3">
            Open full job <ExternalLink className="size-3" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
