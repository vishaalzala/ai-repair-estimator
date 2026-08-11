import { ArrowLeft, Camera, ChevronRight, FileText, Shield, Sparkles } from "lucide-react";
import Link from "next/link";

const steps = [
  { label: "Vehicle", icon: FileText },
  { label: "Insurance", icon: Shield },
  { label: "Photos", icon: Camera },
  { label: "AI analysis", icon: Sparkles },
];

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href="/jobs" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to jobs</Link>
      <div className="mb-7"><h1 className="text-3xl font-semibold tracking-tight">New assessment</h1><p className="mt-2 text-sm text-[var(--muted)]">Capture the core job information first. AI never approves an estimate; an estimator remains in control.</p></div>
      <div className="mb-5 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => { const Icon = step.icon; return <div key={step.label} className={`rounded-xl border p-3 ${index === 0 ? "border-[var(--brand)] bg-[rgba(88,211,178,0.08)]" : "border-[var(--border)] bg-[var(--surface)]"}`}><div className="flex items-center gap-2 text-xs font-medium"><Icon className="size-4" /> {step.label}</div></div>; })}
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
        <div className="grid gap-5 md:grid-cols-2">
          {["Registration", "VIN", "Make", "Model", "Year", "Colour", "Odometer", "Job reference"].map((label) => <label key={label} className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">{label}</span><input className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" placeholder={label} /></label>)}
        </div>
        <div className="mt-7 flex justify-end"><button type="button" className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Continue to insurance <ChevronRight className="size-4" /></button></div>
      </section>
    </div>
  );
}
