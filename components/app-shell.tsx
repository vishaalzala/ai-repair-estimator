import Link from "next/link";
import { BookOpenText, Boxes, CarFront, CircleGauge, FileText, Settings, Sparkles, Users } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: CircleGauge },
  { href: "/jobs", label: "Jobs", icon: CarFront },
  { href: "/parts", label: "Parts", icon: Boxes },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/knowledge", label: "AI Knowledge", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-[var(--border)] bg-[#091322]/90 p-5 md:flex md:min-h-screen md:flex-col">
        <Link href="/dashboard" className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-[#07120f]"><CarFront className="size-5" /></span>
          <span><strong className="block text-sm tracking-wide">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Estimator workspace</span></span>
        </Link>
        <nav className="space-y-1">
          {nav.map((item, index) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${index === 0 ? "bg-[var(--surface-3)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white"}`}><Icon className="size-4" />{item.label}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--brand)]"><BookOpenText className="size-4" />AI learning status</div>
          <p className="text-xs leading-5 text-[var(--muted)]">Global, workshop and personal knowledge are isolated by scope and reviewed before use.</p>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
