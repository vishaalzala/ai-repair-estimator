import { CreditCard, Gauge, ReceiptText } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

function money(value: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value);
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const query = await searchParams;
  const { supabase, organizationId, role } = await requireOrganizationContext();
  const canManageBilling = ["owner", "admin", "manager"].includes(role);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);

  const [orgResult, subscriptionResult, chargesResult] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.from("organization_subscriptions").select("id,plan_id,status,stripe_customer_id,stripe_subscription_id,current_period_start,current_period_end,cancel_at_period_end").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("estimate_ai_charges").select("job_id,provider_cost_nzd,markup_percent,customer_charge_nzd,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
  ]);

  const subscription = subscriptionResult.data;
  const { data: plan } = subscription?.plan_id
    ? await supabase.from("plans").select("name,description,monthly_price_nzd,ai_markup_percent,minimum_estimate_charge_nzd").eq("id", subscription.plan_id).maybeSingle()
    : { data: null };
  const jobIds = (chargesResult.data ?? []).map((charge) => charge.job_id);
  const { data: jobs } = jobIds.length
    ? await supabase.from("jobs").select("id,job_number").eq("organization_id", organizationId).in("id", jobIds)
    : { data: [] };
  const jobsById = new Map((jobs ?? []).map((job) => [job.id, job.job_number]));
  const charges = chargesResult.data ?? [];
  const monthUsage = charges.filter((charge) => new Date(charge.created_at) >= monthStart).reduce((sum, charge) => sum + Number(charge.customer_charge_nzd ?? 0), 0);
  const monthlyPrice = Number(plan?.monthly_price_nzd ?? 9.99);
  const estimatedInvoice = monthlyPrice + monthUsage;
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SECRET_KEY);

  return <div className="mx-auto max-w-[1450px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
    <header className="mb-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]"><CreditCard className="size-4" /> SaaS billing</div><h1 className="mt-2 text-3xl font-semibold">Billing & AI Usage</h1><p className="mt-2 text-sm text-[var(--muted)]">Your monthly RepairQuote AI subscription plus metered AI estimate processing.</p></header>
    {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}
    {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}

    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center gap-2 text-xs text-[var(--muted)]"><ReceiptText className="size-4 text-[var(--brand)]" /> Current plan</div><div className="mt-3 text-xl font-semibold">{plan?.name ?? "RepairQuote AI Starter"}</div><div className="mt-1 text-2xl font-semibold text-[var(--brand)]">{money(monthlyPrice)}<span className="text-xs font-normal text-[var(--muted)]"> / month</span></div><p className="mt-3 text-xs leading-5 text-[var(--muted)]">AI estimates are charged at actual provider processing cost + {Number(plan?.ai_markup_percent ?? 10).toFixed(0)}% platform margin.</p></section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Gauge className="size-4 text-[var(--brand)]" /> This month</div><div className="mt-3 text-2xl font-semibold">{money(monthUsage)}</div><p className="mt-1 text-xs text-[var(--muted)]">AI estimate usage</p><div className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">Estimated next invoice <strong className="float-right text-white">{money(estimatedInvoice)}</strong></div></section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="text-xs text-[var(--muted)]">Subscription status</div><div className="mt-3 text-xl font-semibold capitalize">{subscription?.status ?? "trialing"}</div><p className="mt-1 text-xs text-[var(--muted)]">{subscription?.current_period_end ? `Current period ends ${new Date(subscription.current_period_end).toLocaleDateString("en-NZ")}` : "Stripe subscription not connected yet."}</p>{canManageBilling && !subscription?.stripe_subscription_id ? <form action="/api/billing/checkout" method="post" className="mt-4"><button disabled={!stripeReady} className="w-full rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e] disabled:cursor-not-allowed disabled:opacity-50">Connect payment & subscription</button></form> : null}{!stripeReady ? <p className="mt-3 text-[10px] leading-4 text-amber-100">Online payment setup is pending platform Stripe configuration.</p> : null}</section>
    </div>

    {!canManageBilling ? <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">Billing details are available to workshop owners, admins and managers.</div> : null}

    {canManageBilling ? <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-4"><h2 className="font-semibold">AI estimate usage history</h2><p className="mt-1 text-xs text-[var(--muted)]">One customer-facing usage charge per job. Provider wholesale cost is retained internally for reconciliation.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-[var(--border)] text-[10px] uppercase text-[var(--muted)]"><tr>{["Job","AI usage charge","Markup","Status","Created"].map((h)=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{charges.map((charge)=><tr key={charge.job_id} className="border-b border-[var(--border)]/70 last:border-0"><td className="px-3 py-3 font-semibold">{jobsById.get(charge.job_id) ?? charge.job_id.slice(0,8)}</td><td className="px-3 py-3">{money(Number(charge.customer_charge_nzd ?? 0))}</td><td className="px-3 py-3">{Number(charge.markup_percent ?? 0).toFixed(1)}%</td><td className="px-3 py-3 capitalize">{charge.status}</td><td className="px-3 py-3 text-[var(--muted)]">{new Date(charge.created_at).toLocaleString("en-NZ")}</td></tr>)}{!charges.length ? <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">No metered AI estimate usage yet.</td></tr> : null}</tbody></table></div></section> : null}
  </div>;
}
