import Link from "next/link";
import { Boxes, CalendarDays, CarFront, CircleGauge, CreditCard, FileText, LogOut, Settings, Users } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: CircleGauge },
  { href: "/jobs", label: "Jobs", icon: CarFront },
  { href: "/daily-jobs", label: "Daily Jobs", icon: CalendarDays },
  { href: "/parts", label: "Parts", icon: Boxes },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  organizationName,
  role,
}: {
  children: React.ReactNode;
  organizationName: string;
  role: string;
}) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-[var(--border)] bg-[#091322]/90 p-5 md:flex md:min-h-screen md:flex-col">
        <Link href="/dashboard" className="mb-7 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-[#07120f]"><CarFront className="size-5" /></span>
          <span><strong className="block text-sm tracking-wide">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Estimator workspace</span></span>
        </Link>

        <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
          <div className="truncate text-xs font-semibold text-white">{organizationName}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{role.replaceAll("_", " ")}</div>
        </div>

        <nav className="space-y-1">
          {nav.map((item, index) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${index === 0 ? "bg-[var(--surface-3)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white"}`}><Icon className="size-4" />{item.label}</Link>;
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--brand)]"><CreditCard className="size-4" />SaaS plan</div>
            <p className="text-xs leading-5 text-[var(--muted)]">Subscription and AI estimate usage are available under Billing. Global AI training is controlled by platform administration.</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-white"><LogOut className="size-4" /> Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
