import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto max-w-[1500px] px-5 pt-4 sm:px-7 lg:px-9">
        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 text-xs">
          <Link href="/settings/workshop" className="shrink-0 rounded-lg px-3 py-2 font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white">Workshop & rates</Link>
          <Link href="/settings" className="shrink-0 rounded-lg px-3 py-2 font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white">General</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
