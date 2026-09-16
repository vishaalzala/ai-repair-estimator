import { requirePlatformAdmin } from "@/lib/admin/context";

function money(value: number) { return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value); }

export default async function AdminOrganizationsPage() {
  const { supabase } = await requirePlatformAdmin();
  const [orgResult, subResult, planResult, memberResult, jobResult, chargeResult] = await Promise.all([
    supabase.from("organizations").select("id,name,slug,status,currency,country_code,created_at").order("created_at", { ascending: false }),
    supabase.from("organization_subscriptions").select("organization_id,plan_id,status,stripe_customer_id,current_period_end"),
    supabase.from("plans").select("id,name,monthly_price_nzd"),
    supabase.from("organization_members").select("organization_id,user_id,status"),
    supabase.from("jobs").select("organization_id,id"),
    supabase.from("estimate_ai_charges").select("organization_id,customer_charge_nzd"),
  ]);
  const plans = new Map((planResult.data ?? []).map((p)=>[p.id,p]));
  const subs = new Map((subResult.data ?? []).map((s)=>[s.organization_id,s]));
  const members = memberResult.data ?? []; const jobs = jobResult.data ?? []; const charges = chargeResult.data ?? [];

  return <div className="mx-auto max-w-[1600px] p-5 sm:p-7 lg:p-9"><header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Customers</p><h1 className="mt-2 text-3xl font-semibold">Organizations</h1><p className="mt-2 text-sm text-[var(--muted)]">All workshop tenants, subscriptions, usage and activity.</p></header>
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]"><tr>{["Workshop","Status","Plan","Users","Jobs","AI charges","Created"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{(orgResult.data ?? []).map(org=>{const sub=subs.get(org.id); const plan=sub?plans.get(sub.plan_id):null; const userCount=members.filter(m=>m.organization_id===org.id&&m.status==="active").length; const jobCount=jobs.filter(j=>j.organization_id===org.id).length; const revenue=charges.filter(c=>c.organization_id===org.id).reduce((s,c)=>s+Number(c.customer_charge_nzd??0),0); return <tr key={org.id} className="border-b border-[var(--border)]/70 last:border-0"><td className="px-4 py-4"><div className="font-semibold">{org.name}</div><div className="text-xs text-[var(--muted)]">{org.slug}</div></td><td className="px-4 py-4 capitalize">{org.status}</td><td className="px-4 py-4"><div>{plan?.name ?? "No plan"}</div><div className="text-xs text-[var(--muted)] capitalize">{sub?.status ?? "unsubscribed"}</div></td><td className="px-4 py-4">{userCount}</td><td className="px-4 py-4">{jobCount}</td><td className="px-4 py-4">{money(revenue)}</td><td className="px-4 py-4 text-xs text-[var(--muted)]">{new Date(org.created_at).toLocaleDateString("en-NZ")}</td></tr>;})}</tbody></table></div>
  </div>;
}
