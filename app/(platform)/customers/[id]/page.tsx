import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { ArrowLeft, CarFront, FileText, Mail, MessageSquare, Phone, Pencil, UserRound, Plus, History } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { updateCustomer } from "../actions";

const fieldClass = "rounded-lg border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";
const formatDate = (date: string) => new Intl.DateTimeFormat("en-NZ", { day:"2-digit", month:"2-digit", year:"numeric", timeZone:"Pacific/Auckland" }).format(new Date(date));

export default async function CustomerDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId, role } = await requireOrganizationContext();
  const { data: customer } = await supabase.from("customers")
    .select("id,customer_type,first_name,last_name,business_name,email,phone,address_line1,address_line2,city,region,postcode,country_code,notes,created_at,updated_at")
    .eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!customer) notFound();

  const [{ data: vehicles }, { data: jobs }, { data: messages }] = await Promise.all([
    supabase.from("vehicles").select("id,registration,model_year,make,model,variant,colour,vin,updated_at").eq("organization_id", organizationId).eq("customer_id", id).order("updated_at", { ascending: false }).limit(200),
    supabase.from("jobs").select("id,job_number,status,vehicle_id,job_reference,created_at,updated_at").eq("organization_id", organizationId).eq("customer_id", id).order("created_at", { ascending: false }).limit(250),
    supabase.from("workshop_messages").select("id,job_id,channel,status,recipient,created_at").eq("organization_id", organizationId).eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const allJobs = jobs ?? [];
  const jobIds = allJobs.map((job) => job.id);
  const { data: versions } = jobIds.length
    ? await supabase.from("estimate_versions").select("job_id,version_number,total_inc_tax,currency").eq("organization_id", organizationId).in("job_id", jobIds).order("version_number", { ascending: false })
    : { data: [] as Array<{job_id:string;version_number:number;total_inc_tax:number;currency:string}> };
  const latestVersionByJob = new Map<string, {total_inc_tax:number;currency:string}>();
  for (const version of versions ?? []) if (!latestVersionByJob.has(version.job_id)) latestVersionByJob.set(version.job_id, version);
  const vehicleById = new Map((vehicles ?? []).map((vehicle) => [vehicle.id, vehicle]));
  const name = customer.business_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer";
  const address = [customer.address_line1, customer.address_line2, customer.city, customer.region, customer.postcode].filter(Boolean).join(", ");
  const activeJobs = allJobs.filter((job) => !["completed","cancelled"].includes(job.status));
  const canEdit = ["owner","admin","manager","estimator","reviewer"].includes(role);
  const editKey = randomUUID();

  return (
    <div className="mx-auto max-w-[1450px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href="/customers" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"><ArrowLeft className="size-4" /> Back to customers</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">{customer.customer_type} · Customer profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Linked vehicles, estimates, repair jobs and communication history.</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/communications?customerId=${id}&channel=sms`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]"><MessageSquare className="size-4" /> Send SMS</Link>
          <Link href={`/communications?customerId=${id}&channel=email`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]"><Mail className="size-4" /> Send Email</Link>
          <Link href="/jobs/new" className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><Plus className="size-4" /> New assessment</Link>
        </div>
      </div>
      {query.message ? <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{query.message}</p> : null}
      {query.error ? <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{query.error}</p> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Linked vehicles" value={String((vehicles ?? []).length)} />
        <Metric label="Total jobs" value={String(allJobs.length)} />
        <Metric label="Active jobs" value={String(activeJobs.length)} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-semibold">Customer details</h2>
            <div className="mt-4 grid gap-3 text-sm text-[var(--muted)]">
              <div className="flex items-center gap-2"><Mail className="size-4" /> {customer.email || "No email"}</div>
              <div className="flex items-center gap-2"><Phone className="size-4" /> {customer.phone || "No phone"}</div>
              <p>{address || "No address"}</p>
              {customer.notes ? <p className="whitespace-pre-wrap rounded-xl bg-[var(--surface-2)] p-3 text-xs">{customer.notes}</p> : null}
              <p className="text-xs">Customer since {formatDate(customer.created_at)}</p>
            </div>
            {canEdit ? (
              <details className="mt-5">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--brand)]"><Pencil className="size-4" /> Edit customer</summary>
                <form action={updateCustomer} className="mt-4 grid gap-3">
                  <input type="hidden" name="customer_id" value={customer.id} />
                  <input type="hidden" name="edit_request_key" value={editKey} />
                  <label className="grid gap-1 text-xs">Type<select name="customer_type" defaultValue={customer.customer_type} className={fieldClass}><option value="individual">Individual</option><option value="business">Business</option></select></label>
                  <label className="grid gap-1 text-xs">Business<input name="business_name" defaultValue={customer.business_name ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">First name<input name="first_name" defaultValue={customer.first_name ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Last name<input name="last_name" defaultValue={customer.last_name ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Email<input name="email" type="email" defaultValue={customer.email ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Phone<input name="phone" defaultValue={customer.phone ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Address<input name="address_line1" defaultValue={customer.address_line1 ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Address line 2<input name="address_line2" defaultValue={customer.address_line2 ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">City<input name="city" defaultValue={customer.city ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Region<input name="region" defaultValue={customer.region ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Postcode<input name="postcode" defaultValue={customer.postcode ?? ""} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Country<input name="country_code" maxLength={2} defaultValue={customer.country_code} className={fieldClass}/></label>
                  <label className="grid gap-1 text-xs">Notes<textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} className={fieldClass}/></label>
                  <button className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[#06110e]">Save customer</button>
                </form>
              </details>
            ) : null}
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="flex items-center gap-2 font-semibold"><History className="size-4" /> Recent communications</h2>
            {(messages ?? []).length ? <div className="mt-3 space-y-3">{(messages ?? []).map((message) => (
              <div key={message.id} className="rounded-xl border border-[var(--border)] p-3 text-xs">
                <p className="font-semibold uppercase">{message.channel} · {message.status}</p>
                <p className="mt-1 text-[var(--muted)]">{message.recipient} · {formatDate(message.created_at)}</p>
                {message.job_id ? <Link className="mt-1 inline-block text-[var(--brand)]" href={`/jobs/${message.job_id}/messages`}>View on job</Link> : null}
              </div>
            ))}</div> : <p className="mt-3 text-sm text-[var(--muted)]">No messages recorded.</p>}
          </section>
        </aside>
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold">Vehicles</h2></div>
            {(vehicles ?? []).length ? <div className="divide-y divide-[var(--border)]">{(vehicles ?? []).map((vehicle) => {
              const relatedJob = allJobs.find((job) => job.vehicle_id === vehicle.id);
              return <div key={vehicle.id} className="flex items-center gap-4 px-5 py-4"><CarFront className="size-5 text-[var(--brand)]" />
                <div className="min-w-0 flex-1"><p className="font-semibold">{[vehicle.model_year,vehicle.make,vehicle.model,vehicle.variant].filter(Boolean).join(" ") || "Vehicle"}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{vehicle.registration || "Registration pending"} · {vehicle.vin || "VIN pending"}</p></div>
                {relatedJob ? <Link className="text-xs font-semibold text-[var(--brand)]" href={`/jobs/${relatedJob.id}`}>Open job</Link> : <span className="text-xs text-[var(--muted)]">No job</span>}
              </div>;
            })}</div> : <p className="p-7 text-sm text-[var(--muted)]">No linked vehicles.</p>}
          </section>
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold">All repair jobs and quotes</h2><p className="mt-1 text-xs text-[var(--muted)]">Newest first. Totals shown only for saved estimate versions.</p></div>
            {allJobs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3">Job</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Latest saved quote</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody>{allJobs.map((job) => {
                const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : null;
                const quote = latestVersionByJob.get(job.id);
                return <tr key={job.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3"><Link className="font-semibold text-[var(--brand)]" href={`/jobs/${job.id}`}>{job.job_number}</Link><p className="text-xs text-[var(--muted)]">{formatDate(job.created_at)}</p></td>
                  <td className="px-4 py-3">{vehicle?.registration || "Rego pending"}<p className="text-xs text-[var(--muted)]">{[vehicle?.make,vehicle?.model].filter(Boolean).join(" ")}</p></td>
                  <td className="px-4 py-3 capitalize">{job.status.replaceAll("_"," ")}</td>
                  <td className="px-4 py-3">{quote ? new Intl.NumberFormat("en-NZ",{style:"currency",currency:quote.currency}).format(Number(quote.total_inc_tax)) : "Not saved"}</td>
                  <td className="px-4 py-3"><div className="flex gap-3"><Link className="text-xs font-semibold text-[var(--brand)]" href={`/jobs/${job.id}`}>View job</Link><Link className="text-xs font-semibold text-[var(--brand)]" href={`/jobs/${job.id}/estimate`}>Estimate</Link><Link className="text-xs font-semibold text-[var(--brand)]" href={`/jobs/${job.id}/messages`}>Messages</Link></div></td>
                </tr>;
              })}</tbody>
            </table></div> : <p className="p-7 text-sm text-[var(--muted)]">No jobs linked to this customer.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}
