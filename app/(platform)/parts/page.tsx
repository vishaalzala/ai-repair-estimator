import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock3, PackageSearch, Plus, Search, Truck } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

function label(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: requestData, error } = await supabase
    .from("parts_requests")
    .select("id, job_id, provider, external_reference, status, requested_at, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(250);
  const requests = requestData ?? [];
  const requestIds = requests.map((request) => request.id);
  const jobIds = [...new Set(requests.map((request) => request.job_id))];

  const [jobResult, itemResult, quoteResult] = await Promise.all([
    jobIds.length
      ? supabase.from("jobs").select("id, job_number, vehicle_id, customer_id, status").eq("organization_id", organizationId).in("id", jobIds)
      : Promise.resolve({ data: [] }),
    requestIds.length
      ? supabase.from("parts_request_items").select("id, parts_request_id, description, component, side, part_number, quantity, part_type, status").eq("organization_id", organizationId).in("parts_request_id", requestIds)
      : Promise.resolve({ data: [] }),
    requestIds.length
      ? supabase.from("parts_quotes").select("id, parts_request_id, provider, supplier_id, quoted_at, bulk_lot_amount, freight_amount, provider_fee_amount").eq("organization_id", organizationId).in("parts_request_id", requestIds)
      : Promise.resolve({ data: [] }),
  ]);
  const jobs = jobResult.data ?? [];
  const items = itemResult.data ?? [];
  const quotes = quoteResult.data ?? [];
  const vehicleIds = jobs.map((job) => job.vehicle_id).filter((id): id is string => Boolean(id));
  const customerIds = jobs.map((job) => job.customer_id).filter((id): id is string => Boolean(id));

  const [vehicleResult, customerResult] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("id, registration, make, model, model_year").eq("organization_id", organizationId).in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? supabase.from("customers").select("id, first_name, last_name, business_name").eq("organization_id", organizationId).in("id", customerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const vehicles = vehicleResult.data ?? [];
  const customers = customerResult.data ?? [];

  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  const normalized = q.trim().toLowerCase();
  const rows = requests
    .map((request) => {
      const job = jobById.get(request.job_id);
      const vehicle = job?.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined;
      const customer = job?.customer_id ? customerById.get(job.customer_id) : undefined;
      const requestItems = items.filter((item) => item.parts_request_id === request.id);
      const requestQuotes = quotes.filter((quote) => quote.parts_request_id === request.id);
      const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer pending";
      const vehicleName = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle pending";
      const searchable = [job?.job_number, vehicle?.registration, vehicleName, customerName, request.external_reference, ...requestItems.flatMap((item) => [item.description, item.component, item.part_number])].filter(Boolean).join(" ").toLowerCase();
      return { request, job, vehicle, customerName, vehicleName, requestItems, requestQuotes, searchable };
    })
    .filter((row) => !normalized || row.searchable.includes(normalized));

  const openStatuses = new Set(["draft", "requested", "quotes_received", "selected", "ordered"]);
  const openCount = requests.filter((request) => openStatuses.has(request.status)).length;
  const tbcCount = items.filter((item) => item.status === "tbc").length;
  const quotedCount = items.filter((item) => item.status === "quoted").length;
  const selectedCount = items.filter((item) => ["selected", "ordered", "received"].includes(item.status)).length;

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><PackageSearch className="size-4" /> Parts control</div>
          <h1 className="text-3xl font-semibold tracking-tight">Parts</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">See parts requests across all jobs, then open a job to add parts or supplier quotes.</p>
        </div>
        <Link href="/jobs" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><Plus className="size-4" /> Open jobs</Link>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open requests" value={openCount} icon={PackageSearch} />
        <Stat label="Parts TBC" value={tbcCount} icon={Clock3} />
        <Stat label="Quoted parts" value={quotedCount} icon={Truck} />
        <Stat label="Selected / ordered" value={selectedCount} icon={CheckCircle2} />
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <form className="border-b border-[var(--border)] p-4" method="get">
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[#091322] px-4 py-3"><Search className="size-4 text-[var(--muted)]" /><input name="q" defaultValue={q} className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]" placeholder="Search job, registration, vehicle, customer, part or part number…" /></label>
        </form>

        {error ? (
          <div className="p-8 text-center text-sm text-red-200">Unable to load parts requests right now.</div>
        ) : rows.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center"><div><PackageSearch className="mx-auto size-8 text-[var(--muted)]" /><p className="mt-4 font-medium">{normalized ? "No matching parts requests" : "No parts requests yet"}</p><p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">{normalized ? "Try a different job number, registration, vehicle or part description." : "Open a job and use its Parts tab to create the first request. Parts stay linked to the assessment and its estimate."}</p><Link href="/jobs" className="mt-5 inline-flex rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]">Browse jobs</Link></div></div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {rows.map(({ request, job, vehicle, customerName, vehicleName, requestItems, requestQuotes }) => {
              const unresolved = requestItems.filter((item) => ["tbc", "requested"].includes(item.status)).length;
              const selected = requestItems.filter((item) => ["selected", "ordered", "received"].includes(item.status)).length;
              return (
                <Link key={request.id} href={job ? `/jobs/${job.id}/parts` : "/jobs"} className="grid gap-3 px-5 py-4 transition hover:bg-[var(--surface-2)]/60 md:grid-cols-[1.1fr_1.2fr_1fr_0.9fr_30px] md:items-center">
                  <div><p className="font-semibold">{job?.job_number || "Job"}</p><p className="mt-1 text-xs text-[var(--muted)]">{vehicle?.registration || "Registration pending"} · {request.provider === "partstrader" ? "PartsTrader" : "Manual"}</p></div>
                  <div className="min-w-0"><p className="truncate text-sm">{vehicleName}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{customerName}</p></div>
                  <div><p className="text-sm">{requestItems.length} part{requestItems.length === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-[var(--muted)]">{unresolved} unresolved · {selected} selected</p></div>
                  <div><span className="inline-flex rounded-full border border-[var(--border)] bg-[#091322] px-2.5 py-1 text-xs">{label(request.status)}</span><p className="mt-1 text-[10px] text-[var(--muted)]">{requestQuotes.length} supplier quote{requestQuotes.length === 1 ? "" : "s"}</p></div>
                  <ChevronRight className="size-4 text-[var(--muted)]" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label: statLabel, value, icon: Icon }: { label: string; value: number; icon: typeof PackageSearch }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between"><span className="text-xs font-medium text-[var(--muted)]">{statLabel}</span><Icon className="size-4 text-[var(--brand)]" /></div><div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div></div>;
}
