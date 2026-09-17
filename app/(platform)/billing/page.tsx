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

  const [subscriptionResult, chargesResult] = await Promise.all([
    supabase.from("organization_subscriptions").select("id,plan_id,status,stripe_customer_id,stripe_subscription_id,current_period_start,current_period_end,cancel_at_period_end").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("estimate_ai_charges").select("job_id,customer_charge_nzd,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
  ]);

  const subscription = subscriptionResult.data;
  const { data: plan } = subscription?.plan_id
    ? await supabase.from("plans").select("name,description,monthly_price_nzd").eq("id", subscription.plan_id).maybeSingle()
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

  return <div className="mx-auto max-w-[1450px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
    <header className="mb-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#178f75]"><CreditCard className="size-4" /> Billing</div><h1 className="mt-2 text-3xl font-semibold">Plan & estimate usage</h1><p className="mt-2 text-sm text-slate-500">Your monthly RepairQuote AI subscription plus per-estimate processing charges.</p></header>
    {query.message ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.message}</div> : null}
    {query.error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</div> : null}

    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-xs text-slate-500"><ReceiptText className="size-4 text-[#178f75]" /> Current plan</div><div className="mt-3 text-xl font-semibold">{plan?.name ?? "RepairQuote AI Starter"}</div><div className="mt-1 text-2xl font-semibold text-[#178f75]">{money(monthlyPrice)}<span className="text-xs font-normal text-slate-500"> / month</span></div><p className="mt-3 text-xs leading-5 text-slate-500">Estimate processing is metered separately and appears as a simple per-job usage charge.</p></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-xs text-slate-500"><Gauge className="size-4 text-[#178f75]" /> This month</div><div className="mt-3 text-2xl font-semibold">{money(monthUsage)}</div><p className="mt-1 text-xs text-slate-500">Estimate processing usage</p><div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">Estimated next invoice <strong className="float-right text-slate-950">{money(estimatedInvoice)}</strong></div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs text-slate-500">Subscription status</div><div className="mt-3 text-xl font-semibold capitalize">{subscription?.status ?? "trialing"}</div><p className="mt-1 text-xs text-slate-500">{subscription?.current_period_end ? `Current period ends ${new Date(subscription.current_period_end).toLocaleDateString("en-NZ")}` : "Online payment is not connected yet."}</p>{canManageBilling && !subscription?.stripe_subscription_id ? <form action="/api/billing/checkout" method="post" className="mt-4"><button disabled={!stripeReady} className="w-full rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">Connect payment & subscription</button></form> : null}{!stripeReady ? <p className="mt-3 text-[10px] leading-4 text-amber-700">Online payment setup is pending platform configuration.</p> : null}</section>
    </div>

    {!canManageBilling ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Billing details are available to workshop owners, admins and managers.</div> : null}

    {canManageBilling ? <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold">Estimate usage history</h2><p className="mt-1 text-xs text-slate-500">One customer-facing processing charge per job.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{["Job","Processing charge","Status","Created"].map((h)=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{charges.map((charge)=><tr key={`${charge.job_id}-${charge.created_at}`} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-semibold text-slate-900">{jobsById.get(charge.job_id) ?? charge.job_id.slice(0,8)}</td><td className="px-3 py-3">{money(Number(charge.customer_charge_nzd ?? 0))}</td><td className="px-3 py-3 capitalize text-slate-600">{charge.status.replaceAll("_", " ")}</td><td className="px-3 py-3 text-slate-500">{new Date(charge.created_at).toLocaleString("en-NZ")}</td></tr>)}{!charges.length ? <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No metered estimate usage yet.</td></tr> : null}</tbody></table></div></section> : null}
  </div>;
}
