import Link from "next/link";
import { Activity, BadgeDollarSign, BookOpenText, Bot, Building2, CircleGauge, ClipboardList, CreditCard, FileText, Gauge, LogOut, Settings, ShieldCheck, Users } from "lucide-react";
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

export function AdminShell({ children, role }: { children: React.ReactNode; role: string }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[270px_1fr]">
      <aside className="hidden border-r border-[var(--border)] bg-[#07101d] p-5 md:flex md:min-h-screen md:flex-col">
        <Link href="/admin" className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-[#06110e]"><ShieldCheck className="size-5" /></span><span><strong className="block text-sm">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Super Admin</span></span></Link>
        <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3"><div className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Platform role</div><div className="mt-1 text-xs font-semibold capitalize">{role.replaceAll("_", " ")}</div></div>
        <nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-white"><Icon className="size-4" />{label}</Link>)}</nav>
        <div className="mt-auto pt-6"><Link href="/dashboard" className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white">Open workshop app</Link><form action={adminSignOut}><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white"><LogOut className="size-4" /> Sign out</button></form></div>
      </aside>
      <main className="min-w-0 bg-[#050b14]">{children}</main>
    </div>
  );
}
