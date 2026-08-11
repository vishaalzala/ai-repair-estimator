import Link from "next/link";
import { Search } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const { supabase, organizationId } = await requireOrganizationContext();

  let jobs: Array<{ id: string; job_number: string | null; job_reference: string | null; status: string; vehicle_id: string | null; customer_id: string | null }> = [];
  let vehicles: Array<{ id: string; registration: string | null; vin: string | null; make: string | null; model: string | null; model_year: number | null }> = [];
  let customers: Array<{ id: string; first_name: string | null; last_name: string | null; business_name: string | null; email: string | null; phone: string | null }> = [];
  let claims: Array<{ job_id: string; claim_number: string | null; policy_number: string | null; authority_reference: string | null }> = [];

  if (query.length >= 2) {
    const escaped = query.replace(/[%_]/g, "\\$&");
    const [jobResult, vehicleResult, customerResult, claimResult] = await Promise.all([
      supabase.from("jobs").select("id, job_number, job_reference, status, vehicle_id, customer_id").eq("organization_id", organizationId).or(`job_number.ilike.%${escaped}%,job_reference.ilike.%${escaped}%`).limit(30),
      supabase.from("vehicles").select("id, registration, vin, make, model, model_year").eq("organization_id", organizationId).or(`registration.ilike.%${escaped}%,vin.ilike.%${escaped}%,make.ilike.%${escaped}%,model.ilike.%${escaped}%`).limit(30),
      supabase.from("customers").select("id, first_name, last_name, business_name, email, phone").eq("organization_id", organizationId).or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,business_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`).limit(30),
      supabase.from("claims").select("job_id, claim_number, policy_number, authority_reference").eq("organization_id", organizationId).or(`claim_number.ilike.%${escaped}%,policy_number.ilike.%${escaped}%,authority_reference.ilike.%${escaped}%`).limit(30),
    ]);
    jobs = jobResult.data ?? [];
    vehicles = vehicleResult.data ?? [];
    customers = customerResult.data ?? [];
    claims = claimResult.data ?? [];

    const relatedVehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
    const relatedCustomerIds = new Set(customers.map((customer) => customer.id));
    const relatedJobIds = new Set(claims.map((claim) => claim.job_id));
    if (relatedVehicleIds.size || relatedCustomerIds.size || relatedJobIds.size) {
      const allJobs = await supabase.from("jobs").select("id, job_number, job_reference, status, vehicle_id, customer_id").eq("organization_id", organizationId).limit(300);
      for (const job of allJobs.data ?? []) {
        if (relatedJobIds.has(job.id) || (job.vehicle_id && relatedVehicleIds.has(job.vehicle_id)) || (job.customer_id && relatedCustomerIds.has(job.customer_id))) {
          if (!jobs.some((existing) => existing.id === job.id)) jobs.push(job);
        }
      }
    }
  }

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const claimByJobId = new Map(claims.map((claim) => [claim.job_id, claim]));
  const totalResults = jobs.length + vehicles.length + customers.length + claims.length;

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Search className="size-4" /> Workshop-wide lookup</div><h1 className="text-3xl font-semibold tracking-tight">Search</h1><p className="mt-2 text-sm text-[var(--muted)]">Find jobs by job number, claim, registration, VIN, customer, contact details or references.</p></header>
      <form className="mb-6 flex gap-2"><input name="q" defaultValue={query} autoFocus className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--brand)]" placeholder="Search registration, VIN, claim, customer…" /><button className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e]"><Search className="size-4" /> Search</button></form>

      {query.length > 0 && query.length < 2 ? <p className="text-sm text-[var(--muted)]">Enter at least two characters.</p> : null}
      {query.length >= 2 ? <div className="space-y-5"><p className="text-xs text-[var(--muted)]">{totalResults} direct/related records for “{query}”</p><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Related jobs</h2>{jobs.length ? <div className="mt-4 space-y-2">{jobs.map((job) => { const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined; const customer = job.customer_id ? customerById.get(job.customer_id) : undefined; const claim = claimByJobId.get(job.id); return <Link key={job.id} href={`/jobs/${job.id}`} className="grid gap-2 rounded-xl border border-[var(--border)] bg-[#091322] p-4 transition hover:border-[var(--brand)]/40 sm:grid-cols-[160px_1fr_auto]"><div><p className="font-semibold">{job.job_number || "Job"}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{job.status.replaceAll("_", " ")}</p></div><div><p className="text-sm">{[vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || vehicle?.registration || "Vehicle details"}</p><p className="mt-1 text-xs text-[var(--muted)]">{customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer"}</p></div><span className="text-xs text-[var(--muted)]">{claim?.claim_number || job.job_reference || "Open →"}</span></Link>; })}</div> : <p className="mt-4 text-sm text-[var(--muted)]">No related jobs found.</p>}</section></div> : null}
    </div>
  );
}
