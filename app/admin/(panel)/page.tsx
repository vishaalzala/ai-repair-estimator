import { Activity, Bot, Building2, CreditCard, FileText, Users } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin/context";

function money(value: number) { return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value); }

export default async function AdminDashboardPage() {
  const { supabase } = await requirePlatformAdmin();
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
  const [orgs, members, estimates, runs, subscriptions, usage] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("estimates").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    supabase.from("ai_analysis_runs").select("id,status", { count: "exact" }).gte("created_at", monthStart.toISOString()).limit(1000),
    supabase.from("organization_subscriptions").select("id,status"),
    supabase.from("ai_usage_ledger").select("provider_cost_nzd,customer_charge_nzd").gte("created_at", monthStart.toISOString()).limit(5000),
  ]);
  const usageRows = usage.data ?? [];
  const providerCost = usageRows.reduce((s,r)=>s+Number(r.provider_cost_nzd ?? 0),0);
  const usageRevenue = usageRows.reduce((s,r)=>s+Number(r.customer_charge_nzd ?? 0),0);
  const failedRuns = (runs.data ?? []).filter((r)=>r.status === "failed").length;
  const activeSubs = (subscriptions.data ?? []).filter((s)=>["active","trialing"].includes(s.status)).length;

  const cards = [
    ["Organizations", orgs.count ?? 0, Building2, "Customer workspaces"],
    ["Active users", members.count ?? 0, Users, "Across all workshops"],
    ["Estimates this month", estimates.count ?? 0, FileText, "All organizations"],
    ["AI runs", runs.count ?? 0, Bot, `${failedRuns} failed`],
    ["AI provider cost", money(providerCost), Activity, "This month"],
    ["AI usage revenue", money(usageRevenue), CreditCard, `${money(Math.max(0, usageRevenue-providerCost))} usage margin`],
  ] as const;

  return <div className="mx-auto max-w-[1600px] p-5 sm:p-7 lg:p-9">
    <header className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">SaaS control centre</p><h1 className="mt-2 text-3xl font-semibold">Super Admin Dashboard</h1><p className="mt-2 text-sm text-[var(--muted)]">Platform health, customer growth, AI usage, cost and billing in one place.</p></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value,Icon,detail])=><section key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><span className="text-xs text-[var(--muted)]">{label}</span><Icon className="size-4 text-[var(--brand)]" /></div><div className="mt-3 text-2xl font-semibold">{value}</div><div className="mt-1 text-xs text-[var(--muted)]">{detail}</div></section>)}</div>
    <div className="mt-5 grid gap-4 lg:grid-cols-3"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Subscriptions</h2><p className="mt-3 text-3xl font-semibold text-[var(--brand)]">{activeSubs}</p><p className="mt-1 text-xs text-[var(--muted)]">Active or trialing organizations</p></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">AI gross usage margin</h2><p className="mt-3 text-3xl font-semibold">{money(Math.max(0, usageRevenue-providerCost))}</p><p className="mt-1 text-xs text-[var(--muted)]">Usage charge less provider cost</p></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Attention</h2><p className="mt-3 text-3xl font-semibold">{failedRuns}</p><p className="mt-1 text-xs text-[var(--muted)]">Failed AI runs this month</p></section></div>
  </div>;
}
