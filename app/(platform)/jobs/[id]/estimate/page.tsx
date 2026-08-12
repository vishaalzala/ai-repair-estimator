import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Camera,
  CarFront,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  History,
  PackageSearch,
  Plus,
  ReceiptText,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { calculateEstimateTotals } from "@/lib/estimating/pricing-engine";
import {
  addEstimateItem,
  deleteEstimateItem,
  saveEstimateVersion,
  updateEstimateContext,
  updateEstimateItem,
} from "./actions";

const inputClass = "min-w-0 rounded-lg border border-[var(--border)] bg-[#091322] px-2.5 py-2 text-xs text-white outline-none transition focus:border-[var(--brand)]";
const tinyInputClass = "min-w-0 rounded-lg border border-[var(--border)] bg-[#091322] px-2 py-1.5 text-xs text-white outline-none transition focus:border-[var(--brand)]";

function money(value: number, currency = "NZD") {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

function statusLabel(status: string) {
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function text(value: string | null | undefined) {
  return value?.trim() || "—";
}

export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string; category?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, status, customer_id, vehicle_id, job_reference, repair_type, repair_size, work_source")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!job) notFound();

  const [vehicleResult, customerResult, claimResult, categoryResult, estimateResult, photoResult, partsRequestResult, aiReviewResult] = await Promise.all([
    job.vehicle_id
      ? supabase.from("vehicles").select("registration, vin, make, model, variant, model_year, colour, paint_code, odometer_km, body_type, fuel_type, is_ev, is_hybrid, adas_present").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    job.customer_id
      ? supabase.from("customers").select("first_name, last_name, business_name, email, phone").eq("organization_id", organizationId).eq("id", job.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("claims").select("insurer_id, claim_number, policy_number, assessor_name, assessor_email, assessor_phone, excess_amount, accident_location, accident_description, authority_reference").eq("organization_id", organizationId).eq("job_id", job.id).maybeSingle(),
    supabase.from("estimate_categories").select("id, code, name, pricing_basis, sort_order").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
    supabase.from("estimates").select("id, rate_card_id, status, currency, tax_rate").eq("organization_id", organizationId).eq("job_id", job.id).eq("estimate_type", "primary").maybeSingle(),
    supabase.from("photos").select("id").eq("organization_id", organizationId).eq("job_id", job.id),
    supabase.from("parts_requests").select("id, status").eq("organization_id", organizationId).eq("job_id", job.id).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1),
    supabase.from("ai_review_checks").select("id, severity, resolution").eq("organization_id", organizationId).eq("job_id", job.id),
  ]);

  const vehicle = vehicleResult.data;
  const customer = customerResult.data;
  const claim = claimResult.data;
  const categories = categoryResult.data ?? [];
  const estimate = estimateResult.data;
  const photoCount = photoResult.data?.length ?? 0;
  const partsRequest = partsRequestResult.data?.[0] ?? null;
  const aiChecks = aiReviewResult.data ?? [];

  const [{ data: insurer }, { data: rateCard }] = await Promise.all([
    claim?.insurer_id ? supabase.from("insurers").select("name").eq("organization_id", organizationId).eq("id", claim.insurer_id).maybeSingle() : Promise.resolve({ data: null }),
    estimate?.rate_card_id ? supabase.from("rate_cards").select("name").eq("organization_id", organizationId).eq("id", estimate.rate_card_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const itemResult = estimate
    ? await supabase.from("estimate_items").select("id, category_id, component, side, operation_code, description, quantity, labour_hours, labour_rate, fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount, line_total_ex_tax, source_type, ai_confidence, human_verified, notes, created_at").eq("organization_id", organizationId).eq("estimate_id", estimate.id).order("sort_order").order("created_at")
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
  const selectedCode = categories.some((category) => category.code === query.category) ? query.category : "all";
  const visibleItems = selectedCode === "all" ? items : items.filter((item) => categoryById.get(item.category_id)?.code === selectedCode);
  const itemCounts = new Map(categories.map((category) => [category.id, items.filter((item) => item.category_id === category.id).length]));

  const addAction = addEstimateItem.bind(null, job.id);
  const updateAction = updateEstimateItem.bind(null, job.id);
  const deleteAction = deleteEstimateItem.bind(null, job.id);
  const contextAction = updateEstimateContext.bind(null, job.id);
  const saveVersionAction = saveEstimateVersion.bind(null, job.id);

  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model, vehicle?.variant].filter(Boolean).join(" ") || "Vehicle details pending";
  const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer pending";
  const unresolvedAi = aiChecks.filter((check) => !check.resolution && ["review", "blocking"].includes(check.severity)).length;

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden bg-[#07101c] text-white">
      <header className="shrink-0 border-b border-[var(--border)] bg-[#091322]">
        <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
          <Link href={`/jobs/${job.id}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-white" aria-label="Back to job"><ArrowLeft className="size-4" /></Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]"><span className="font-semibold text-[var(--brand)]">{job.job_number}</span><span>•</span><span>{vehicle?.registration || "Rego pending"}</span><span>•</span><span>{claim?.claim_number || "Claim pending"}</span></div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2"><h1 className="truncate text-base font-semibold sm:text-lg">{vehicleTitle}</h1><span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--muted)] sm:inline">{statusLabel(job.status)}</span></div>
          </div>

          <nav className="hidden items-center gap-1 xl:flex">
            <WorkspaceLink href={`/jobs/${job.id}/photos`} icon={Camera} label={`Photos ${photoCount || ""}`} />
            <WorkspaceLink href={`/jobs/${job.id}/damage`} icon={CarFront} label="Damage" />
            <WorkspaceLink href={`/jobs/${job.id}/parts`} icon={PackageSearch} label={partsRequest ? "Parts" : "Parts"} />
            <WorkspaceLink href={`/jobs/${job.id}/ai-review`} icon={Bot} label={unresolvedAi ? `AI Review ${unresolvedAi}` : "AI Review"} />
            <WorkspaceLink href={`/jobs/${job.id}/history`} icon={History} label="History" />
          </nav>

          {estimate && items.length > 0 ? <form action={saveVersionAction}><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]"><Save className="size-4" /><span className="hidden sm:inline">Save version</span></button></form> : null}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-t border-[var(--border)]/70 px-3 py-2 text-xs sm:px-5">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-[var(--muted)]"><UserRound className="size-3.5" /> {customerName}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-[var(--muted)]"><ShieldCheck className="size-3.5" /> {insurer?.name || "Insurer pending"}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-[var(--muted)]"><CircleDollarSign className="size-3.5" /> {rateCard?.name || "Default workshop rates"}</span>
          <span className="ml-auto hidden shrink-0 text-[11px] text-[var(--muted)] lg:inline">Edit line items directly. Totals are always recalculated by the pricing engine.</span>
        </div>
      </header>

      {query.error ? <div className="shrink-0 border-b border-red-400/30 bg-red-400/10 px-5 py-2 text-xs text-red-100">{query.error}</div> : null}
      {query.message ? <div className="shrink-0 border-b border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-5 py-2 text-xs text-[var(--brand)]">{query.message}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto xl:grid xl:grid-cols-[210px_minmax(720px,1fr)_340px] xl:overflow-hidden">
        <aside className="border-b border-[var(--border)] bg-[#091322] p-3 xl:min-h-0 xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <div className="mb-2 flex items-center justify-between px-2 py-1"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Estimate sections</span><span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px]">{items.length}</span></div>
          <div className="flex gap-2 overflow-x-auto xl:block xl:space-y-1 xl:overflow-visible">
            <CategoryLink href={`/jobs/${job.id}/estimate`} active={selectedCode === "all"} name="All operations" count={items.length} amount={totals.subtotal} currency={currency} />
            {categories.map((category) => (
              <CategoryLink
                key={category.id}
                href={`/jobs/${job.id}/estimate?category=${category.code}`}
                active={selectedCode === category.code}
                name={category.name}
                count={itemCounts.get(category.id) ?? 0}
                amount={totals.categoryTotals[category.code] ?? 0}
                currency={currency}
              />
            ))}
          </div>
          <div className="mt-4 hidden border-t border-[var(--border)] pt-4 xl:block">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Job shortcuts</p>
            <div className="mt-2 space-y-1">
              <SmallLink href={`/jobs/${job.id}`} label="Job overview" />
              <SmallLink href={`/jobs/${job.id}/notes`} label="Notes" />
              <SmallLink href={`/jobs/${job.id}/supplements`} label="Supplements" />
            </div>
          </div>
        </aside>

        <main className="min-w-0 bg-[#07101c] xl:min-h-0 xl:overflow-y-auto">
          <section className="border-b border-[var(--border)] bg-[#0a1423] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">Quick add operation</h2><p className="mt-0.5 text-[11px] text-[var(--muted)]">Leave rate/fixed fields blank to use workshop defaults.</p></div><Plus className="size-4 text-[var(--brand)]" /></div>
            <form action={addAction} className="grid gap-2 md:grid-cols-12">
              <select name="category_id" required className={`${inputClass} md:col-span-2`} defaultValue={selectedCode === "all" ? "" : categories.find((category) => category.code === selectedCode)?.id ?? ""}><option value="" disabled>Category *</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <input name="component" className={`${inputClass} md:col-span-2`} placeholder="Component" />
              <select name="side" className={`${inputClass} md:col-span-1`} defaultValue=""><option value="">Side</option><option value="LH">LH</option><option value="RH">RH</option><option value="FRONT">Front</option><option value="REAR">Rear</option><option value="CENTRE">Centre</option><option value="NA">N/A</option></select>
              <input name="description" required className={`${inputClass} md:col-span-4`} placeholder="Operation description *" />
              <input name="labour_hours" type="number" min="0" step="0.05" className={`${inputClass} md:col-span-1`} placeholder="Hrs" />
              <input name="part_cost" type="number" min="0" step="0.01" className={`${inputClass} md:col-span-1`} placeholder="Part $" />
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-[#06110e] md:col-span-1"><Plus className="size-3.5" /> Add</button>
              <input type="hidden" name="quantity" value="1" />
              <input type="hidden" name="operation_code" value="" />
              <input type="hidden" name="labour_rate" value="" />
              <input type="hidden" name="fixed_amount" value="" />
              <input type="hidden" name="markup_percent" value="0" />
              <input type="hidden" name="freight_amount" value="0" />
              <input type="hidden" name="adjustment_amount" value="0" />
            </form>
          </section>

          <section className="p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-4"><div><h2 className="font-semibold">{selectedCode === "all" ? "All repair operations" : categories.find((category) => category.code === selectedCode)?.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{visibleItems.length} line{visibleItems.length === 1 ? "" : "s"} shown · edit any field and press Save.</p></div><span className="hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--muted)] sm:inline">Subtotal {money(totals.subtotal, currency)}</span></div>

            {visibleItems.length === 0 ? (
              <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[#091322] px-5 text-center"><div><ReceiptText className="mx-auto size-8 text-[var(--muted)]" /><p className="mt-3 font-medium">No operations in this section</p><p className="mt-1 max-w-md text-sm text-[var(--muted)]">Use Quick add above, or run the AI intake/damage workflow and review its suggested lines before pricing them.</p></div></div>
            ) : (
              <div className="space-y-2.5">
                {visibleItems.map((item) => {
                  const category = categoryById.get(item.category_id);
                  return (
                    <form action={updateAction} key={item.id} className={`rounded-xl border bg-[#091322] p-3 transition ${item.source_type === "ai" && !item.human_verified ? "border-amber-300/35" : "border-[var(--border)]"}`}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <div className="grid gap-2 lg:grid-cols-[150px_120px_78px_minmax(250px,1fr)_70px_88px_96px_auto] lg:items-end">
                        <label className="grid gap-1"><span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Category</span><select name="category_id" defaultValue={item.category_id} className={tinyInputClass}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                        <label className="grid gap-1"><span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Component</span><input name="component" defaultValue={item.component ?? ""} className={tinyInputClass} /></label>
                        <label className="grid gap-1"><span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Side</span><select name="side" defaultValue={item.side ?? ""} className={tinyInputClass}><option value="">—</option><option value="LH">LH</option><option value="RH">RH</option><option value="FRONT">Front</option><option value="REAR">Rear</option><option value="CENTRE">Centre</option><option value="NA">N/A</option></select></label>
                        <label className="grid gap-1"><span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Description</span><input name="description" required defaultValue={item.description} className={tinyInputClass} /></label>
                        <label className="grid gap-1"><span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Hours</span><input name="labour_hours" type="number" min="0" step="0.05" defaultValue={Number(item.labour_hours)} className={tinyInputClass} /></label>
                        <label className="grid gap-1"><span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Rate</span><input name="labour_rate" type="number" min="0" step="0.01" defaultValue={Number(item.labour_rate)} className={tinyInputClass} /></label>
                        <label className="grid gap-1"><span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Part cost</span><input name="part_cost" type="number" min="0" step="0.01" defaultValue={Number(item.part_cost)} className={tinyInputClass} /></label>
                        <div className="flex items-end justify-end gap-1">
                          <button type="submit" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-2.5 text-[10px] font-semibold text-[var(--brand)]"><Save className="size-3" /> Save</button>
                          <button type="submit" formAction={deleteAction} aria-label={`Delete ${item.description}`} className="grid size-8 place-items-center rounded-lg border border-red-400/20 text-red-200 transition hover:bg-red-400/10"><Trash2 className="size-3.5" /></button>
                        </div>
                      </div>

                      <details className="mt-2 border-t border-[var(--border)]/60 pt-2">
                        <summary className="cursor-pointer select-none text-[10px] font-medium text-[var(--muted)]">More pricing / notes</summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-8">
                          <label className="grid gap-1"><span className="text-[9px] text-[var(--muted)]">Qty</span><input name="quantity" type="number" min="0.01" step="0.01" defaultValue={Number(item.quantity)} className={tinyInputClass} /></label>
                          <label className="grid gap-1"><span className="text-[9px] text-[var(--muted)]">Fixed</span><input name="fixed_amount" type="number" step="0.01" defaultValue={Number(item.fixed_amount)} className={tinyInputClass} /></label>
                          <label className="grid gap-1"><span className="text-[9px] text-[var(--muted)]">Markup %</span><input name="markup_percent" type="number" min="0" step="0.1" defaultValue={Number(item.markup_percent)} className={tinyInputClass} /></label>
                          <label className="grid gap-1"><span className="text-[9px] text-[var(--muted)]">Freight</span><input name="freight_amount" type="number" min="0" step="0.01" defaultValue={Number(item.freight_amount)} className={tinyInputClass} /></label>
                          <label className="grid gap-1"><span className="text-[9px] text-[var(--muted)]">Adjustment</span><input name="adjustment_amount" type="number" step="0.01" defaultValue={Number(item.adjustment_amount)} className={tinyInputClass} /></label>
                          <label className="grid gap-1"><span className="text-[9px] text-[var(--muted)]">Operation code</span><input name="operation_code" defaultValue={item.operation_code ?? ""} className={tinyInputClass} /></label>
                          <label className="grid gap-1 lg:col-span-2"><span className="text-[9px] text-[var(--muted)]">Notes</span><input name="notes" defaultValue={item.notes ?? ""} className={tinyInputClass} /></label>
                        </div>
                      </details>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">{category?.name || "Category"}</span>
                          {item.source_type !== "manual" ? <span className="rounded-full border border-[var(--brand)]/25 px-2 py-0.5 text-[var(--brand)]">Source: {item.source_type}{item.ai_confidence != null ? ` · ${Math.round(Number(item.ai_confidence) * 100)}%` : ""}</span> : null}
                          <label className="inline-flex items-center gap-1.5 text-[var(--muted)]"><input name="human_verified" type="checkbox" defaultChecked={item.human_verified} className="size-3 accent-[var(--brand)]" /> Estimator verified</label>
                        </div>
                        <strong className="text-xs tabular-nums">{money(Number(item.line_total_ex_tax), currency)} ex GST</strong>
                      </div>
                    </form>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="border-t border-[var(--border)] bg-[#091322] p-3 xl:min-h-0 xl:overflow-y-auto xl:border-l xl:border-t-0">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center gap-2"><ReceiptText className="size-4 text-[var(--brand)]" /><h2 className="text-sm font-semibold">Repair details</h2></div>
            <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {categories.map((category) => {
                const amount = totals.categoryTotals[category.code] ?? 0;
                if (!amount) return null;
                return <div key={category.id} className="flex items-center justify-between gap-3"><span className="truncate text-[var(--muted)]">{category.name}</span><span className="tabular-nums">{money(amount, currency)}</span></div>;
              })}
              {items.length === 0 ? <p className="text-[var(--muted)]">No priced operations yet.</p> : null}
            </div>
            <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
              <div className="flex justify-between text-[var(--muted)]"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal, currency)}</span></div>
              <div className="flex justify-between text-[var(--muted)]"><span>GST {Number(estimate?.tax_rate ?? 15).toFixed(0)}%</span><span className="tabular-nums">{money(totals.tax, currency)}</span></div>
              <div className="flex items-end justify-between border-t border-[var(--border)] pt-3"><span className="font-semibold">Total</span><span className="text-2xl font-semibold tabular-nums">{money(totals.total, currency)}</span></div>
            </div>
          </section>

          <details className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]" open={!vehicle?.make || !customer || !claim?.claim_number}>
            <summary className="flex cursor-pointer list-none items-center justify-between p-4"><span className="flex items-center gap-2 text-sm font-semibold"><Settings2 className="size-4 text-[var(--brand)]" /> Vehicle, customer & claim</span><ChevronRight className="size-4 text-[var(--muted)]" /></summary>
            <form action={contextAction} className="grid gap-3 border-t border-[var(--border)] p-4">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Registration"><input name="registration" defaultValue={vehicle?.registration ?? ""} className={tinyInputClass} /></Field>
                <Field label="VIN"><input name="vin" defaultValue={vehicle?.vin ?? ""} className={tinyInputClass} /></Field>
                <Field label="Year"><input name="model_year" type="number" min="1900" max="2100" defaultValue={vehicle?.model_year ?? ""} className={tinyInputClass} /></Field>
                <Field label="Make"><input name="make" defaultValue={vehicle?.make ?? ""} className={tinyInputClass} /></Field>
                <Field label="Model"><input name="model" defaultValue={vehicle?.model ?? ""} className={tinyInputClass} /></Field>
                <Field label="Variant"><input name="variant" defaultValue={vehicle?.variant ?? ""} className={tinyInputClass} /></Field>
                <Field label="Colour"><input name="colour" defaultValue={vehicle?.colour ?? ""} className={tinyInputClass} /></Field>
                <Field label="Paint code"><input name="paint_code" defaultValue={vehicle?.paint_code ?? ""} className={tinyInputClass} /></Field>
                <Field label="Odometer"><input name="odometer_km" type="number" min="0" defaultValue={vehicle?.odometer_km ?? ""} className={tinyInputClass} /></Field>
                <Field label="Body type"><input name="body_type" defaultValue={vehicle?.body_type ?? ""} className={tinyInputClass} /></Field>
                <Field label="Fuel"><input name="fuel_type" defaultValue={vehicle?.fuel_type ?? ""} className={tinyInputClass} /></Field>
                <Field label="ADAS"><select name="adas_present" defaultValue={vehicle?.adas_present === true ? "true" : vehicle?.adas_present === false ? "false" : ""} className={tinyInputClass}><option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option></select></Field>
              </div>
              <div className="flex gap-4 text-[10px] text-[var(--muted)]"><label className="flex items-center gap-1.5"><input type="checkbox" name="is_ev" defaultChecked={Boolean(vehicle?.is_ev)} className="accent-[var(--brand)]" /> EV</label><label className="flex items-center gap-1.5"><input type="checkbox" name="is_hybrid" defaultChecked={Boolean(vehicle?.is_hybrid)} className="accent-[var(--brand)]" /> Hybrid</label></div>

              <div className="border-t border-[var(--border)] pt-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Customer</div><div className="grid grid-cols-2 gap-2"><input name="customer_first_name" defaultValue={customer?.first_name ?? ""} placeholder="First name" className={tinyInputClass} /><input name="customer_last_name" defaultValue={customer?.last_name ?? ""} placeholder="Last name" className={tinyInputClass} /><input name="customer_email" defaultValue={customer?.email ?? ""} placeholder="Email" className={tinyInputClass} /><input name="customer_phone" defaultValue={customer?.phone ?? ""} placeholder="Phone" className={tinyInputClass} /></div></div>

              <div className="border-t border-[var(--border)] pt-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Insurance / job</div><div className="grid grid-cols-2 gap-2"><input name="insurer_name" defaultValue={insurer?.name ?? ""} placeholder="Insurer" className={tinyInputClass} /><input name="claim_number" defaultValue={claim?.claim_number ?? ""} placeholder="Claim #" className={tinyInputClass} /><input name="policy_number" defaultValue={claim?.policy_number ?? ""} placeholder="Policy #" className={tinyInputClass} /><input name="excess_amount" type="number" min="0" step="0.01" defaultValue={claim?.excess_amount ?? ""} placeholder="Excess" className={tinyInputClass} /><input name="assessor_name" defaultValue={claim?.assessor_name ?? ""} placeholder="Assessor" className={tinyInputClass} /><input name="assessor_phone" defaultValue={claim?.assessor_phone ?? ""} placeholder="Assessor phone" className={tinyInputClass} /><input name="assessor_email" defaultValue={claim?.assessor_email ?? ""} placeholder="Assessor email" className={`${tinyInputClass} col-span-2`} /><input name="job_reference" defaultValue={job.job_reference ?? ""} placeholder="Job reference" className={tinyInputClass} /><input name="work_source" defaultValue={job.work_source ?? ""} placeholder="Work source" className={tinyInputClass} /><select name="repair_type" defaultValue={job.repair_type ?? ""} className={tinyInputClass}><option value="">Repair type</option><option value="collision">Collision</option><option value="mechanical">Mechanical</option><option value="mixed">Collision + mechanical</option><option value="assessment">Assessment only</option></select><select name="repair_size" defaultValue={job.repair_size ?? ""} className={tinyInputClass}><option value="">Repair size</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="major">Major</option></select><input name="authority_reference" defaultValue={claim?.authority_reference ?? ""} placeholder="Authority ref" className={`${tinyInputClass} col-span-2`} /><input name="accident_location" defaultValue={claim?.accident_location ?? ""} placeholder="Accident location" className={`${tinyInputClass} col-span-2`} /><textarea name="accident_description" rows={3} defaultValue={claim?.accident_description ?? ""} placeholder="Accident / repair description" className={`${tinyInputClass} col-span-2`} /></div></div>

              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-[#06110e]"><Save className="size-3.5" /> Save job details</button>
            </form>
          </details>

          <section className="mt-3 rounded-xl border border-[var(--brand)]/25 bg-[rgba(88,211,178,0.06)] p-4">
            <div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" /><div><h2 className="text-sm font-semibold">AI remains review-only</h2><p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">AI lines can be edited here, but prices and labour remain workshop-controlled. Unverified AI lines stay visibly flagged until an estimator checks them.</p><Link href={`/jobs/${job.id}/ai-review`} className="mt-2 inline-flex text-xs font-semibold text-[var(--brand)]">Open AI review →</Link></div></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function WorkspaceLink({ href, icon: Icon, label }: { href: string; icon: typeof Camera; label: string }) {
  return <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-white"><Icon className="size-3.5" /> {label}</Link>;
}

function CategoryLink({ href, active, name, count, amount, currency }: { href: string; active: boolean; name: string; count: number; amount: number; currency: string }) {
  return <Link href={href} className={`min-w-44 shrink-0 rounded-lg border px-2.5 py-2 transition xl:min-w-0 ${active ? "border-[var(--brand)]/35 bg-[rgba(88,211,178,0.08)]" : "border-transparent hover:bg-[var(--surface-2)]"}`}><div className="flex items-center justify-between gap-2"><span className={`truncate text-xs font-medium ${active ? "text-white" : "text-[var(--muted)]"}`}>{name}</span><span className="rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">{count}</span></div><div className="mt-1 text-[10px] tabular-nums text-[var(--muted)]">{money(amount, currency)}</div></Link>;
}

function SmallLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="flex items-center justify-between rounded-lg px-2 py-2 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-white"><span>{label}</span><ChevronRight className="size-3" /></Link>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1"><span className="text-[9px] text-[var(--muted)]">{label}</span>{children}</label>;
}
