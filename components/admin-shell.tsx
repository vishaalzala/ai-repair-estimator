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

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavigation({ pathname, close }: { pathname: string; close?: () => void }) {
  return <nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => {
    const selected = isActive(pathname, href);
    return <Link key={href} href={href} onClick={close} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${selected ? "bg-[var(--surface-3)] text-[var(--brand-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`}><Icon className="size-4" />{label}</Link>;
  })}</nav>;
}

export function AdminShell({ children, role }: { children: React.ReactNode; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen md:grid md:grid-cols-[280px_1fr]">
      <aside className="hidden border-r border-[var(--border)] bg-white p-5 md:flex md:min-h-screen md:flex-col">
        <AdminBrand />
        <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"><div className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Platform role</div><div className="mt-1 text-xs font-semibold capitalize text-[var(--text)]">{role.replaceAll("_", " ")}</div></div>
        <AdminNavigation pathname={pathname} />
        <div className="mt-auto pt-6"><Link href="/dashboard" className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">Open workshop app</Link><form action={adminSignOut}><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><LogOut className="size-4" /> Sign out</button></form></div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur md:hidden"><AdminBrand compact /><button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)]" aria-label="Open admin navigation"><Menu className="size-5" /></button></div>
        {open ? <div className="fixed inset-0 z-50 md:hidden"><button className="absolute inset-0 bg-slate-900/25" aria-label="Close admin navigation" onClick={() => setOpen(false)} /><aside className="relative h-full w-[88%] max-w-[330px] overflow-y-auto border-r border-[var(--border)] bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><AdminBrand /><button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl border border-[var(--border)]"><X className="size-4" /></button></div><div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"><div className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Platform role</div><div className="mt-1 text-xs font-semibold capitalize">{role.replaceAll("_", " ")}</div></div><AdminNavigation pathname={pathname} close={() => setOpen(false)} /><div className="mt-5 border-t border-[var(--border)] pt-4"><Link href="/dashboard" onClick={() => setOpen(false)} className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)]">Open workshop app</Link><form action={adminSignOut}><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)]"><LogOut className="size-4" /> Sign out</button></form></div></aside></div> : null}
        <main className="min-w-0 bg-[var(--background)]">{children}</main>
      </div>
    </div>
  );
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return <Link href="/admin" className={`${compact ? "mb-0" : "mb-6"} flex items-center gap-3`}><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-[#05291f]"><ShieldCheck className="size-5" /></span><span><strong className="block text-sm text-[var(--text)]">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Super Admin</span></span></Link>;
}
