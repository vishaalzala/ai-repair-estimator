import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, CalendarDays, Camera, CarFront, ClipboardList, FileText, FolderOpen, History, Pencil, Shield, Sparkles, UserRound } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { updateJobOverview } from "./actions";
import { quoteStates, repairStates, updateJobStages } from "./stage-actions";

function text(value: string | null | undefined) {
  return value?.trim() || "—";
}

function statusLabel(status: string) {
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

const statuses = ["draft", "intake_complete", "photos_required", "ai_analysing", "damage_review", "estimating", "awaiting_parts", "ai_review", "ready_for_approval", "approved", "sent_to_insurer", "awaiting_response", "authorised", "revision_requested", "supplement_required", "completed", "cancelled"];

const tabs = [
  { label: "Overview", icon: ClipboardList, suffix: "" },
  { label: "Photos", icon: Camera, suffix: "/photos" },
  { label: "Damage", icon: CarFront, suffix: "/damage" },
  { label: "Estimate", icon: FileText, suffix: "/estimate" },
  { label: "Review", icon: Sparkles, suffix: "/ai-review" },
  { label: "Parts", icon: Boxes, suffix: "/parts" },
  { label: "Messages", icon: FileText, suffix: "/messages" },
  { label: "Supplements", icon: FileText, suffix: "/supplements" },
  { label: "Notes", icon: FileText, suffix: "/notes" },
  { label: "Tasks", icon: CalendarDays, suffix: "/daily-tasks" },
  { label: "Documents", icon: FolderOpen, suffix: "/documents" },
  { label: "History", icon: History, suffix: "/history" },
];

export default async function JobOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; saved?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId, role } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, status, quote_status, repair_status, customer_id, vehicle_id, branch_id, assigned_to, job_reference, repair_type, repair_size, work_source, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!job) notFound();

  const [vehicleResult, customerResult, claimResult, statusHistoryResult, insurerResult, customerListResult, memberResult, branchResult, scheduleResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, vin, make, model, variant, model_year, colour, paint_code, odometer_km, body_type, vehicle_origin, vehicle_size, fuel_type, is_ev, is_hybrid, adas_present").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    job.customer_id ? supabase.from("customers").select("first_name, last_name, business_name, customer_type, email, phone, address_line1, address_line2, city, region, postcode, country_code, notes").eq("organization_id", organizationId).eq("id", job.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("claims").select("insurer_id, claim_number, policy_number, assessor_name, assessor_email, assessor_phone, case_manager_name, case_manager_email, excess_amount, accident_date, accident_location, accident_description, authority_reference").eq("organization_id", organizationId).eq("job_id", job.id).maybeSingle(),
    supabase.from("job_status_history").select("id, from_status, to_status, created_at").eq("job_id", job.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("insurers").select("id, name").eq("organization_id", organizationId).order("name"),
    supabase.from("customers").select("id, first_name, last_name, business_name, email").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(100),
    supabase.from("organization_members").select("user_id, role, status").eq("organization_id", organizationId).eq("status", "active").order("role"),
    supabase.from("branches").select("id, name").eq("organization_id", organizationId).order("name"),
    supabase.from("job_schedules").select("due_at, priority").eq("organization_id", organizationId).eq("job_id", job.id).maybeSingle(),
  ]);

  const vehicle = vehicleResult.data;
  const customer = customerResult.data;
  const claim = claimResult.data;
  const statusHistory = statusHistoryResult.data ?? [];
  const insurers = insurerResult.data ?? [];
  const customers = customerListResult.data ?? [];
  const members = memberResult.data ?? [];
  const branches = branchResult.data ?? [];
  const schedule = scheduleResult.data;
  const insurer = claim?.insurer_id ? insurers.find((item) => item.id === claim.insurer_id) : undefined;
  const canEdit = ["owner", "admin", "manager", "estimator", "reviewer"].includes(role);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model, vehicle?.variant].filter(Boolean).join(" ") || "Vehicle details pending";
  const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer pending";
  const updateAction = updateJobOverview.bind(null, job.id);
  const progressAction = updateJobStages.bind(null,job.id);

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href="/jobs" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"><ArrowLeft className="size-4" /> Back to jobs</Link>

      {query.saved ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.saved === "Progress updated" ? "Quotation and repair progress updated." : "Job details saved."}</div> : null}
      {query.error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</div> : null}

      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]"><span>{job.job_number}</span><span>•</span><span>{text(vehicle?.registration)}</span><span>•</span><span>{text(claim?.claim_number)}</span></div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">{vehicleTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{customerName}{job.job_reference ? ` · Ref ${job.job_reference}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium">{statusLabel(job.status)}</span>
          {canEdit ? <Link href={`/jobs/${job.id}?edit=1#edit-job`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"><Pencil className="size-4" /> Edit details</Link> : null}
          {job.customer_id ? <Link href={`/customers/${job.customer_id}`} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]">Customer profile</Link> : null}
          <Link href={`/jobs/${job.id}/messages?channel=sms`} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]">Send SMS</Link>
          <Link href={`/jobs/${job.id}/messages?channel=email`} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]">Send Email</Link>
          <Link href={`/jobs/${job.id}/photos`} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#05291f]"><Camera className="size-4" /> Add photos</Link>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-sm">
        {tabs.map((tab, index) => { const Icon = tab.icon; return <Link key={tab.label} href={`/jobs/${job.id}${tab.suffix}`} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${index === 0 ? "bg-[var(--surface-3)] text-[var(--brand-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`}><Icon className="size-4" /> {tab.label}</Link>; })}
      </nav>

      <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-semibold">Quotation and production progress</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Quotation authorisation is separate from workshop repair status. Changes are saved to the job activity history.</p>
        <form action={progressAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-[210px] flex-1 gap-1 text-xs text-[var(--muted)]">Quotation progress
            <select name="quote_status" defaultValue={job.quote_status} disabled={!canEdit} className="app-input">{quoteStates.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </label>
          <label className="grid min-w-[210px] flex-1 gap-1 text-xs text-[var(--muted)]">Repair progress
            <select name="repair_status" defaultValue={job.repair_status} disabled={!canEdit} className="app-input">{repairStates.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </label>
          {canEdit ? <button type="submit" className="rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e]">Save progress</button> : null}
        </form>
      </section>

      {canEdit ? (
        <details id="edit-job" open={query.edit === "1"} className="mb-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Edit job, vehicle, customer and claim details</summary>
          <form action={updateAction} className="border-t border-[var(--border)] p-5 sm:p-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <fieldset className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
                <legend className="px-2 text-sm font-semibold">Job & workflow</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Job reference"><input name="job_reference" defaultValue={job.job_reference ?? ""} className="app-input" /></Field>
                  <Field label="Status"><select name="status" defaultValue={job.status} className="app-input">{statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></Field>
                  <Field label="Repair type"><input name="repair_type" defaultValue={job.repair_type ?? ""} className="app-input" placeholder="Collision" /></Field>
                  <Field label="Repair size"><input name="repair_size" defaultValue={job.repair_size ?? ""} className="app-input" placeholder="Minor / medium / major" /></Field>
                  <Field label="Work source"><input name="work_source" defaultValue={job.work_source ?? ""} className="app-input" placeholder="Insurance / private" /></Field>
                  <Field label="Priority"><select name="priority" defaultValue={schedule?.priority ?? "normal"} className="app-input"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field>
                  <Field label="Due date"><input type="datetime-local" name="due_at" defaultValue={schedule?.due_at ? new Date(schedule.due_at).toISOString().slice(0, 16) : ""} className="app-input" /></Field>
                  <Field label="Branch"><select name="branch_id" defaultValue={job.branch_id ?? ""} className="app-input"><option value="">No branch selected</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
                  <Field label="Assigned team member"><select name="assigned_to" defaultValue={job.assigned_to ?? ""} className="app-input"><option value="">Unassigned</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{statusLabel(member.role)} · {member.user_id.slice(0, 8)}</option>)}</select></Field>
                </div>
              </fieldset>

              <fieldset className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
                <legend className="px-2 text-sm font-semibold">Vehicle</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Registration"><input name="registration" defaultValue={vehicle?.registration ?? ""} className="app-input" /></Field>
                  <Field label="VIN"><input name="vin" defaultValue={vehicle?.vin ?? ""} className="app-input" /></Field>
                  <Field label="Year"><input type="number" name="model_year" defaultValue={vehicle?.model_year ?? ""} className="app-input" /></Field>
                  <Field label="Make"><input name="make" defaultValue={vehicle?.make ?? ""} className="app-input" /></Field>
                  <Field label="Model"><input name="model" defaultValue={vehicle?.model ?? ""} className="app-input" /></Field>
                  <Field label="Variant"><input name="variant" defaultValue={vehicle?.variant ?? ""} className="app-input" /></Field>
                  <Field label="Colour"><input name="colour" defaultValue={vehicle?.colour ?? ""} className="app-input" /></Field>
                  <Field label="Paint code"><input name="paint_code" defaultValue={vehicle?.paint_code ?? ""} className="app-input" /></Field>
                  <Field label="Odometer (km)"><input type="number" name="odometer_km" defaultValue={vehicle?.odometer_km ?? ""} className="app-input" /></Field>
                  <Field label="Body type"><input name="body_type" defaultValue={vehicle?.body_type ?? ""} className="app-input" /></Field>
                  <Field label="Fuel type"><input name="fuel_type" defaultValue={vehicle?.fuel_type ?? ""} className="app-input" /></Field>
                  <Field label="Vehicle origin"><input name="vehicle_origin" defaultValue={vehicle?.vehicle_origin ?? ""} className="app-input" /></Field>
                  <Field label="Vehicle size"><input name="vehicle_size" defaultValue={vehicle?.vehicle_size ?? ""} className="app-input" /></Field>
                  <Field label="ADAS"><select name="adas_present" defaultValue={vehicle?.adas_present === true ? "yes" : vehicle?.adas_present === false ? "no" : "unknown"} className="app-input"><option value="unknown">Not confirmed</option><option value="yes">Present</option><option value="no">Not present</option></select></Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="is_ev" defaultChecked={Boolean(vehicle?.is_ev)} /> Electric vehicle</label><label className="flex items-center gap-2"><input type="checkbox" name="is_hybrid" defaultChecked={Boolean(vehicle?.is_hybrid)} /> Hybrid</label></div>
              </fieldset>

              <fieldset className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
                <legend className="px-2 text-sm font-semibold">Customer</legend>
                <Field label="Link an existing customer"><select name="existing_customer_id" defaultValue="" className="app-input"><option value="">Keep and edit current customer</option>{customers.filter((item) => item.id !== job.customer_id).map((item) => { const name = item.business_name || [item.first_name, item.last_name].filter(Boolean).join(" ") || item.email || "Customer"; return <option key={item.id} value={item.id}>{name}</option>; })}</select></Field>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Type"><select name="customer_type" defaultValue={customer?.customer_type ?? "individual"} className="app-input"><option value="individual">Individual</option><option value="business">Business</option></select></Field>
                  <Field label="Business name"><input name="customer_business_name" defaultValue={customer?.business_name ?? ""} className="app-input" /></Field>
                  <Field label="First name"><input name="customer_first_name" defaultValue={customer?.first_name ?? ""} className="app-input" /></Field>
                  <Field label="Last name"><input name="customer_last_name" defaultValue={customer?.last_name ?? ""} className="app-input" /></Field>
                  <Field label="Email"><input type="email" name="customer_email" defaultValue={customer?.email ?? ""} className="app-input" /></Field>
                  <Field label="Phone"><input name="customer_phone" defaultValue={customer?.phone ?? ""} className="app-input" /></Field>
                  <Field label="Address"><input name="customer_address_line1" defaultValue={customer?.address_line1 ?? ""} className="app-input" /></Field>
                  <Field label="Address line 2"><input name="customer_address_line2" defaultValue={customer?.address_line2 ?? ""} className="app-input" /></Field>
                  <Field label="City"><input name="customer_city" defaultValue={customer?.city ?? ""} className="app-input" /></Field>
                  <Field label="Region"><input name="customer_region" defaultValue={customer?.region ?? ""} className="app-input" /></Field>
                  <Field label="Postcode"><input name="customer_postcode" defaultValue={customer?.postcode ?? ""} className="app-input" /></Field>
                  <Field label="Country"><input name="customer_country_code" defaultValue={customer?.country_code ?? "NZ"} className="app-input" /></Field>
                </div>
                <Field label="Customer notes" className="mt-4"><textarea name="customer_notes" defaultValue={customer?.notes ?? ""} className="app-input min-h-24" /></Field>
              </fieldset>

              <fieldset className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
                <legend className="px-2 text-sm font-semibold">Insurance claim</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Insurer"><select name="insurer_id" defaultValue={claim?.insurer_id ?? ""} className="app-input"><option value="">No insurer selected</option>{insurers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                  <Field label="Claim number"><input name="claim_number" defaultValue={claim?.claim_number ?? ""} className="app-input" /></Field>
                  <Field label="Policy number"><input name="policy_number" defaultValue={claim?.policy_number ?? ""} className="app-input" /></Field>
                  <Field label="Excess"><input type="number" step="0.01" name="excess_amount" defaultValue={claim?.excess_amount ?? ""} className="app-input" /></Field>
                  <Field label="Assessor"><input name="assessor_name" defaultValue={claim?.assessor_name ?? ""} className="app-input" /></Field>
                  <Field label="Assessor email"><input type="email" name="assessor_email" defaultValue={claim?.assessor_email ?? ""} className="app-input" /></Field>
                  <Field label="Assessor phone"><input name="assessor_phone" defaultValue={claim?.assessor_phone ?? ""} className="app-input" /></Field>
                  <Field label="Case manager"><input name="case_manager_name" defaultValue={claim?.case_manager_name ?? ""} className="app-input" /></Field>
                  <Field label="Case manager email"><input type="email" name="case_manager_email" defaultValue={claim?.case_manager_email ?? ""} className="app-input" /></Field>
                  <Field label="Accident date"><input type="date" name="accident_date" defaultValue={claim?.accident_date ?? ""} className="app-input" /></Field>
                  <Field label="Accident location"><input name="accident_location" defaultValue={claim?.accident_location ?? ""} className="app-input" /></Field>
                  <Field label="Authority reference"><input name="authority_reference" defaultValue={claim?.authority_reference ?? ""} className="app-input" /></Field>
                </div>
                <Field label="Accident description" className="mt-4"><textarea name="accident_description" defaultValue={claim?.accident_description ?? ""} className="app-input min-h-28" /></Field>
              </fieldset>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2"><Link href={`/jobs/${job.id}`} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold">Cancel</Link><button className="rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[#05291f]">Save all details</button></div>
          </form>
        </details>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <section className="app-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand-strong)]"><CarFront className="size-4" /></span><div><h2 className="font-semibold">Vehicle</h2><p className="text-xs text-[var(--muted)]">Identification and repair context.</p></div></div>
            <dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Registration" value={text(vehicle?.registration)} />
              <Info label="VIN" value={text(vehicle?.vin)} />
              <Info label="Paint" value={[vehicle?.colour, vehicle?.paint_code].filter(Boolean).join(" · ") || "—"} />
              <Info label="Odometer" value={vehicle?.odometer_km != null ? `${Number(vehicle.odometer_km).toLocaleString("en-NZ")} km` : "—"} />
              <Info label="Body / fuel" value={[vehicle?.body_type, vehicle?.fuel_type].filter(Boolean).join(" · ") || "—"} />
              <Info label="EV / ADAS" value={`${vehicle?.is_ev ? "EV" : vehicle?.is_hybrid ? "Hybrid" : "Standard"} · ${vehicle?.adas_present === true ? "ADAS present" : vehicle?.adas_present === false ? "No ADAS noted" : "ADAS not confirmed"}`} />
              <Info label="Repair type" value={text(job.repair_type)} />
              <Info label="Repair size" value={text(job.repair_size)} />
              <Info label="Work source" value={text(job.work_source)} />
              <Info label="Priority" value={schedule?.priority ? statusLabel(schedule.priority) : "Normal"} />
              <Info label="Due" value={schedule?.due_at ? new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(schedule.due_at)) : "—"} />
            </dl>
          </section>

          <section className="app-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand-strong)]"><Shield className="size-4" /></span><div><h2 className="font-semibold">Insurance claim</h2><p className="text-xs text-[var(--muted)]">Claim and assessor information.</p></div></div>
            <dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Insurer" value={text(insurer?.name)} />
              <Info label="Claim" value={text(claim?.claim_number)} />
              <Info label="Policy" value={text(claim?.policy_number)} />
              <Info label="Assessor" value={text(claim?.assessor_name)} />
              <Info label="Assessor contact" value={claim?.assessor_email || claim?.assessor_phone || "—"} />
              <Info label="Excess" value={claim?.excess_amount != null ? new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(Number(claim.excess_amount)) : "—"} />
              <Info label="Accident date" value={claim?.accident_date ? new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(`${claim.accident_date}T00:00:00`)) : "—"} />
              <Info label="Location" value={text(claim?.accident_location)} />
              <Info label="Authority ref" value={text(claim?.authority_reference)} />
            </dl>
            {claim?.accident_description ? <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4"><div className="mb-1 text-xs font-medium text-[var(--muted)]">Accident description</div><p className="text-sm leading-6">{claim.accident_description}</p></div> : <p className="mt-5 text-sm text-[var(--muted)]">No accident description added yet.</p>}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="app-card p-5">
            <div className="mb-4 flex items-center gap-3"><UserRound className="size-4 text-[var(--brand-strong)]" /><h2 className="font-semibold">Customer</h2></div>
            <p className="font-medium">{customerName}</p><p className="mt-2 text-sm text-[var(--muted)]">{customer?.email || "No email"}</p><p className="mt-1 text-sm text-[var(--muted)]">{customer?.phone || "No phone"}</p>
            {job.customer_id ? <Link href={`/customers/${job.customer_id}`} className="mt-4 inline-flex text-sm font-semibold text-[var(--brand-strong)]">Open customer profile →</Link> : null}
          </section>

          <section className="app-card p-5">
            <div className="mb-4 flex items-center gap-3"><History className="size-4 text-[var(--brand-strong)]" /><div><h2 className="font-semibold">Recent activity</h2><p className="text-xs text-[var(--muted)]">Status history</p></div></div>
            <div className="space-y-4">{statusHistory.length ? statusHistory.map((entry) => <div key={entry.id} className="relative border-l border-[var(--border)] pl-4"><span className="absolute -left-1 top-1 size-2 rounded-full bg-[var(--brand)]" /><p className="text-sm font-medium">{statusLabel(entry.to_status)}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</p></div>) : <p className="text-sm text-[var(--muted)]">No activity yet.</p>}</div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-[var(--brand-strong)]" /><div><h2 className="font-semibold">Next: evidence capture</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Upload identification, wide-angle and close-up damage photos before analysis. Findings remain a draft until reviewed by an estimator.</p><Link href={`/jobs/${job.id}/photos`} className="mt-4 inline-flex text-sm font-semibold text-[var(--brand-strong)]">Open photo capture →</Link></div></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={className}><span className="app-label">{label}</span>{children}</label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="mt-1.5 text-sm text-[var(--text)]">{value}</dd></div>;
}
