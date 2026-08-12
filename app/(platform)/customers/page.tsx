import Link from "next/link";
import { Building2, CarFront, ChevronDown, Plus, Search, UserRound } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { createCustomer, updateCustomer } from "./actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";

function displayName(customer: {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
}) {
  if (customer.customer_type === "business" && customer.business_name) return customer.business_name;
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email || customer.phone || "Customer";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; message?: string }>;
}) {
  const query = await searchParams;
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: customerData, error } = await supabase
    .from("customers")
    .select("id, customer_type, first_name, last_name, business_name, email, phone, address_line1, address_line2, city, region, postcode, country_code, notes, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(250);
  const customers = customerData ?? [];
  const ids = customers.map((customer) => customer.id);

  const [vehicleResult, jobResult] = await Promise.all([
    ids.length
      ? supabase.from("vehicles").select("id, customer_id, registration, make, model, model_year").eq("organization_id", organizationId).in("customer_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("jobs").select("id, customer_id, job_number, status, updated_at").eq("organization_id", organizationId).in("customer_id", ids).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const vehicles = vehicleResult.data ?? [];
  const jobs = jobResult.data ?? [];

  const q = (query.q ?? "").trim().toLowerCase();
  const rows = customers.filter((customer) => {
    const vehicleText = vehicles
      .filter((vehicle) => vehicle.customer_id === customer.id)
      .map((vehicle) => [vehicle.registration, vehicle.model_year, vehicle.make, vehicle.model].filter(Boolean).join(" "))
      .join(" ");
    const haystack = [displayName(customer), customer.email, customer.phone, customer.city, vehicleText].filter(Boolean).join(" ").toLowerCase();
    return !q || haystack.includes(q);
  });

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><UserRound className="size-4" /> Customer records</div>
          <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Keep customer contacts linked to their vehicles and repair assessments.</p>
        </div>
        <details className="group relative">
          <summary className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><Plus className="size-4" /> Add customer</summary>
          <div className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:absolute sm:right-0 sm:z-20 sm:w-[620px]">
            <h2 className="font-semibold">New customer</h2><p className="mt-1 text-xs text-[var(--muted)]">A name is optional when an email or phone is known.</p>
            <CustomerForm action={createCustomer} submitLabel="Create customer" />
          </div>
        </details>
      </header>

      {query.error ? <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
      {query.message ? <div className="mt-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <form className="border-b border-[var(--border)] p-4" method="get">
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[#091322] px-4 py-3"><Search className="size-4 text-[var(--muted)]" /><input name="q" defaultValue={query.q ?? ""} className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]" placeholder="Search name, email, phone, vehicle or registration…" /></label>
        </form>

        {error ? (
          <div className="p-8 text-center text-sm text-red-200">Unable to load customers right now.</div>
        ) : rows.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center"><div><UserRound className="mx-auto size-8 text-[var(--muted)]" /><p className="mt-4 font-medium">{q ? "No matching customers" : "No customers yet"}</p><p className="mt-2 max-w-md text-sm text-[var(--muted)]">{q ? "Try another name, phone, email or vehicle registration." : "Customers can be added here or attached later to photo-first assessments."}</p></div></div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {rows.map((customer) => {
              const customerVehicles = vehicles.filter((vehicle) => vehicle.customer_id === customer.id);
              const customerJobs = jobs.filter((job) => job.customer_id === customer.id);
              const latestJob = customerJobs[0];
              const name = displayName(customer);
              return (
                <details key={customer.id} className="group">
                  <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-[var(--surface-2)]/60 md:grid-cols-[minmax(220px,1.2fr)_minmax(190px,1fr)_minmax(220px,1fr)_120px_28px] md:items-center">
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-3)] text-[var(--brand)]">{customer.customer_type === "business" ? <Building2 className="size-4" /> : <UserRound className="size-4" />}</span><div className="min-w-0"><p className="truncate font-semibold">{name}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">{customer.customer_type}</p></div></div></div>
                    <div className="text-sm text-[var(--muted)]"><p className="truncate">{customer.email || "No email"}</p><p className="mt-1 truncate text-xs">{customer.phone || "No phone"}</p></div>
                    <div className="min-w-0 text-sm"><p className="truncate">{customerVehicles.length ? customerVehicles.map((vehicle) => vehicle.registration || [vehicle.model_year, vehicle.make, vehicle.model].filter(Boolean).join(" ")).filter(Boolean).slice(0, 2).join(" · ") : "No linked vehicle"}</p><p className="mt-1 text-xs text-[var(--muted)]">{customerVehicles.length} vehicle{customerVehicles.length === 1 ? "" : "s"} · {customerJobs.length} job{customerJobs.length === 1 ? "" : "s"}</p></div>
                    <div>{latestJob ? <span className="inline-flex rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]">{latestJob.job_number}</span> : <span className="text-xs text-[var(--muted)]">No jobs</span>}</div>
                    <ChevronDown className="size-4 text-[var(--muted)] transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-[var(--border)] bg-[#091322] p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Edit {name}</h3><p className="mt-1 text-xs text-[var(--muted)]">Updates are immediately available to linked workshop records.</p></div>{latestJob ? <Link href={`/jobs/${latestJob.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--brand)]"><CarFront className="size-4" /> Open latest job</Link> : null}</div>
                    <CustomerForm action={updateCustomer} customer={customer} customerId={customer.id} submitLabel="Save customer" />
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function CustomerForm({
  action,
  customer,
  customerId,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  customer?: {
    customer_type: string;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    region: string | null;
    postcode: string | null;
    country_code: string;
    notes: string | null;
  };
  customerId?: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {customerId ? <input type="hidden" name="customer_id" value={customerId} /> : null}
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Type</span><select name="customer_type" defaultValue={customer?.customer_type ?? "individual"} className={inputClass}><option value="individual">Individual</option><option value="business">Business</option></select></label>
      <label className="grid gap-1 sm:col-span-2"><span className="text-[10px] text-[var(--muted)]">Business name</span><input name="business_name" defaultValue={customer?.business_name ?? ""} className={inputClass} /></label>
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">First name</span><input name="first_name" defaultValue={customer?.first_name ?? ""} className={inputClass} /></label>
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Last name</span><input name="last_name" defaultValue={customer?.last_name ?? ""} className={inputClass} /></label>
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Phone</span><input name="phone" defaultValue={customer?.phone ?? ""} className={inputClass} /></label>
      <label className="grid gap-1 sm:col-span-2"><span className="text-[10px] text-[var(--muted)]">Email</span><input name="email" type="email" defaultValue={customer?.email ?? ""} className={inputClass} /></label>
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Country</span><input name="country_code" maxLength={2} defaultValue={customer?.country_code ?? "NZ"} className={inputClass} /></label>
      <label className="grid gap-1 sm:col-span-2"><span className="text-[10px] text-[var(--muted)]">Address</span><input name="address_line1" defaultValue={customer?.address_line1 ?? ""} className={inputClass} /></label>
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Address line 2</span><input name="address_line2" defaultValue={customer?.address_line2 ?? ""} className={inputClass} /></label>
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">City</span><input name="city" defaultValue={customer?.city ?? ""} className={inputClass} /></label>
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Region</span><input name="region" defaultValue={customer?.region ?? ""} className={inputClass} /></label>
      <label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Postcode</span><input name="postcode" defaultValue={customer?.postcode ?? ""} className={inputClass} /></label>
      <label className="grid gap-1 sm:col-span-2 lg:col-span-3"><span className="text-[10px] text-[var(--muted)]">Notes</span><textarea name="notes" rows={3} defaultValue={customer?.notes ?? ""} className={inputClass} /></label>
      <div className="flex justify-end sm:col-span-2 lg:col-span-3"><button type="submit" className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">{submitLabel}</button></div>
    </form>
  );
}
