import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, History, Scale, TimerReset } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

function money(value: number, currency = "NZD") {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

function label(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

type VersionItem = {
  id: string;
  original_item_id: string | null;
  category_code: string;
  category_name: string;
  component: string | null;
  side: string | null;
  operation_code: string | null;
  description: string;
  quantity: number | string;
  labour_hours: number | string;
  labour_rate: number | string;
  fixed_amount: number | string;
  part_cost: number | string;
  markup_percent: number | string;
  freight_amount: number | string;
  adjustment_amount: number | string;
  line_total_ex_tax: number | string;
};

function itemKey(item: VersionItem) {
  return item.original_item_id || [item.category_code, item.component, item.side, item.operation_code, item.description].join("|");
}

function compareItems(before: VersionItem[], after: VersionItem[]) {
  const beforeMap = new Map(before.map((item) => [itemKey(item), item]));
  const afterMap = new Map(after.map((item) => [itemKey(item), item]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  return [...keys].flatMap((key) => {
    const previous = beforeMap.get(key);
    const current = afterMap.get(key);
    if (!previous && current) {
      return [{ kind: "added" as const, previous: null, current, delta: Number(current.line_total_ex_tax) }];
    }
    if (previous && !current) {
      return [{ kind: "removed" as const, previous, current: null, delta: -Number(previous.line_total_ex_tax) }];
    }
    if (!previous || !current) return [];

    const delta = Number(current.line_total_ex_tax) - Number(previous.line_total_ex_tax);
    const changed =
      Math.abs(delta) > 0.004 ||
      Number(previous.labour_hours) !== Number(current.labour_hours) ||
      Number(previous.labour_rate) !== Number(current.labour_rate) ||
      Number(previous.part_cost) !== Number(current.part_cost) ||
      Number(previous.quantity) !== Number(current.quantity) ||
      previous.description !== current.description ||
      previous.operation_code !== current.operation_code;

    return changed ? [{ kind: "changed" as const, previous, current, delta }] : [];
  });
}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string; message?: string }>;
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

  const [vehicleResult, versionResult, activityResult, statusResult] = await Promise.all([
    job.vehicle_id
      ? supabase.from("vehicles").select("registration, make, model, model_year").eq("id", job.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("estimate_versions")
      .select("id, version_number, reason, status_snapshot, currency, tax_rate, subtotal_ex_tax, tax_amount, total_inc_tax, category_totals, created_at")
      .eq("organization_id", organizationId)
      .eq("job_id", job.id)
      .order("version_number", { ascending: false }),
    supabase
      .from("activity_events")
      .select("id, event_type, title, details, created_at")
      .eq("organization_id", organizationId)
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("job_status_history")
      .select("id, from_status, to_status, created_at")
      .eq("organization_id", organizationId)
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const vehicle = vehicleResult.data;
  const versions = versionResult.data ?? [];
  const activities = activityResult.data ?? [];
  const statusHistory = statusResult.data ?? [];
  const selectedA = versions.find((version) => version.id === query.a) ?? (versions.length > 1 ? versions[1] : versions[0]);
  const selectedB = versions.find((version) => version.id === query.b) ?? versions[0];

  const selectedIds = [...new Set([selectedA?.id, selectedB?.id].filter((value): value is string => Boolean(value)))];
  const { data: selectedItemsData } = selectedIds.length
    ? await supabase
        .from("estimate_version_items")
        .select("id, estimate_version_id, original_item_id, category_code, category_name, component, side, operation_code, description, quantity, labour_hours, labour_rate, fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount, line_total_ex_tax")
        .eq("organization_id", organizationId)
        .in("estimate_version_id", selectedIds)
        .order("sort_order")
    : { data: [] };

  const selectedItems = selectedItemsData ?? [];
  const beforeItems = selectedA ? selectedItems.filter((item) => item.estimate_version_id === selectedA.id) as VersionItem[] : [];
  const afterItems = selectedB ? selectedItems.filter((item) => item.estimate_version_id === selectedB.id) as VersionItem[] : [];
  const differences = selectedA && selectedB && selectedA.id !== selectedB.id ? compareItems(beforeItems, afterItems) : [];
  const totalDelta = selectedA && selectedB ? Number(selectedB.total_inc_tax) - Number(selectedA.total_inc_tax) : 0;
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><History className="size-4" /> Audit-ready history</div><h1 className="text-3xl font-semibold tracking-tight">Estimate history</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Formal versions are immutable snapshots.</p></header>

      {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="font-semibold">Formal versions</h2><p className="mt-1 text-xs text-[var(--muted)]">Autosave is not a version. These snapshots preserve exact rates, totals and line items.</p></div><span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-xs text-[var(--muted)]">{versions.length} versions</span></div>
            {versions.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] bg-[#091322] p-8 text-center"><p className="font-medium">No formal versions yet</p><p className="mt-2 text-sm text-[var(--muted)]">Open the estimate and use Save Version when you want a permanent comparison point.</p><Link href={`/jobs/${job.id}/estimate`} className="mt-4 inline-flex text-sm font-semibold text-[var(--brand)]">Open estimate →</Link></div> : <div className="space-y-3">{versions.map((version) => <article key={version.id} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[#091322] p-4 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><strong>Version {version.version_number}</strong><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{label(version.reason)}</span><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{label(version.status_snapshot)}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.created_at))}</p></div><div className="text-left sm:text-right"><strong className="text-lg tabular-nums">{money(Number(version.total_inc_tax), version.currency)}</strong><p className="mt-1 text-xs text-[var(--muted)]">GST {money(Number(version.tax_amount), version.currency)}</p></div></article>)}</div>}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><Scale className="size-5 text-[var(--brand)]" /><div><h2 className="font-semibold">Compare versions</h2><p className="mt-1 text-xs text-[var(--muted)]">See exactly why the estimate total changed.</p></div></div>
            {versions.length < 2 ? <p className="text-sm text-[var(--muted)]">Create at least two formal estimate versions to compare changes.</p> : <>
              <form method="get" className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]"><select name="a" defaultValue={selectedA?.id} className="rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none"><option disabled value="">Earlier version</option>{versions.map((version) => <option key={version.id} value={version.id}>Version {version.version_number} · {money(Number(version.total_inc_tax), version.currency)}</option>)}</select><ArrowRight className="hidden size-4 self-center text-[var(--muted)] sm:block" /><select name="b" defaultValue={selectedB?.id} className="rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none"><option disabled value="">Later version</option>{versions.map((version) => <option key={version.id} value={version.id}>Version {version.version_number} · {money(Number(version.total_inc_tax), version.currency)}</option>)}</select><button type="submit" className="rounded-xl bg-[var(--surface-3)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--brand)] hover:text-[#06110e]">Compare</button></form>

              {selectedA?.id === selectedB?.id ? <p className="text-sm text-[var(--muted)]">Choose two different versions.</p> : <div>
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[#091322] p-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-[var(--muted)]">Total change</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${totalDelta > 0 ? "text-[var(--brand)]" : totalDelta < 0 ? "text-amber-200" : ""}`}>{totalDelta > 0 ? "+" : ""}{money(totalDelta, selectedB?.currency ?? "NZD")}</p></div><p className="text-xs text-[var(--muted)]">Version {selectedA?.version_number} → Version {selectedB?.version_number}</p></div>
                {differences.length === 0 ? <p className="text-sm text-[var(--muted)]">No line-level differences found between these snapshots.</p> : <div className="space-y-2">{differences.map((difference, index) => { const item = difference.current ?? difference.previous!; return <div key={`${itemKey(item)}-${index}`} className="grid gap-2 rounded-xl border border-[var(--border)] px-4 py-3 sm:grid-cols-[110px_1fr_auto]"><span className={`text-xs font-semibold uppercase tracking-wide ${difference.kind === "added" ? "text-[var(--brand)]" : difference.kind === "removed" ? "text-amber-200" : "text-sky-200"}`}>{difference.kind}</span><div><p className="text-sm font-medium">{item.description}</p><p className="mt-1 text-xs text-[var(--muted)]">{[item.category_name, item.side, item.component, item.operation_code].filter(Boolean).join(" · ")}</p>{difference.kind === "changed" && difference.previous && difference.current ? <p className="mt-1 text-[11px] text-[var(--muted)]">Hours {Number(difference.previous.labour_hours).toFixed(2)} → {Number(difference.current.labour_hours).toFixed(2)} · Rate {money(Number(difference.previous.labour_rate))} → {money(Number(difference.current.labour_rate))}</p> : null}</div><strong className="text-sm tabular-nums">{difference.delta > 0 ? "+" : ""}{money(difference.delta, selectedB?.currency ?? "NZD")}</strong></div>; })}</div>}
              </div>}
            </>}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-3"><TimerReset className="size-4 text-[var(--brand)]" /><div><h2 className="font-semibold">Activity</h2><p className="text-xs text-[var(--muted)]">Latest system and user events</p></div></div>
            <div className="space-y-4">{activities.length ? activities.map((event) => <div key={event.id} className="relative border-l border-[var(--border)] pl-4"><span className="absolute -left-1 top-1 size-2 rounded-full bg-[var(--brand)]" /><p className="text-sm font-medium">{event.title}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{label(event.event_type)} · {new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</p></div>) : <p className="text-sm text-[var(--muted)]">No activity events yet.</p>}</div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Status timeline</h2><div className="mt-4 space-y-3">{statusHistory.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-4 text-sm"><div><p>{label(entry.to_status)}</p>{entry.from_status ? <p className="mt-0.5 text-[11px] text-[var(--muted)]">from {label(entry.from_status)}</p> : null}</div><span className="shrink-0 text-[10px] text-[var(--muted)]">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(entry.created_at))}</span></div>)}</div></section>
        </aside>
      </div>
    </div>
  );
}
