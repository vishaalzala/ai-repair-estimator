import Link from "next/link";
import { Plus, Search } from "lucide-react";

export default function JobsPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-3xl font-semibold tracking-tight">Jobs</h1><p className="mt-2 text-sm text-[var(--muted)]">Search and manage repair assessments, claims and estimate versions.</p></div>
        <Link href="/jobs/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><Plus className="size-4" /> New assessment</Link>
      </div>
      <div className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[#091322] px-4 py-3"><Search className="size-4 text-[var(--muted)]" /><input className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]" placeholder="Search job, claim, rego, VIN or customer…" /></label>
        <div className="grid min-h-64 place-items-center text-center"><div><p className="font-medium">Job database will connect in the Supabase phase.</p><p className="mt-2 max-w-md text-sm text-[var(--muted)]">The UI is ready for tenant-scoped job queries once the production schema and RLS policies are applied.</p></div></div>
      </div>
    </div>
  );
}
