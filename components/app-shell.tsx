"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, CalendarDays, CarFront, CircleGauge, CreditCard, FileText, LogOut, Menu, Search, Settings, UserCog, Users, X } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: CircleGauge },
  { href: "/jobs", label: "Jobs", icon: CarFront },
  { href: "/daily-jobs", label: "Daily Jobs", icon: CalendarDays },
  { href: "/parts", label: "Parts", icon: Boxes },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/team", label: "Team", icon: UserCog },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-[#e8f7f2] text-[#126f5d]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, organizationName, role }: { children: React.ReactNode; organizationName: string; role: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const identity = (
    <>
      <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white shadow-sm"><CarFront className="size-5" /></span>
        <span><strong className="block text-sm tracking-wide text-slate-950">RepairQuote AI</strong><span className="text-xs text-slate-500">Estimator workspace</span></span>
      </Link>
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="truncate text-xs font-semibold text-slate-900">{organizationName}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{role.replaceAll("_", " ")}</div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-slate-200 bg-white p-5 md:flex md:flex-col">
        {identity}
        <div className="mt-5"><NavLinks pathname={pathname} /></div>
        <div className="mt-auto space-y-3 pt-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#178f75]"><CreditCard className="size-4" />Plan & usage</div>
            <p className="text-xs leading-5 text-slate-500">Subscription and estimate processing usage are managed under Billing.</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"><LogOut className="size-4" /> Sign out</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 md:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
          <Link href="/dashboard" className="font-semibold text-slate-950 md:hidden">RepairQuote AI</Link>
          <form action="/search" method="get" className="ml-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-[#2ebc98] focus-within:bg-white">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input name="q" aria-label="Search" className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" placeholder="Search rego, job, claim, customer or VIN…" />
          </form>
        </header>
        <main className="min-w-0">{children}</main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-950/25" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[290px] max-w-[88vw] flex-col border-r border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">{identity}</div>
              <button type="button" onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"><X className="size-4" /></button>
            </div>
            <div className="mt-5"><NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} /></div>
            <form action={signOut} className="mt-auto pt-6">
              <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"><LogOut className="size-4" /> Sign out</button>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
