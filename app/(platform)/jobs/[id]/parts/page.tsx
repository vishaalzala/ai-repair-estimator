import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, PackageSearch, Plus, Truck } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { addManualPartQuote, addPartRequestItem, selectPartQuote } from "./actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";

function money(value: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value);
}

export default async function JobPartsPage({
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
    .select("id, job_number, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const { data: request } = await supabase
    .from("parts_requests")
    .select("id, status, provider, external_reference")
    .eq("organization_id", organizationId)
    .eq("job_id", job.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [vehicleResult, requestItemResult, quoteResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    request ? supabase.from("parts_request_items").select("id, description, component, side, part_number, quantity, part_type, status, notes").eq("parts_request_id", request.id).order("created_at") : Promise.resolve({ data: [] }),
    request ? supabase.from("parts_quotes").select("id, supplier_id, quoted_at, bulk_lot_amount, freight_amount, provider_fee_amount").eq("parts_request_id", request.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const vehicle = vehicleResult.data;
  const requestItems = requestItemResult.data ?? [];
  const quotes = quoteResult.data ?? [];
  const quoteIds = quotes.map((quote) => quote.id);
  const supplierIds = quotes.map((quote) => quote.supplier_id).filter((value): value is string => Boolean(value));

  const [quoteItemResult, supplierResult] = await Promise.all([
    quoteIds.length ? supabase.from("parts_quote_items").select("id, parts_quote_id, request_item_id, supplier_part_number, part_type, unit_cost, quantity, markup_percent, item_freight, sell_amount, availability, lead_time, is_selected").in("parts_quote_id", quoteIds) : Promise.resolve({ data: [] }),
    supplierIds.length ? supabase.from("suppliers").select("id, name").in("id", supplierIds) : Promise.resolve({ data: [] }),
  ]);
  const quoteItems = quoteItemResult.data ?? [];
  const suppliers = supplierResult.data ?? [];
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const requestItemById = new Map(requestItems.map((item) => [item.id, item]));

  const addPartAction = addPartRequestItem.bind(null, job.id);
  const addQuoteAction = addManualPartQuote.bind(null, job.id);
  const selectQuoteAction = selectPartQuote.bind(null, job.id);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><PackageSearch className="size-4" /> Parts sourcing</div><h1 className="text-3xl font-semibold tracking-tight">Parts</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · PartsTrader-compatible manual workflow for V1.</p></header>

      {error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Parts required</h2><p className="mt-1 text-xs text-[var(--muted)]">Keep unknown prices as TBC until a supplier quote is entered.</p></div>{request ? <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs">{request.status.replaceAll("_", " ")}</span> : null}</div>
            {requestItems.length === 0 ? <div className="mb-5 rounded-xl border border-dashed border-[var(--border)] bg-[#091322] p-6 text-center text-sm text-[var(--muted)]">No parts have been requested yet.</div> : <div className="mb-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-[11px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="pb-3 font-medium">Part</th><th className="pb-3 font-medium">Type</th><th className="pb-3 font-medium">Qty</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody>{requestItems.map((item) => <tr key={item.id} className="border-t border-[var(--border)]"><td className="py-3 pr-4"><div className="font-medium">{item.description}</div><div className="mt-1 text-xs text-[var(--muted)]">{[item.side, item.component, item.part_number].filter(Boolean).join(" · ") || "Part number TBC"}</div></td><td className="py-3 pr-4 text-[var(--muted)]">{item.part_type}</td><td className="py-3 pr-4 tabular-nums">{Number(item.quantity)}</td><td className="py-3"><span className={`rounded-full border px-2 py-0.5 text-xs ${item.status === "selected" ? "border-[var(--brand)]/30 text-[var(--brand)]" : "border-[var(--border)] text-[var(--muted)]"}`}>{item.status}</span></td></tr>)}</tbody></table></div>}

            <form action={addPartAction} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><input name="description" required placeholder="Part description *" className={`${inputClass} lg:col-span-2`} /><input name="component" placeholder="Component" className={inputClass} /><select name="side" className={inputClass} defaultValue=""><option value="">No side</option><option value="LH">LH</option><option value="RH">RH</option><option value="FRONT">Front</option><option value="REAR">Rear</option></select><input name="part_number" placeholder="Part number" className={inputClass} /><input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className={inputClass} /><select name="part_type" className={inputClass} defaultValue="tbc"><option value="tbc">TBC</option><option value="oem">OEM</option><option value="aftermarket">Aftermarket</option><option value="recycled">Recycled</option><option value="other">Other</option></select><button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><Plus className="size-4" /> Add part</button></form>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><Truck className="size-5 text-[var(--brand)]" /><div><h2 className="font-semibold">Supplier quotes</h2><p className="mt-1 text-xs text-[var(--muted)]">Bulk lot, freight and provider fees stay separate at request level.</p></div></div>
            {quoteItems.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] bg-[#091322] p-6 text-center text-sm text-[var(--muted)]">No quotes entered yet.</div> : <div className="space-y-3">{quoteItems.map((quoteItem) => { const quote = quoteById.get(quoteItem.parts_quote_id); const requestItem = requestItemById.get(quoteItem.request_item_id); return <article key={quoteItem.id} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[#091322] p-4 md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{requestItem?.description || "Part"}</strong>{quoteItem.is_selected ? <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand)]/30 px-2 py-0.5 text-[10px] text-[var(--brand)]"><CheckCircle2 className="size-3" /> Selected</span> : null}</div><p className="mt-1 text-xs text-[var(--muted)]">{supplierById.get(quote?.supplier_id || "") || "Supplier"} · {quoteItem.part_type} · {quoteItem.supplier_part_number || "No supplier part #"}</p><p className="mt-2 text-xs text-[var(--muted)]">Cost {money(Number(quoteItem.unit_cost))} · Markup {Number(quoteItem.markup_percent).toFixed(1)}% · Freight {money(Number(quoteItem.item_freight))}{quoteItem.availability ? ` · ${quoteItem.availability}` : ""}</p></div><div className="flex items-center gap-3 md:flex-col md:items-end md:justify-center"><strong className="text-lg tabular-nums">{money(Number(quoteItem.sell_amount))}</strong>{!quoteItem.is_selected ? <form action={selectQuoteAction}><input type="hidden" name="quote_item_id" value={quoteItem.id} /><button type="submit" className="text-xs font-semibold text-[var(--brand)]">Select quote</button></form> : null}</div></article>; })}</div>}
          </section>
        </div>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 xl:sticky xl:top-6 xl:self-start">
          <h2 className="font-semibold">Enter manual quote</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Use this after receiving a supplier or PartsTrader response. Direct provider integration remains behind the future adapter.</p>
          <form action={addQuoteAction} className="mt-5 grid gap-3">
            <select name="request_item_id" required className={inputClass} defaultValue=""><option value="" disabled>Select requested part</option>{requestItems.map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select>
            <input name="supplier_name" required placeholder="Supplier *" className={inputClass} />
            <input name="supplier_part_number" placeholder="Supplier part number" className={inputClass} />
            <select name="part_type" className={inputClass} defaultValue="other"><option value="oem">OEM</option><option value="aftermarket">Aftermarket</option><option value="recycled">Recycled</option><option value="other">Other</option></select>
            <div className="grid grid-cols-2 gap-3"><input name="unit_cost" required type="number" min="0" step="0.01" placeholder="Unit cost *" className={inputClass} /><input name="markup_percent" type="number" min="0" step="0.1" placeholder="Markup %" className={inputClass} /></div>
            <div className="grid grid-cols-2 gap-3"><input name="item_freight" type="number" min="0" step="0.01" placeholder="Freight" className={inputClass} /><input name="lead_time" placeholder="Lead time" className={inputClass} /></div>
            <input name="availability" placeholder="Availability" className={inputClass} />
            <button type="submit" disabled={!requestItems.length} className="mt-1 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e] disabled:cursor-not-allowed disabled:opacity-50">Save quote</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
