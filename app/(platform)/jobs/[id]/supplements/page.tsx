import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FilePlus2, History, Plus, ReceiptText, Trash2 } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { calculateEstimateTotals } from "@/lib/estimating/pricing-engine";
import { addSupplementItem, deleteSupplementItem, saveSupplementVersion, startSupplement } from "./actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";

function money(value: number, currency = "NZD") {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

export default async function SupplementsPage({
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
    .select("id, job_number, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const [vehicleResult, categoryResult, supplementResult, versionResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("estimate_categories").select("id, code, name, sort_order").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
    supabase.from("supplements").select("id, base_estimate_version_id, supplement_number, status, reason, currency, tax_rate, created_at").eq("organization_id", organizationId).eq("job_id", job.id).order("supplement_number", { ascending: false }),
    supabase.from("estimate_versions").select("id, version_number, total_inc_tax, created_at").eq("organization_id", organizationId).eq("job_id", job.id).order("version_number", { ascending: false }),
  ]);

  const vehicle = vehicleResult.data;
  const categories = categoryResult.data ?? [];
  const supplements = supplementResult.data ?? [];
  const estimateVersions = versionResult.data ?? [];
  const activeSupplement = supplements.find((supplement) => supplement.status === "draft") ?? supplements[0];

  const { data: itemData } = activeSupplement
    ? await supabase.from("supplement_items").select("id, category_id, component, side, operation_code, description, quantity, labour_hours, labour_rate, fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount, line_total_ex_tax, source_type, created_at").eq("organization_id", organizationId).eq("supplement_id", activeSupplement.id).order("sort_order").order("created_at")
    : { data: [] };
  const items = itemData ?? [];

  const { data: supplementVersionsData } = activeSupplement
    ? await supabase.from("supplement_versions").select("id, version_number, status_snapshot, subtotal_ex_tax, tax_amount, total_inc_tax, created_at").eq("organization_id", organizationId).eq("supplement_id", activeSupplement.id).order("version_number", { ascending: false })
    : { data: [] };
  const supplementVersions = supplementVersionsData ?? [];

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totals = calculateEstimateTotals(items.map((item) => ({ lineTotalExTax: Number(item.line_total_ex_tax), categoryCode: categoryById.get(item.category_id)?.code })), Number(activeSupplement?.tax_rate ?? 15));
  const startAction = startSupplement.bind(null, job.id);
  const addAction = addSupplementItem.bind(null, job.id);
  const deleteAction = deleteSupplementItem.bind(null, job.id);
  const saveAction = saveSupplementVersion.bind(null, job.id);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";
  const baseVersion = activeSupplement ? estimateVersions.find((version) => version.id === activeSupplement.base_estimate_version_id) : null;

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><FilePlus2 className="size-4" /> Additional repair work</div><h1 className="text-3xl font-semibold tracking-tight">Supplements</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Original estimate versions remain unchanged.</p></div><Link href={`/jobs/${job.id}/history`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white"><History className="size-4" /> Estimate history</Link></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}

      {!activeSupplement ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <div className="mx-auto max-w-2xl text-center"><FilePlus2 className="mx-auto size-10 text-[var(--muted)]" /><h2 className="mt-4 text-xl font-semibold">Start a supplement</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use a supplement only for additional legitimate work discovered after the formal estimate. A saved base estimate version is required so the original remains auditable.</p>{estimateVersions.length ? <form action={startAction} className="mx-auto mt-6 grid max-w-lg gap-3"><textarea name="reason" rows={3} className={inputClass} placeholder="Reason, e.g. hidden damage discovered after strip-down" /><button type="submit" className="rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e]">Start Supplement #1</button></form> : <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Save a formal estimate version first. <Link href={`/jobs/${job.id}/estimate`} className="font-semibold underline">Open estimate</Link></div>}</div>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Supplement #{activeSupplement.supplement_number}</h2><p className="mt-1 text-xs text-[var(--muted)]">Based on estimate version {baseVersion?.version_number ?? "—"}{activeSupplement.reason ? ` · ${activeSupplement.reason}` : ""}</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]">{activeSupplement.status}</span>{activeSupplement.status === "draft" && items.length ? <form action={saveAction}><input type="hidden" name="supplement_id" value={activeSupplement.id} /><button type="submit" className="rounded-xl bg-[var(--surface-3)] px-3.5 py-2 text-xs font-semibold hover:bg-[var(--brand)] hover:text-[#06110e]">Save Version</button></form> : null}</div></div>
              {items.length === 0 ? <div className="grid min-h-48 place-items-center px-6 text-center"><div><ReceiptText className="mx-auto size-8 text-[var(--muted)]" /><p className="mt-3 font-medium">No additional work added yet</p><p className="mt-2 text-sm text-[var(--muted)]">Only add items that are additional to the base estimate.</p></div></div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#0a1423] text-[11px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Additional operation</th><th className="px-4 py-3 text-right font-medium">Hours</th><th className="px-4 py-3 text-right font-medium">Rate</th><th className="px-4 py-3 text-right font-medium">Total ex GST</th><th className="px-4 py-3"></th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-[var(--border)]/70"><td className="px-4 py-4"><div className="font-medium">{categoryById.get(item.category_id)?.name || "Category"}</div><p className="mt-1 text-xs text-[var(--muted)]">{[item.side, item.component, item.operation_code].filter(Boolean).join(" · ")}</p></td><td className="px-4 py-4">{item.description}</td><td className="px-4 py-4 text-right tabular-nums">{Number(item.labour_hours).toFixed(2)}</td><td className="px-4 py-4 text-right tabular-nums">{money(Number(item.labour_rate), activeSupplement.currency)}</td><td className="px-4 py-4 text-right font-semibold tabular-nums">{money(Number(item.line_total_ex_tax), activeSupplement.currency)}</td><td className="px-4 py-4">{activeSupplement.status === "draft" ? <form action={deleteAction}><input type="hidden" name="item_id" value={item.id} /><button aria-label={`Delete ${item.description}`} className="rounded-lg p-2 text-[var(--muted)] hover:bg-red-400/10 hover:text-red-200"><Trash2 className="size-4" /></button></form> : null}</td></tr>)}</tbody></table></div>}
            </section>

            {activeSupplement.status === "draft" ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Plus className="size-4" /></span><div><h2 className="font-semibold">Add additional operation</h2><p className="text-xs text-[var(--muted)]">Rates default from the base estimate snapshot where available.</p></div></div><form action={addAction} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><input type="hidden" name="supplement_id" value={activeSupplement.id} /><label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Category *</span><select name="category_id" required defaultValue="" className={inputClass}><option value="" disabled>Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><input name="component" className={inputClass} placeholder="Component" /><select name="side" className={inputClass} defaultValue=""><option value="">No side</option><option value="LH">LH</option><option value="RH">RH</option><option value="FRONT">Front</option><option value="REAR">Rear</option></select><input name="operation_code" className={inputClass} placeholder="Operation code" /><input name="description" required className={`${inputClass} md:col-span-2 lg:col-span-4`} placeholder="Additional repair operation *" /><input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className={inputClass} /><input name="labour_hours" type="number" min="0" step="0.05" placeholder="Labour hours" className={inputClass} /><input name="labour_rate" type="number" min="0" step="0.01" placeholder="Base rate" className={inputClass} /><input name="fixed_amount" type="number" step="0.01" placeholder="Fixed amount" className={inputClass} /><input name="part_cost" type="number" min="0" step="0.01" placeholder="Part cost" className={inputClass} /><input name="markup_percent" type="number" min="0" step="0.1" placeholder="Markup %" className={inputClass} /><input name="freight_amount" type="number" min="0" step="0.01" placeholder="Freight" className={inputClass} /><input name="adjustment_amount" type="number" step="0.01" placeholder="Adjustment +/-" className={inputClass} /><div className="md:col-span-2 lg:col-span-4 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[#06110e]"><Plus className="size-4" /> Add to supplement</button></div></form></section> : null}
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Supplement totals</h2><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between text-[var(--muted)]"><span>Additional subtotal</span><span>{money(totals.subtotal, activeSupplement.currency)}</span></div><div className="flex justify-between text-[var(--muted)]"><span>GST {Number(activeSupplement.tax_rate).toFixed(0)}%</span><span>{money(totals.tax, activeSupplement.currency)}</span></div><div className="flex items-end justify-between border-t border-[var(--border)] pt-3"><span className="font-semibold">Additional total</span><strong className="text-2xl tabular-nums">{money(totals.total, activeSupplement.currency)}</strong></div></div></section>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Version history</h2><div className="mt-4 space-y-3">{supplementVersions.length ? supplementVersions.map((version) => <div key={version.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[#091322] p-3"><div><p className="text-sm font-medium">Version {version.version_number}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.created_at))}</p></div><strong className="text-sm tabular-nums">{money(Number(version.total_inc_tax), activeSupplement.currency)}</strong></div>) : <p className="text-sm text-[var(--muted)]">No saved supplement versions yet.</p>}</div></section>
            {supplements.length > 1 ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Earlier supplements</h2><div className="mt-3 space-y-2">{supplements.filter((supplement) => supplement.id !== activeSupplement.id).map((supplement) => <div key={supplement.id} className="flex justify-between text-sm"><span>Supplement #{supplement.supplement_number}</span><span className="text-[var(--muted)]">{supplement.status}</span></div>)}</div></section> : null}
          </aside>
        </div>
      )}
    </div>
  );
}
