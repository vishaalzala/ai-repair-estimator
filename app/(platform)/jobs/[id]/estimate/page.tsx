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
import { syncAutomaticEstimateCharges } from "@/lib/estimating/automatic-charges";
import { syncAutomaticParkingFee } from "@/lib/estimating/parking-fees";
import { calculateEstimateTotals } from "@/lib/estimating/pricing-engine";
import {
  AutoSaveForm,
  AutosaveLink,
  EstimateSaveStatus,
  PrintEstimateButton,
} from "@/components/estimates/estimate-autosave";
import {
  addEstimateItem,
  createPrintableEstimateVersion,
  deleteEstimateItem,
  saveEstimateVersion,
  updateEstimateContext,
  updateEstimateItem,
} from "./actions";

const inputClass = "min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";
const rowInputClass = "min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

function money(value: number, currency = "NZD") {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

function statusLabel(status: string) {
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
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
  const displayCategories = categories.filter((category) => category.code !== "blend");
  const estimate = estimateResult.data;
  const photoCount = photoResult.data?.length ?? 0;
  const partsRequest = partsRequestResult.data?.[0] ?? null;
  const aiChecks = aiReviewResult.data ?? [];

  if (estimate) {
    await syncAutomaticParkingFee(job.id);
    await syncAutomaticEstimateCharges(job.id);
  }

  const [{ data: insurer }, { data: rateCard }] = await Promise.all([
    claim?.insurer_id ? supabase.from("insurers").select("name").eq("organization_id", organizationId).eq("id", claim.insurer_id).maybeSingle() : Promise.resolve({ data: null }),
    estimate?.rate_card_id ? supabase.from("rate_cards").select("name").eq("organization_id", organizationId).eq("id", estimate.rate_card_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const itemResult = estimate
    ? await supabase
        .from("estimate_items")
        .select("id, category_id, side, operation_code, description, quantity, labour_hours, labour_rate, fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount, line_total_ex_tax, source_type, source_ref, ai_confidence, human_verified, report_selected, blend_selected, extra_selected, notes, created_at")
        .eq("organization_id", organizationId)
        .eq("estimate_id", estimate.id)
        .order("sort_order")
        .order("created_at")
    : { data: [] };
  const items = itemResult.data ?? [];

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totals = calculateEstimateTotals(
    items.map((item) => ({
      lineTotalExTax: Number(item.line_total_ex_tax),
      categoryCode: categoryById.get(item.category_id)?.code,
      reportSelected: Boolean(item.report_selected),
      extraSelected: Boolean(item.extra_selected),
    })),
    Number(estimate?.tax_rate ?? 15),
  );
  const currency = estimate?.currency ?? "NZD";
  const itemCounts = new Map(displayCategories.map((category) => [category.id, items.filter((item) => item.category_id === category.id).length]));

  const addAction = addEstimateItem.bind(null, job.id);
  const updateAction = updateEstimateItem.bind(null, job.id);
  const deleteAction = deleteEstimateItem.bind(null, job.id);
  const contextAction = updateEstimateContext.bind(null, job.id);
  const saveVersionAction = saveEstimateVersion.bind(null, job.id);
  const printAction = createPrintableEstimateVersion.bind(null, job.id);

  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model, vehicle?.variant].filter(Boolean).join(" ") || "Vehicle details pending";
  const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer pending";
  const unresolvedAi = aiChecks.filter((check) => !check.resolution && ["review", "blocking"].includes(check.severity)).length;

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden bg-[#f6f8fb] text-slate-950">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
          <AutosaveLink href={`/jobs/${job.id}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" ariaLabel="Back to job"><ArrowLeft className="size-4" /></AutosaveLink>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="font-semibold text-emerald-600">{job.job_number}</span><span>•</span><span>{vehicle?.registration || "Rego pending"}</span><span>•</span><span>{claim?.claim_number || "Claim pending"}</span></div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2"><h1 className="truncate text-base font-semibold sm:text-lg">{vehicleTitle}</h1><span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 sm:inline">{statusLabel(job.status)}</span></div>
          </div>

          <nav className="hidden items-center gap-1 xl:flex">
            <WorkspaceLink href={`/jobs/${job.id}/photos`} icon={Camera} label={`Photos ${photoCount || ""}`} />
            <WorkspaceLink href={`/jobs/${job.id}/damage`} icon={CarFront} label="Damage" />
            <WorkspaceLink href={`/jobs/${job.id}/parts`} icon={PackageSearch} label={partsRequest ? "Parts" : "Parts"} />
            <WorkspaceLink href={`/jobs/${job.id}/ai-review`} icon={Bot} label={unresolvedAi ? `AI Review ${unresolvedAi}` : "AI Review"} />
            <WorkspaceLink href={`/jobs/${job.id}/history`} icon={History} label="History" />
          </nav>

          <div className="hidden md:block"><EstimateSaveStatus /></div>
          {estimate && items.length > 0 ? <PrintEstimateButton action={printAction} /> : null}
          {estimate && items.length > 0 ? <form action={saveVersionAction}><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"><Save className="size-4" /><span className="hidden sm:inline">Save version</span></button></form> : null}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 px-3 py-2 text-xs sm:px-5">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-500"><UserRound className="size-3.5" /> {customerName}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-500"><ShieldCheck className="size-3.5" /> {insurer?.name || "Insurer pending"}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-500"><CircleDollarSign className="size-3.5" /> {rateCard?.name || "Default workshop rates"}</span>
          <span className="ml-auto hidden shrink-0 text-[11px] text-slate-500 lg:inline">Extra and Report prices stay visible but are excluded from the current total.</span>
        </div>
      </header>

      {query.error ? <div className="shrink-0 border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700">{query.error}</div> : null}
      {query.message ? <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-5 py-2 text-xs text-emerald-700">{query.message}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto xl:grid xl:grid-cols-[190px_minmax(820px,1fr)_330px] xl:overflow-hidden">
        <aside className="border-b border-slate-200 bg-white p-3 xl:min-h-0 xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <div className="mb-2 flex items-center justify-between px-2 py-1"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Estimate sections</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{items.length}</span></div>
          <div className="flex gap-2 overflow-x-auto xl:block xl:space-y-1 xl:overflow-visible">
            {displayCategories.map((category) => (
              <CategoryJump
                key={category.id}
                href={`#category-${category.code}`}
                name={category.name}
                count={itemCounts.get(category.id) ?? 0}
                amount={totals.categoryTotals[category.code] ?? 0}
                currency={currency}
              />
            ))}
          </div>
          <div className="mt-4 hidden border-t border-slate-200 pt-4 xl:block">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Job shortcuts</p>
            <div className="mt-2 space-y-1">
              <SmallLink href={`/jobs/${job.id}`} label="Job overview" />
              <SmallLink href={`/jobs/${job.id}/notes`} label="Notes" />
              <SmallLink href={`/jobs/${job.id}/supplements`} label="Supplements" />
            </div>
          </div>
        </aside>

        <main className="min-w-0 bg-[#f6f8fb] xl:min-h-0 xl:overflow-y-auto">
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
            <div><h2 className="text-sm font-semibold">Repair operations</h2><p className="text-[10px] text-slate-500">Changes autosave. Extra and Report-only lines are shown separately from the current total.</p></div>
            <div className="text-right"><div className="text-[10px] text-slate-500">Current estimate total</div><div className="font-semibold tabular-nums text-emerald-600">{money(totals.total, currency)}</div></div>
          </div>

          <div className="space-y-3 p-3 sm:p-4">
            {displayCategories.map((category) => {
              const categoryItems = items.filter((item) => item.category_id === category.id);
              const categoryTotal = totals.categoryTotals[category.code] ?? 0;
              const isFixed = category.pricing_basis === "fixed";
              const isPaint = category.code === "paint";
              const rowGridClass = isPaint
                ? "lg:grid-cols-[minmax(330px,1fr)_74px_58px_62px_58px_72px_86px_96px_44px]"
                : "lg:grid-cols-[minmax(350px,1fr)_74px_58px_62px_72px_86px_96px_44px]";

              return (
                <section id={`category-${category.code}`} key={category.id} className="scroll-mt-16 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-3 py-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><ClipboardList className="size-4" /></span><div className="min-w-0"><h3 className="truncate text-base font-semibold text-slate-950">{category.name}</h3><p className="text-[9px] uppercase tracking-[0.13em] text-slate-500">{category.pricing_basis} pricing · {categoryItems.length} line{categoryItems.length === 1 ? "" : "s"}</p></div></div>
                    <span className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-emerald-600">{money(categoryTotal, currency)}</span>
                  </div>

                  <div className={`hidden gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-medium uppercase tracking-wide text-slate-500 lg:grid ${rowGridClass}`}>
                    <span>Description</span><span>Side</span><span className="text-center text-amber-600">Extra</span><span className="text-center">Report</span>{isPaint ? <span className="text-center">Blend</span> : null}<span className="text-right">Hours</span><span className="text-right">{isFixed ? "Fixed $" : "Rate $"}</span><span className="text-right">Price</span><span />
                  </div>

                  <div className="divide-y divide-slate-100">
                    {categoryItems.map((item) => {
                      const isAutomatic = item.source_type === "rule" && (String(item.source_ref || "").startsWith("auto:") || item.source_ref === "parking_fee_daily");
                      const rowTone = item.extra_selected ? "bg-amber-50" : item.report_selected ? "bg-sky-50" : item.source_type === "ai" && !item.human_verified ? "bg-amber-50/40" : "bg-white";
                      const rowFields = (
                        <>
                          <input type="hidden" name="item_id" value={item.id} />
                          <input type="hidden" name="category_id" value={category.id} />
                          <input type="hidden" name="quantity" value={Number(item.quantity)} />
                          <input type="hidden" name="operation_code" value={item.operation_code ?? ""} />
                          <input type="hidden" name="part_cost" value={Number(item.part_cost)} />
                          <input type="hidden" name="markup_percent" value={Number(item.markup_percent)} />
                          <input type="hidden" name="freight_amount" value={Number(item.freight_amount)} />
                          <input type="hidden" name="adjustment_amount" value={Number(item.adjustment_amount)} />
                          <input type="hidden" name="notes" value={item.notes ?? ""} />
                          {isFixed ? <input type="hidden" name="labour_rate" value={Number(item.labour_rate)} /> : <input type="hidden" name="fixed_amount" value={Number(item.fixed_amount)} />}

                          <div className={`grid gap-2 lg:items-center ${rowGridClass}`}>
                            <input name="description" required defaultValue={item.description} disabled={isAutomatic} className={rowInputClass} placeholder="Description" />
                            <select name="side" defaultValue={item.side ?? ""} disabled={isAutomatic} className={rowInputClass}><option value="">—</option><option value="LH">LH</option><option value="RH">RH</option><option value="FRONT">Front</option><option value="REAR">Rear</option><option value="CENTRE">Centre</option><option value="NA">N/A</option></select>
                            <label className="flex items-center justify-start gap-2 text-[10px] text-slate-500 lg:justify-center"><input name="extra_selected" type="checkbox" defaultChecked={Boolean(item.extra_selected)} disabled={isAutomatic} className="size-4 accent-orange-500" /><span className="lg:hidden">Extra</span></label>
                            <label className="flex items-center justify-start gap-2 text-[10px] text-slate-500 lg:justify-center"><input name="report_selected" type="checkbox" defaultChecked={Boolean(item.report_selected)} disabled={isAutomatic} className="size-4 accent-emerald-500" /><span className="lg:hidden">Report</span></label>
                            {isPaint ? <label className="flex items-center justify-start gap-2 text-[10px] text-slate-500 lg:justify-center"><input name="blend_selected" type="checkbox" defaultChecked={Boolean(item.blend_selected)} disabled={isAutomatic} className="size-4 accent-emerald-500" /><span className="lg:hidden">Blend</span></label> : null}
                            <input name="labour_hours" type="number" min="0" step="0.05" defaultValue={Number(item.labour_hours)} disabled={isAutomatic} className={`${rowInputClass} text-right tabular-nums`} />
                            {isFixed ? <input name="fixed_amount" type="number" step="0.01" defaultValue={Number(item.fixed_amount)} disabled={isAutomatic} className={`${rowInputClass} text-right tabular-nums`} /> : <input name="labour_rate" type="number" min="0" step="0.01" defaultValue={Number(item.labour_rate)} disabled={isAutomatic} className={`${rowInputClass} text-right tabular-nums`} />}
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">{money(Number(item.line_total_ex_tax), currency)}</div>
                            <div className="flex items-center justify-end gap-1.5">
                              {!isAutomatic ? <button type="submit" formAction={deleteAction} data-native-submit="true" title="Delete line" className="grid size-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"><Trash2 className="size-3.5" /></button> : <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-[9px] font-semibold text-emerald-700">AUTO</span>}
                            </div>
                          </div>

                          {item.extra_selected ? <div className="mt-2 text-[10px] font-semibold text-amber-700">EXTRA · price shown but excluded from the current estimate total.</div> : item.report_selected ? <div className="mt-2 text-[10px] font-semibold text-sky-700">REPORT ONLY · price shown but excluded from the current estimate total.</div> : null}
                          {isAutomatic ? <div className="mt-2 text-[10px] text-emerald-700">Automatic workshop charge · controlled in Settings → Workshop.</div> : item.source_type !== "manual" ? <div className="mt-2 flex items-center gap-2 text-[9px] text-amber-700"><Sparkles className="size-3" /><span>AI suggestion{item.ai_confidence != null ? ` · ${Math.round(Number(item.ai_confidence) * 100)}% confidence` : ""}. Estimator review required.</span></div> : null}
                        </>
                      );

                      return isAutomatic ? <div key={item.id} className={`${rowTone} px-3 py-2.5`}>{rowFields}</div> : <AutoSaveForm key={item.id} action={updateAction} className={`${rowTone} px-3 py-2.5`}>{rowFields}</AutoSaveForm>;
                    })}
                  </div>

                  <form action={addAction} className="border-t border-slate-200 bg-slate-50 px-3 py-3">
                    <input type="hidden" name="category_id" value={category.id} />
                    <input type="hidden" name="quantity" value="1" />
                    <input type="hidden" name="operation_code" value="" />
                    <input type="hidden" name="part_cost" value="0" />
                    <input type="hidden" name="markup_percent" value="0" />
                    <input type="hidden" name="freight_amount" value="0" />
                    <input type="hidden" name="adjustment_amount" value="0" />
                    {isFixed ? <input type="hidden" name="labour_rate" value="" /> : <input type="hidden" name="fixed_amount" value="" />}
                    <div className={`grid gap-2 lg:items-center ${rowGridClass}`}>
                      <input name="description" required className={rowInputClass} placeholder={`Add ${category.name.toLowerCase()} operation…`} />
                      <select name="side" className={rowInputClass} defaultValue=""><option value="">—</option><option value="LH">LH</option><option value="RH">RH</option><option value="FRONT">Front</option><option value="REAR">Rear</option><option value="CENTRE">Centre</option><option value="NA">N/A</option></select>
                      <label className="flex items-center justify-start gap-2 text-[10px] text-slate-500 lg:justify-center"><input name="extra_selected" type="checkbox" className="size-4 accent-orange-500" /><span className="lg:hidden">Extra</span></label>
                      <label className="flex items-center justify-start gap-2 text-[10px] text-slate-500 lg:justify-center"><input name="report_selected" type="checkbox" className="size-4 accent-emerald-500" /><span className="lg:hidden">Report</span></label>
                      {isPaint ? <label className="flex items-center justify-start gap-2 text-[10px] text-slate-500 lg:justify-center"><input name="blend_selected" type="checkbox" className="size-4 accent-emerald-500" /><span className="lg:hidden">Blend</span></label> : null}
                      <input name="labour_hours" type="number" min="0" step="0.05" className={`${rowInputClass} text-right`} placeholder="0" />
                      {isFixed ? <input name="fixed_amount" type="number" step="0.01" className={`${rowInputClass} text-right`} placeholder="0.00" /> : <input name="labour_rate" type="number" min="0" step="0.01" className={`${rowInputClass} text-right`} placeholder="Rate" />}
                      <span className="hidden rounded-lg border border-slate-200 bg-white px-2 py-2 text-right text-xs text-slate-400 lg:block">—</span>
                      <button type="submit" title={`Add ${category.name} line`} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-emerald-500 px-2 text-[10px] font-semibold text-emerald-950 transition hover:bg-emerald-400"><Plus className="size-3.5" /><span className="lg:hidden">Add</span></button>
                    </div>
                  </form>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500"><span>{category.name} included total:</span><strong className="text-sm tabular-nums text-slate-950">{money(categoryTotal, currency)}</strong></div>
                </section>
              );
            })}

            {displayCategories.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No estimate categories are configured for this workshop.</div> : null}
          </div>
        </main>

        <aside className="border-t border-slate-200 bg-white p-3 xl:min-h-0 xl:overflow-y-auto xl:border-l xl:border-t-0">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><ReceiptText className="size-4 text-emerald-600" /><h2 className="text-sm font-semibold">Estimate totals</h2></div>
            <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {displayCategories.map((category) => {
                const amount = totals.categoryTotals[category.code] ?? 0;
                if (!amount) return null;
                return <div key={category.id} className="flex items-center justify-between gap-3"><span className="truncate text-slate-500">{category.name}</span><span className="tabular-nums">{money(amount, currency)}</span></div>;
              })}
              {items.length === 0 ? <p className="text-slate-500">No priced operations yet.</p> : null}
            </div>
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-xs">
              <div className="flex justify-between text-slate-500"><span>Included subtotal</span><span className="tabular-nums">{money(totals.subtotal, currency)}</span></div>
              {totals.reportOnlySubtotal > 0 ? <div className="flex justify-between rounded-lg bg-sky-50 px-2 py-1.5 text-sky-700"><span>Report only · excluded</span><span className="tabular-nums">{money(totals.reportOnlySubtotal, currency)}</span></div> : null}
              {totals.extraSubtotal > 0 ? <div className="flex justify-between rounded-lg bg-amber-50 px-2 py-1.5 font-semibold text-amber-700"><span>Pending extras · excluded</span><span className="tabular-nums">{money(totals.extraSubtotal, currency)}</span></div> : null}
              <div className="flex justify-between text-slate-500"><span>GST {Number(estimate?.tax_rate ?? 15).toFixed(0)}%</span><span className="tabular-nums">{money(totals.tax, currency)}</span></div>
              <div className="flex items-end justify-between border-t border-slate-200 pt-3"><span className="font-semibold">Current total</span><span className="text-2xl font-semibold tabular-nums">{money(totals.total, currency)}</span></div>
            </div>
          </section>

          <details className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm" open={!vehicle?.make || !customer || !claim?.claim_number}>
            <summary className="flex cursor-pointer list-none items-center justify-between p-4"><span className="flex items-center gap-2 text-sm font-semibold"><Settings2 className="size-4 text-emerald-600" /> Vehicle, customer & claim</span><ChevronRight className="size-4 text-slate-400" /></summary>
            <AutoSaveForm action={contextAction} className="grid gap-3 border-t border-slate-200 p-4" debounceMs={900}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Registration"><input name="registration" defaultValue={vehicle?.registration ?? ""} className={inputClass} /></Field>
                <Field label="VIN"><input name="vin" defaultValue={vehicle?.vin ?? ""} className={inputClass} /></Field>
                <Field label="Year"><input name="model_year" type="number" min="1900" max="2100" defaultValue={vehicle?.model_year ?? ""} className={inputClass} /></Field>
                <Field label="Make"><input name="make" defaultValue={vehicle?.make ?? ""} className={inputClass} /></Field>
                <Field label="Model"><input name="model" defaultValue={vehicle?.model ?? ""} className={inputClass} /></Field>
                <Field label="Variant"><input name="variant" defaultValue={vehicle?.variant ?? ""} className={inputClass} /></Field>
                <Field label="Colour"><input name="colour" defaultValue={vehicle?.colour ?? ""} className={inputClass} /></Field>
                <Field label="Paint code"><input name="paint_code" defaultValue={vehicle?.paint_code ?? ""} className={inputClass} /></Field>
                <Field label="Odometer"><input name="odometer_km" type="number" min="0" defaultValue={vehicle?.odometer_km ?? ""} className={inputClass} /></Field>
                <Field label="Body type"><input name="body_type" defaultValue={vehicle?.body_type ?? ""} className={inputClass} /></Field>
                <Field label="Fuel"><input name="fuel_type" defaultValue={vehicle?.fuel_type ?? ""} className={inputClass} /></Field>
                <Field label="ADAS"><select name="adas_present" defaultValue={vehicle?.adas_present === true ? "true" : vehicle?.adas_present === false ? "false" : ""} className={inputClass}><option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option></select></Field>
              </div>
              <div className="flex gap-4 text-[10px] text-slate-500"><label className="flex items-center gap-1.5"><input type="checkbox" name="is_ev" defaultChecked={Boolean(vehicle?.is_ev)} className="accent-emerald-500" /> EV</label><label className="flex items-center gap-1.5"><input type="checkbox" name="is_hybrid" defaultChecked={Boolean(vehicle?.is_hybrid)} className="accent-emerald-500" /> Hybrid</label></div>

              <div className="border-t border-slate-200 pt-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Customer</div><div className="grid grid-cols-2 gap-2"><input name="customer_first_name" defaultValue={customer?.first_name ?? ""} placeholder="First name" className={inputClass} /><input name="customer_last_name" defaultValue={customer?.last_name ?? ""} placeholder="Last name" className={inputClass} /><input name="customer_email" defaultValue={customer?.email ?? ""} placeholder="Email" className={inputClass} /><input name="customer_phone" defaultValue={customer?.phone ?? ""} placeholder="Phone" className={inputClass} /></div></div>

              <div className="border-t border-slate-200 pt-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Insurance / job</div><div className="grid grid-cols-2 gap-2"><input name="insurer_name" defaultValue={insurer?.name ?? ""} placeholder="Insurer" className={inputClass} /><input name="claim_number" defaultValue={claim?.claim_number ?? ""} placeholder="Claim #" className={inputClass} /><input name="policy_number" defaultValue={claim?.policy_number ?? ""} placeholder="Policy #" className={inputClass} /><input name="excess_amount" type="number" min="0" step="0.01" defaultValue={claim?.excess_amount ?? ""} placeholder="Excess" className={inputClass} /><input name="assessor_name" defaultValue={claim?.assessor_name ?? ""} placeholder="Assessor" className={inputClass} /><input name="assessor_phone" defaultValue={claim?.assessor_phone ?? ""} placeholder="Assessor phone" className={inputClass} /><input name="assessor_email" defaultValue={claim?.assessor_email ?? ""} placeholder="Assessor email" className={`${inputClass} col-span-2`} /><input name="job_reference" defaultValue={job.job_reference ?? ""} placeholder="Job reference" className={inputClass} /><input name="work_source" defaultValue={job.work_source ?? ""} placeholder="Work source" className={inputClass} /><select name="repair_type" defaultValue={job.repair_type ?? ""} className={inputClass}><option value="">Repair type</option><option value="collision">Collision</option><option value="mechanical">Mechanical</option><option value="mixed">Collision + mechanical</option><option value="assessment">Assessment only</option></select><select name="repair_size" defaultValue={job.repair_size ?? ""} className={inputClass}><option value="">Repair size</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="major">Major</option></select><input name="authority_reference" defaultValue={claim?.authority_reference ?? ""} placeholder="Authority ref" className={`${inputClass} col-span-2`} /><input name="accident_location" defaultValue={claim?.accident_location ?? ""} placeholder="Accident location" className={`${inputClass} col-span-2`} /><textarea name="accident_description" rows={3} defaultValue={claim?.accident_description ?? ""} placeholder="Accident / repair description" className={`${inputClass} col-span-2`} /></div></div>
              <p className="text-[10px] text-slate-500">These details autosave after you stop typing.</p>
            </AutoSaveForm>
          </details>

          <section className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600" /><div><h2 className="text-sm font-semibold">Estimator-controlled review</h2><p className="mt-1 text-[11px] leading-5 text-slate-600">Suggestions stay visibly marked until an estimator checks them. Labour, rates, parts pricing and totals remain workshop controlled.</p><AutosaveLink href={`/jobs/${job.id}/ai-review`} className="mt-2 inline-flex text-xs font-semibold text-emerald-700">Open estimate review →</AutosaveLink></div></div></section>
        </aside>
      </div>
    </div>
  );
}

function WorkspaceLink({ href, icon: Icon, label }: { href: string; icon: typeof Camera; label: string }) {
  return <AutosaveLink href={href} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"><Icon className="size-3.5" /> {label}</AutosaveLink>;
}

function CategoryJump({ href, name, count, amount, currency }: { href: string; name: string; count: number; amount: number; currency: string }) {
  return <Link href={href} className="min-w-44 shrink-0 rounded-lg border border-transparent px-2.5 py-2 transition hover:border-emerald-200 hover:bg-emerald-50 xl:min-w-0"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium text-slate-600">{name}</span><span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{count}</span></div><div className="mt-1 text-[10px] tabular-nums text-slate-500">{money(amount, currency)}</div></Link>;
}

function SmallLink({ href, label }: { href: string; label: string }) {
  return <AutosaveLink href={href} className="flex items-center justify-between rounded-lg px-2 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"><span>{label}</span><ChevronRight className="size-3" /></AutosaveLink>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1"><span className="text-[9px] text-slate-500">{label}</span>{children}</label>;
}
