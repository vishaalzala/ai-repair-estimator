import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

function labelStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: jobs = [], error } = await supabase
    .from("jobs")
    .select("id, job_number, status, customer_id, vehicle_id, job_reference, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(100);

  const vehicleIds = jobs.map((job) => job.vehicle_id).filter((id): id is string => Boolean(id));
  const customerIds = jobs.map((job) => job.customer_id).filter((id): id is string => Boolean(id));
  const jobIds = jobs.map((job) => job.id);

  const [{ data: vehicles = [] }, { data: customers = [] }, { data: claims = [] }] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("id, registration, vin, make, model, model_year").in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? supabase.from("customers").select("id, first_name, last_name, business_name").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    jobIds.length
      ? supabase.from("claims").select("job_id, claim_number").in("job_id", jobIds)
      : Promise.resolve({ data: [] }),
  ]);

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const claimByJobId = new Map(claims.map((claim) => [claim.job_id, claim]));

  const normalizedQuery = q.trim().toLowerCase();
  const rows = jobs
    .map((job) => {
      const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined;
      const customer = job.customer_id ? customerById.get(job.customer_id) : undefined;
      const claim = claimByJobId.get(job.id);
      const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "—";
      const vehicleName = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle pending";
      const searchable = [job.job_number, job.job_reference, claim?.claim_number, vehicle?.registration, vehicle?.vin, vehicleName, customerName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return { job, vehicle, claim, customerName, vehicleName, searchable };
    })
    .filter((row) => !normalizedQuery || row.searchable.includes(normalizedQuery));

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-3xl font-semibold tracking-tight">Jobs</h1><p className="mt-2 text-sm text-[var(--muted)]">Search and manage repair assessments, claims and estimate status.</p></div>
        <Link href="/jobs/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><Plus className="size-4" /> New assessment</Link>
      </div>

      <section className="mt-7 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <form className="border-b border-[var(--border)] p-4" method="get">
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[#091322] px-4 py-3"><Search className="size-4 text-[var(--muted)]" /><input name="q" defaultValue={q} className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]" placeholder="Search job, claim, rego, VIN or customer…" /></label>
        </form>

        {error ? (
          <div className="p-8 text-center text-sm text-red-200">Unable to load jobs right now.</div>
        ) : rows.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center"><div><p className="font-medium">{q ? "No matching jobs" : "No assessments yet"}</p><p className="mt-2 max-w-md text-sm text-[var(--muted)]">{q ? "Try a different registration, claim number, VIN or customer name." : "Create the first assessment to begin the vehicle intake and photo workflow."}</p>{!q ? <Link href="/jobs/new" className="mt-5 inline-flex rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]">Create assessment</Link> : null}</div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#0a1423] text-xs uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3 font-medium">Job</th><th className="px-5 py-3 font-medium">Vehicle</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Claim</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Updated</th></tr></thead>
              <tbody>
                {rows.map(({ job, vehicle, claim, customerName, vehicleName }) => (
                  <tr key={job.id} className="border-t border-[var(--border)]/70 transition hover:bg-[var(--surface-2)]/60">
                    <td className="px-5 py-4"><Link href={`/jobs/${job.id}`} className="font-semibold text-white hover:text-[var(--brand)]">{job.job_number ?? "Job"}</Link>{job.job_reference ? <div className="mt-1 text-xs text-[var(--muted)]">Ref {job.job_reference}</div> : null}</td>
                    <td className="px-5 py-4"><div>{vehicleName}</div><div className="mt-1 text-xs text-[var(--muted)]">{vehicle?.registration || vehicle?.vin || "Identification pending"}</div></td>
                    <td className="px-5 py-4 text-[var(--muted)]">{customerName}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{claim?.claim_number || "—"}</td>
                    <td className="px-5 py-4"><span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs">{labelStatus(job.status)}</span></td>
                    <td className="px-5 py-4 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.updated_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
