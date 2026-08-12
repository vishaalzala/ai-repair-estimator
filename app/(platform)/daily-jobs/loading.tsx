export default function DailyJobsLoading() {
  return <div className="mx-auto max-w-[1800px] px-4 py-7 sm:px-6 lg:px-7"><div className="h-8 w-52 animate-pulse rounded bg-[var(--surface-3)]" /><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />)}</div><div className="mt-5 h-[520px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" /></div>;
}
