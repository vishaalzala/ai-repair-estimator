import Link from "next/link";

export default async function AiReviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <div className="mx-auto max-w-[1500px] px-5 pt-4 sm:px-7 lg:px-9">
        <nav className="inline-flex rounded-xl border border-[var(--border)] bg-white p-1 text-xs shadow-sm">
          <Link href={`/jobs/${id}/ai-review`} className="rounded-lg px-3 py-2 font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">Rules & decisions</Link>
          <Link href={`/jobs/${id}/ai-review/second-pass`} className="rounded-lg px-3 py-2 font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">Smart second pass</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
