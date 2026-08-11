import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  PackageSearch,
  Plus,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

const stats = [
  { label: "New assessments", value: "7", note: "2 today", icon: Camera },
  { label: "Awaiting AI review", value: "3", note: "Needs estimator", icon: Bot },
  { label: "Awaiting parts", value: "5", note: "$4.8k TBC", icon: PackageSearch },
  { label: "Ready to finalise", value: "4", note: "All checks passed", icon: FileCheck2 },
];

const jobs = [
  { job: "J-2026-10321", vehicle: "Toyota Aqua", claim: "CLM-88214", status: "Draft", total: "$3,420" },
  { job: "J-2026-10320", vehicle: "Ford Ranger", claim: "CLM-88197", status: "Awaiting parts", total: "$12,880" },
  { job: "J-2026-10319", vehicle: "Kia Sportage", claim: "CLM-88163", status: "AI review", total: "$6,240" },
  { job: "J-2026-10318", vehicle: "Toyota Corolla", claim: "CLM-88121", status: "Approved", total: "$4,670" },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand)]">
            <ShieldCheck className="size-4" />
            Insurance estimating workspace
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Workshop dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Build defensible repair estimates, review potential omissions and keep every AI suggestion under estimator control.
          </p>
        </div>
        <Link href="/jobs/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]">
          <Plus className="size-4" />
          New assessment
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">{stat.label}</span>
                <span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Icon className="size-4" /></span>
              </div>
              <div className="flex items-end justify-between gap-3">
                <strong className="text-3xl font-semibold">{stat.value}</strong>
                <span className="text-xs text-[var(--muted)]">{stat.note}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="font-semibold">Recent jobs</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Latest assessments and estimate status.</p>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-xs font-semibold text-[var(--brand)]">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-[#0a1423] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Job</th><th className="px-5 py-3 font-medium">Vehicle</th><th className="px-5 py-3 font-medium">Claim</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Estimate</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.job} className="border-t border-[var(--border)]/70 hover:bg-[var(--surface-2)]/60">
                    <td className="px-5 py-4 font-medium">{job.job}</td><td className="px-5 py-4 text-[var(--muted)]">{job.vehicle}</td><td className="px-5 py-4 text-[var(--muted)]">{job.claim}</td><td className="px-5 py-4"><span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs">{job.status}</span></td><td className="px-5 py-4 text-right font-medium">{job.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">AI estimate review</h2><p className="mt-1 text-xs text-[var(--muted)]">Checks without inventing charges.</p></div><Sparkles className="size-5 text-[var(--brand)]" /></div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-3"><TriangleAlert className="mt-0.5 size-4 text-[var(--warning)]" /><div><p className="text-sm font-medium">4 items require review</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">2 parts TBC · 1 diagnostic check · 1 possible transfer operation</p></div></div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-[var(--border)] p-3"><CheckCircle2 className="mx-auto mb-1 size-4 text-[var(--brand)]" /><div className="text-lg font-semibold">21</div><div className="text-[10px] text-[var(--muted)]">Passed</div></div>
                <div className="rounded-xl border border-[var(--border)] p-3"><Clock3 className="mx-auto mb-1 size-4 text-[var(--warning)]" /><div className="text-lg font-semibold">4</div><div className="text-[10px] text-[var(--muted)]">Review</div></div>
                <div className="rounded-xl border border-[var(--border)] p-3"><PackageSearch className="mx-auto mb-1 size-4 text-[var(--danger)]" /><div className="text-lg font-semibold">2</div><div className="text-[10px] text-[var(--muted)]">TBC</div></div>
              </div>
            </div>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#102439] to-[#0d1a2c] p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Estimated this month</p><p className="mt-2 text-3xl font-semibold">$78,430</p></div><CircleDollarSign className="size-8 text-[var(--brand)]" /></div>
            <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]"><span>Average repair</span><strong className="text-sm text-white">$4,670</strong></div>
          </article>
        </div>
      </section>
    </div>
  );
}
