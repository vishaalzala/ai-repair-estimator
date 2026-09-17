import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, CarFront, ClipboardList, FileText, History, ListTodo, NotebookPen, PackageSearch, Save, Shield, Sparkles, UserRound, Wrench } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { updateJobOverview } from "./actions";

function value(input: string | number | null | undefined) {
  return input == null ? "" : String(input);
}

function statusLabel(status: string) {
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

const tabs = [
  { label: "Overview", icon: ClipboardList, suffix: "" },
  { label: "Photos", icon: Camera, suffix: "/photos" },
  { label: "Damage", icon: CarFront, suffix: "/damage" },
  { label: "Estimate", icon: FileText, suffix: "/estimate" },
  { label: "AI Review", icon: Sparkles, suffix: "/ai-review" },
  { label: "Parts", icon: PackageSearch, suffix: "/parts" },
  { label: "Supplements", icon: Wrench, suffix: "/supplements" },
  { label: "Notes", icon: NotebookPen, suffix: "/notes" },
  { label: "Tasks", icon: ListTodo, suffix: "/daily-tasks" },
  { label: "History", icon: History, suffix: "/history" },
];

const statuses = ["draft", "intake_complete", "photos_required", "ai_analysing", "damage_review", "estimating", "awaiting_parts", "ai_review", "ready_for_approval", "approved", "sent_to_insurer", "awaiting_response", "authorised", "revision_requested", "supplement_required", "completed", "cancelled"];

export default async function JobOverviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, status, customer_id, vehicle_id, job_reference, repair_type, repair_size, work_source, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const [vehicleResult, customerResult, claimResult, statusHistoryResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, vin, make, model, variant, model_year, colour, paint_code, odometer_km, body_type, fuel_type, is_ev, is_hybrid, adas_present").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    job.customer_id ? supabase.from("customers").select("first_name, last_name, business_name, email, phone, address_line1, address_line2, city, region, postcode").eq("organization_id", organizationId).eq("id", job.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("claims").select("insurer_id, claim_number, policy_number, assessor_name, assessor_email, assessor_phone, excess_amount, accident_date, accident_location, accident_description, authority_reference").eq("organization_id", organizationId).eq("job_id", job.id).maybeSingle(),
    supabase.from("job_status_history").select("id, from_status, to_status, created_at").eq("organization_id", organizationId).eq("job_id", job.id).order("created_at", { ascending: false }).limit(8),
  ]);
  const vehicle = vehicleResult.data;
  const customer = customerResult.data;
  const claim = claimResult.data;
  const statusHistory = statusHistoryResult.data ?? [];
  const { data: insurer } = claim?.insurer_id ? await supabase.from("insurers").select("name").eq("organization_id", organizationId).eq("id", claim.insurer_id).maybeSingle() : { data: null };

  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model, vehicle?.variant].filter(Boolean).join(" ") || "Vehicle details pending";
  const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer pending";
  const saveAction = updateJobOverview.bind(null, job.id);

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
      <Link href="/jobs" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Back to jobs</Link>

      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{job.job_number}</span><span>•</span><span>{vehicle?.registration || "Registration pending"}</span><span>•</span><span>{claim?.claim_number || "Claim pending"}</span></div>
          <h1 className="text-3xl font-semibold tracking-tight">{vehicleTitle}</h1>
          <p className="mt-2 text-sm text-slate-500">{customerName}{job.job_reference ? ` · Ref ${job.job_reference}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">{statusLabel(job.status)}</span><Link href={`/jobs/${job.id}/photos`} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><Camera className="size-4" /> Add photos</Link></div>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {tabs.map((tab, index) => { const Icon = tab.icon; return <Link key={tab.label} href={`/jobs/${job.id}${tab.suffix}`} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${index === 0 ? "bg-[#e8f7f2] text-[#126f5d]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"}`}><Icon className="size-4" /> {tab.label}</Link>; })}
      </nav>

      {query.message ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.message}</div> : null}
      {query.error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{query.error}</div> : null}

      <form action={saveAction} className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <SectionTitle icon={CarFront} title="Vehicle & job details" subtitle="Edit identification, repair context and workflow details directly from this page." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Registration" name="registration" defaultValue={value(vehicle?.registration)} />
              <Field label="VIN" name="vin" defaultValue={value(vehicle?.vin)} />
              <Field label="Model year" name="model_year" type="number" defaultValue={value(vehicle?.model_year)} />
              <Field label="Make" name="make" defaultValue={value(vehicle?.make)} />
              <Field label="Model" name="model" defaultValue={value(vehicle?.model)} />
              <Field label="Variant" name="variant" defaultValue={value(vehicle?.variant)} />
              <Field label="Colour" name="colour" defaultValue={value(vehicle?.colour)} />
              <Field label="Paint code" name="paint_code" defaultValue={value(vehicle?.paint_code)} />
              <Field label="Odometer (km)" name="odometer_km" type="number" defaultValue={value(vehicle?.odometer_km)} />
              <Field label="Body type" name="body_type" defaultValue={value(vehicle?.body_type)} />
              <Field label="Fuel type" name="fuel_type" defaultValue={value(vehicle?.fuel_type)} />
              <SelectField label="ADAS" name="adas_present" defaultValue={vehicle?.adas_present === true ? "true" : vehicle?.adas_present === false ? "false" : ""} options={[{ value: "", label: "Not confirmed" }, { value: "true", label: "ADAS present" }, { value: "false", label: "No ADAS noted" }]} />
              <Field label="Repair type" name="repair_type" defaultValue={value(job.repair_type)} />
              <Field label="Repair size" name="repair_size" defaultValue={value(job.repair_size)} />
              <Field label="Work source" name="work_source" defaultValue={value(job.work_source)} />
              <Field label="Job reference" name="job_reference" defaultValue={value(job.job_reference)} />
              <SelectField label="Job status" name="status" defaultValue={job.status} options={statuses.map((status) => ({ value: status, label: statusLabel(status) }))} />
              <div className="flex items-end gap-5 pb-2"><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="is_ev" defaultChecked={Boolean(vehicle?.is_ev)} className="size-4 rounded border-slate-300 accent-[#2ebc98]" /> EV</label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="is_hybrid" defaultChecked={Boolean(vehicle?.is_hybrid)} className="size-4 rounded border-slate-300 accent-[#2ebc98]" /> Hybrid</label></div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <SectionTitle icon={Shield} title="Insurance claim" subtitle="Claim, assessor and accident information used by the estimate and insurer report." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Insurer" name="insurer_name" defaultValue={value(insurer?.name)} placeholder="e.g. AA Insurance" />
              <Field label="Claim number" name="claim_number" defaultValue={value(claim?.claim_number)} />
              <Field label="Policy number" name="policy_number" defaultValue={value(claim?.policy_number)} />
              <Field label="Assessor" name="assessor_name" defaultValue={value(claim?.assessor_name)} />
              <Field label="Assessor email" name="assessor_email" type="email" defaultValue={value(claim?.assessor_email)} />
              <Field label="Assessor phone" name="assessor_phone" defaultValue={value(claim?.assessor_phone)} />
              <Field label="Excess (NZD)" name="excess_amount" type="number" step="0.01" defaultValue={value(claim?.excess_amount)} />
              <Field label="Accident date" name="accident_date" type="date" defaultValue={value(claim?.accident_date)} />
              <Field label="Accident location" name="accident_location" defaultValue={value(claim?.accident_location)} />
              <Field label="Authority reference" name="authority_reference" defaultValue={value(claim?.authority_reference)} />
              <label className="sm:col-span-2 lg:col-span-3"><span className="mb-1.5 block text-xs font-medium text-slate-600">Accident description</span><textarea name="accident_description" rows={4} defaultValue={value(claim?.accident_description)} className="app-input resize-y" placeholder="Describe where and how the damage occurred…" /></label>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle icon={UserRound} title="Customer" subtitle="Add or update customer details." compact />
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><Field label="First name" name="customer_first_name" defaultValue={value(customer?.first_name)} /><Field label="Last name" name="customer_last_name" defaultValue={value(customer?.last_name)} /></div>
              <Field label="Business name" name="customer_business_name" defaultValue={value(customer?.business_name)} />
              <Field label="Email" name="customer_email" type="email" defaultValue={value(customer?.email)} />
              <Field label="Phone" name="customer_phone" defaultValue={value(customer?.phone)} />
              <Field label="Address" name="customer_address_line1" defaultValue={value(customer?.address_line1)} />
              <Field label="Address line 2" name="customer_address_line2" defaultValue={value(customer?.address_line2)} />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><Field label="City" name="customer_city" defaultValue={value(customer?.city)} /><Field label="Region" name="customer_region" defaultValue={value(customer?.region)} /></div>
              <Field label="Postcode" name="customer_postcode" defaultValue={value(customer?.postcode)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3"><History className="size-4 text-[#178f75]" /><div><h2 className="font-semibold">Recent activity</h2><p className="text-xs text-slate-500">Status history</p></div></div>
            <div className="space-y-4">{statusHistory.length ? statusHistory.map((entry) => <div key={entry.id} className="relative border-l border-slate-200 pl-4"><span className="absolute -left-1 top-1 size-2 rounded-full bg-[var(--brand)]" /><p className="text-sm font-medium text-slate-800">{statusLabel(entry.to_status)}</p><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</p></div>) : <p className="text-sm text-slate-500">No activity yet.</p>}</div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-[#178f75]" /><div><h2 className="font-semibold text-slate-900">Next: evidence capture</h2><p className="mt-2 text-sm leading-6 text-slate-600">Upload identification, wide-angle and close-up damage photos before running analysis. Findings remain a draft until reviewed by an estimator.</p><Link href={`/jobs/${job.id}/photos`} className="mt-4 inline-flex text-sm font-semibold text-[#178f75]">Open photo capture →</Link></div></div>
          </section>

          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-strong)]"><Save className="size-4" /> Save all details</button>
        </aside>
      </form>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, compact = false }: { icon: typeof CarFront; title: string; subtitle: string; compact?: boolean }) {
  return <div className={compact ? "mb-4" : "mb-5"}><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#e8f7f2] text-[#178f75]"><Icon className="size-4" /></span><div><h2 className="font-semibold text-slate-950">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div></div></div>;
}

function Field({ label, name, defaultValue, type = "text", placeholder, step }: { label: string; name: string; defaultValue?: string; type?: string; placeholder?: string; step?: string }) {
  return <label><span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span><input className="app-input" name={name} type={type} step={step} defaultValue={defaultValue} placeholder={placeholder} /></label>;
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: Array<{ value: string; label: string }> }) {
  return <label><span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span><select className="app-input" name={name} defaultValue={defaultValue}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
