"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, CalendarDays, CarFront, CircleGauge, CreditCard, FileText, LogOut, Menu, Search, Settings, UserRound, Users, X } from "lucide-react";
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

function active(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const Icon = item.icon;
        const selected = active(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${selected ? "bg-[var(--surface-3)] text-[var(--brand-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`}
          >
            <Icon className="size-4" />{item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  organizationName,
  role,
}: {
  children: React.ReactNode;
  organizationName: string;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-[var(--border)] bg-white p-5 md:flex md:min-h-screen md:flex-col">
        <Brand />
        <WorkspaceCard organizationName={organizationName} role={role} />
        <SearchBox />
        <Navigation pathname={pathname} />
        <div className="mt-auto space-y-2 pt-6">
          <Link href="/profile" className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition ${active(pathname, "/profile") ? "bg-[var(--surface-3)] text-[var(--brand-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`}><UserRound className="size-4" /> My profile</Link>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><LogOut className="size-4" /> Sign out</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur md:hidden">
          <Brand compact />
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-white" aria-label="Open navigation"><Menu className="size-5" /></button>
        </div>
        {open ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button className="absolute inset-0 bg-slate-900/25" aria-label="Close navigation" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-[86%] max-w-[320px] border-r border-[var(--border)] bg-white p-5 shadow-2xl">
              <div className="mb-5 flex items-center justify-between"><Brand /><button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl border border-[var(--border)]"><X className="size-4" /></button></div>
              <WorkspaceCard organizationName={organizationName} role={role} />
              <SearchBox />
              <Navigation pathname={pathname} onNavigate={() => setOpen(false)} />
              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)]"><UserRound className="size-4" /> My profile</Link>
                <form action={signOut}><button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)]"><LogOut className="size-4" /> Sign out</button></form>
              </div>
            </aside>
          </div>
        ) : null}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/dashboard" className={`${compact ? "mb-0" : "mb-6"} flex items-center gap-3`}><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-[#05291f]"><CarFront className="size-5" /></span><span><strong className="block text-sm tracking-wide text-[var(--text)]">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Estimator workspace</span></span></Link>;
}

function WorkspaceCard({ organizationName, role }: { organizationName: string; role: string }) {
  return <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"><div className="truncate text-xs font-semibold text-[var(--text)]">{organizationName}</div><div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{role.replaceAll("_", " ")}</div></div>;
}

function SearchBox() {
  return <form action="/search" method="get" className="mb-4"><label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5"><Search className="size-4 text-[var(--muted)]" /><input name="q" className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder="Search rego, job, claim…" /></label></form>;
}
