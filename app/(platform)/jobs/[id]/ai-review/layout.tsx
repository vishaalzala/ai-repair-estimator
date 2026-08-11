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
        <nav className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 text-xs">
          <Link href={`/jobs/${id}/ai-review`} className="rounded-lg px-3 py-2 font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white">Rules & decisions</Link>
          <Link href={`/jobs/${id}/ai-review/openai`} className="rounded-lg px-3 py-2 font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white">OpenAI second pass</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
