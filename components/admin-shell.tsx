"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, BadgeDollarSign, BookOpenText, Bot, Building2, CircleGauge, ClipboardList, CreditCard, FileText, Gauge, LogOut, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";
import { adminSignOut } from "@/app/admin/login/actions";

const nav = [
  { href: "/admin", label: "Dashboard", icon: CircleGauge },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/estimates", label: "Estimates", icon: FileText },
  { href: "/admin/knowledge", label: "AI Knowledge", icon: BookOpenText },
  { href: "/admin/learning", label: "Learning Queue", icon: ClipboardList },
  { href: "/admin/ai", label: "AI Configuration", icon: Bot },
  { href: "/admin/usage", label: "Usage & Costs", icon: Gauge },
  { href: "/admin/plans", label: "Plans", icon: BadgeDollarSign },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/system", label: "System", icon: Activity },
  { href: "/admin/audit", label: "Audit Logs", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function active(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {nav.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active(pathname, href) ? "bg-[#e8f7f2] text-[#126f5d]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
          <Icon className="size-4" />{label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminShell({ children, role }: { children: React.ReactNode; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f8fb] md:grid md:grid-cols-[270px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-slate-200 bg-white p-5 md:flex md:flex-col">
        <Link href="/admin" className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white shadow-sm"><ShieldCheck className="size-5" /></span><span><strong className="block text-sm text-slate-950">RepairQuote AI</strong><span className="text-xs text-slate-500">Super Admin</span></span></Link>
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Platform role</div><div className="mt-1 text-xs font-semibold capitalize text-slate-900">{role.replaceAll("_", " ")}</div></div>
        <AdminNav pathname={pathname} />
        <div className="mt-auto pt-6"><Link href="/dashboard" className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-950">Open workshop app</Link><form action={adminSignOut}><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-950"><LogOut className="size-4" /> Sign out</button></form></div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:hidden">
          <button type="button" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700" aria-label="Open admin menu"><Menu className="size-5" /></button>
          <span className="ml-3 font-semibold text-slate-950">Super Admin</span>
        </header>
        <main className="min-w-0 bg-[#f6f8fb] text-slate-950">{children}</main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-slate-950/25" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[310px] max-w-[90vw] flex-col bg-white p-5 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-3"><Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white"><ShieldCheck className="size-5" /></span><span><strong className="block text-sm text-slate-950">RepairQuote AI</strong><span className="text-xs text-slate-500">Super Admin</span></span></Link><button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"><X className="size-4" /></button></div>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Platform role</div><div className="mt-1 text-xs font-semibold capitalize text-slate-900">{role.replaceAll("_", " ")}</div></div>
            <AdminNav pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="mt-auto pt-6"><Link href="/dashboard" className="mb-2 flex items-center rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100">Open workshop app</Link><form action={adminSignOut}><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"><LogOut className="size-4" /> Sign out</button></form></div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
