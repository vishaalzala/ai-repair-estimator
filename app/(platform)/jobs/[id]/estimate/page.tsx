import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator, History, Plus, ReceiptText, Sparkles, Trash2 } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { calculateEstimateTotals } from "@/lib/estimating/pricing-engine";
import { addEstimateItem, deleteEstimateItem, saveEstimateVersion } from "./actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";

function money(value: number, currency = "NZD") {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, status, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!job) notFound();

  const [vehicleResult, categoryResult, estimateResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("estimate_categories").select("id, code, name, pricing_basis, sort_order").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
    supabase.from("estimates").select("id, rate_card_id, status, currency, tax_rate").eq("organization_id", organizationId).eq("job_id", job.id).eq("estimate_type", "primary").maybeSingle(),
  ]);
  const vehicle = vehicleResult.data;
  const categories = categoryResult.data ?? [];
  const estimate = estimateResult.data;

  const itemResult = estimate
    ? await supabase.from("estimate_items").select("id, category_id, component, side, operation_code, description, quantity, labour_hours, labour_rate, fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount, line_total_ex_tax, source_type, human_verified, created_at").eq("estimate_id", estimate.id).order("sort_order").order("created_at")
    : { data: [] };
  const items = itemResult.data ?? [];

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totals = calculateEstimateTotals(
    items.map((item) => ({
      lineTotalExTax: Number(item.line_total_ex_tax),
      categoryCode: categoryById.get(item.category_id)?.code,
    })),
    Number(estimate?.tax_rate ?? 15),
  );
  const currency = estimate?.currency ?? "NZD";
  const addAction = addEstimateItem.bind(null, job.id);
  const deleteAction = deleteEstimateItem.bind(null, job.id);
  const saveVersionAction = saveEstimateVersion.bind(null, job.id);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Calculator className="size-4" /> Deterministic pricing</div><h1 className="text-3xl font-semibold tracking-tight">Estimate builder</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"}</p></div><div className="flex flex-wrap items-center gap-2"><Link href={`/jobs/${job.id}/history`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-white"><History className="size-4" /> History</Link>{estimate && items.length ? <form action={saveVersionAction}><button type="submit" className="rounded-xl bg-[var(--surface-3)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--brand)] hover:text-[#06110e]">Save Version</button></form> : null}<span className="text-xs text-[var(--muted)]">{estimate ? `Status: ${estimate.status.replaceAll("_", " ")}` : "Draft starts with first line"}</span></div></header>

      {error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="font-semibold">Repair operations</h2><p className="mt-1 text-xs text-[var(--muted)]">All totals are calculated by the pricing engine, not by AI.</p></div><span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-xs text-[var(--muted)]">{items.length} lines</span></div>

            {items.length === 0 ? (
              <div className="grid min-h-56 place-items-center px-6 text-center"><div><ReceiptText className="mx-auto size-8 text-[var(--muted)]" /><p className="mt-4 font-medium">No estimate lines yet</p><p className="mt-2 max-w-md text-sm text-[var(--muted)]">Build the estimate manually first. AI review is intentionally separate and comes after the estimator has a working draft.</p></div></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-[#0a1423] text-[11px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-3 font-medium">Category / operation</th><th className="px-4 py-3 font-medium">Description</th><th className="px-4 py-3 text-right font-medium">Hours</th><th className="px-4 py-3 text-right font-medium">Rate</th><th className="px-4 py-3 text-right font-medium">Parts / fixed</th><th className="px-4 py-3 text-right font-medium">Total ex GST</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody>
                    {items.map((item) => {
                      const category = categoryById.get(item.category_id);
                      const partsAndFixed = Number(item.part_cost) * Number(item.quantity) + Number(item.fixed_amount) + Number(item.freight_amount);
                      return <tr key={item.id} className="border-t border-[var(--border)]/70 align-top"><td className="px-4 py-4"><div className="font-medium">{category?.name || "Category"}</div><div className="mt-1 text-xs text-[var(--muted)]">{[item.side, item.operation_code, item.component].filter(Boolean).join(" · ") || "Manual line"}</div></td><td className="max-w-md px-4 py-4"><p>{item.description}</p>{item.source_type !== "manual" ? <span className="mt-2 inline-flex rounded-full border border-[var(--brand)]/20 px-2 py-0.5 text-[10px] text-[var(--brand)]">{item.source_type}</span> : null}</td><td className="px-4 py-4 text-right tabular-nums">{Number(item.labour_hours).toFixed(2)}</td><td className="px-4 py-4 text-right tabular-nums">{money(Number(item.labour_rate), currency)}</td><td className="px-4 py-4 text-right tabular-nums">{money(partsAndFixed, currency)}</td><td className="px-4 py-4 text-right font-semibold tabular-nums">{money(Number(item.line_total_ex_tax), currency)}</td><td className="px-4 py-4"><form action={deleteAction}><input type="hidden" name="item_id" value={item.id} /><button type="submit" aria-label={`Delete ${item.description}`} className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-red-400/10 hover:text-red-200"><Trash2 className="size-4" /></button></form></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Plus className="size-4" /></span><div><h2 className="font-semibold">Add repair operation</h2><p className="text-xs text-[var(--muted)]">Workshop rate-card defaults are used when a rate or fixed amount is left blank.</p></div></div>
            <form action={addAction} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Category *</span><select name="category_id" required className={inputClass} defaultValue=""><option value="" disabled>Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Component</span><input name="component" className={inputClass} placeholder="Front bumper" /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Side</span><select name="side" className={inputClass} defaultValue=""><option value="">Not applicable</option><option value="LH">LH</option><option value="RH">RH</option><option value="FRONT">Front</option><option value="REAR">Rear</option><option value="CENTRE">Centre</option><option value="NA">N/A</option></select></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Operation code</span><input name="operation_code" className={inputClass} placeholder="R&R, REPAIR…" /></label>
              <label className="grid gap-2 md:col-span-2 lg:col-span-4"><span className="text-xs text-[var(--muted)]">Description *</span><input name="description" required className={inputClass} placeholder="Remove and refit front bumper assembly" /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Quantity</span><input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className={inputClass} /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Labour hours</span><input name="labour_hours" type="number" min="0" step="0.05" className={inputClass} /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Labour rate</span><input name="labour_rate" type="number" min="0" step="0.01" className={inputClass} placeholder="Rate card" /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Fixed amount</span><input name="fixed_amount" type="number" step="0.01" className={inputClass} placeholder="Rate card / manual" /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Part cost</span><input name="part_cost" type="number" min="0" step="0.01" className={inputClass} /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Markup %</span><input name="markup_percent" type="number" min="0" step="0.1" className={inputClass} /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Freight</span><input name="freight_amount" type="number" min="0" step="0.01" className={inputClass} /></label>
              <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Adjustment (+/-)</span><input name="adjustment_amount" type="number" step="0.01" className={inputClass} /></label>
              <div className="md:col-span-2 lg:col-span-4 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]"><Plus className="size-4" /> Add operation</button></div>
            </form>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-2"><ReceiptText className="size-4 text-[var(--brand)]" /><h2 className="font-semibold">Repair details</h2></div>
            <div className="space-y-2.5 text-sm">
              {categories.map((category) => {
                const amount = totals.categoryTotals[category.code] ?? 0;
                if (amount === 0) return null;
                return <div key={category.id} className="flex items-center justify-between gap-4"><span className="text-[var(--muted)]">{category.name}</span><span className="tabular-nums">{money(amount, currency)}</span></div>;
              })}
            </div>
            <div className="mt-5 space-y-2 border-t border-[var(--border)] pt-4 text-sm"><div className="flex justify-between text-[var(--muted)]"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal, currency)}</span></div><div className="flex justify-between text-[var(--muted)]"><span>GST {Number(estimate?.tax_rate ?? 15).toFixed(0)}%</span><span className="tabular-nums">{money(totals.tax, currency)}</span></div><div className="flex items-end justify-between border-t border-[var(--border)] pt-3"><span className="font-semibold">Total</span><span className="text-2xl font-semibold tabular-nums">{money(totals.total, currency)}</span></div></div>
            {estimate && items.length ? <p className="mt-4 border-t border-[var(--border)] pt-3 text-[11px] leading-5 text-[var(--muted)]">Save Version creates an immutable rate, line-item and financial snapshot for later comparison. Normal editing remains the live draft.</p> : null}
          </section>

          <section className="rounded-2xl border border-[var(--brand)]/25 bg-[rgba(88,211,178,0.06)] p-5">
            <div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" /><div><h2 className="font-semibold">AI Review comes later</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">The estimator builds a defensible draft first. AI will then review possible omissions, dependencies and unresolved checks without changing totals automatically.</p></div></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
