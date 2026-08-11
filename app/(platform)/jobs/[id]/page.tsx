import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, CarFront, ClipboardList, FileText, History, Shield, Sparkles, UserRound } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

function text(value: string | null | undefined) {
  return value?.trim() || "—";
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
  { label: "History", icon: History, suffix: "/history" },
];

export default async function JobOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, status, customer_id, vehicle_id, job_reference, repair_type, repair_size, work_source, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!job) notFound();

  const [vehicleResult, customerResult, claimResult, statusHistoryResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, vin, make, model, variant, model_year, colour, paint_code, odometer_km, body_type, fuel_type, is_ev, is_hybrid, adas_present").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    job.customer_id ? supabase.from("customers").select("first_name, last_name, business_name, email, phone").eq("id", job.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("claims").select("insurer_id, claim_number, policy_number, assessor_name, assessor_email, assessor_phone, excess_amount, accident_date, accident_location, accident_description, authority_reference").eq("job_id", job.id).maybeSingle(),
    supabase.from("job_status_history").select("id, from_status, to_status, created_at").eq("job_id", job.id).order("created_at", { ascending: false }).limit(8),
  ]);
  const vehicle = vehicleResult.data;
  const customer = customerResult.data;
  const claim = claimResult.data;
  const statusHistory = statusHistoryResult.data ?? [];

  const { data: insurer } = claim?.insurer_id
    ? await supabase.from("insurers").select("name").eq("id", claim.insurer_id).maybeSingle()
    : { data: null };

  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model, vehicle?.variant].filter(Boolean).join(" ") || "Vehicle details pending";
  const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer pending";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href="/jobs" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to jobs</Link>

      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]"><span>{job.job_number}</span><span>•</span><span>{text(vehicle?.registration)}</span><span>•</span><span>{text(claim?.claim_number)}</span></div>
          <h1 className="text-3xl font-semibold tracking-tight">{vehicleTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{customerName}{job.job_reference ? ` · Ref ${job.job_reference}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium">{statusLabel(job.status)}</span><Link href={`/jobs/${job.id}/photos`} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]"><Camera className="size-4" /> Add photos</Link></div>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
        {tabs.map((tab, index) => { const Icon = tab.icon; return <Link key={tab.label} href={`/jobs/${job.id}${tab.suffix}`} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${index === 0 ? "bg-[var(--surface-3)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white"}`}><Icon className="size-4" /> {tab.label}</Link>; })}
      </nav>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><CarFront className="size-4" /></span><div><h2 className="font-semibold">Vehicle</h2><p className="text-xs text-[var(--muted)]">Identification and repair context.</p></div></div>
            <dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Registration" value={text(vehicle?.registration)} />
              <Info label="VIN" value={text(vehicle?.vin)} />
              <Info label="Paint" value={[vehicle?.colour, vehicle?.paint_code].filter(Boolean).join(" · ") || "—"} />
              <Info label="Odometer" value={vehicle?.odometer_km != null ? `${vehicle.odometer_km.toLocaleString("en-NZ")} km` : "—"} />
              <Info label="Body / fuel" value={[vehicle?.body_type, vehicle?.fuel_type].filter(Boolean).join(" · ") || "—"} />
              <Info label="EV / ADAS" value={`${vehicle?.is_ev ? "EV" : vehicle?.is_hybrid ? "Hybrid" : "Standard"} · ${vehicle?.adas_present === true ? "ADAS present" : vehicle?.adas_present === false ? "No ADAS noted" : "ADAS not confirmed"}`} />
              <Info label="Repair type" value={text(job.repair_type)} />
              <Info label="Repair size" value={text(job.repair_size)} />
              <Info label="Work source" value={text(job.work_source)} />
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Shield className="size-4" /></span><div><h2 className="font-semibold">Insurance claim</h2><p className="text-xs text-[var(--muted)]">Claim and assessor information.</p></div></div>
            <dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Insurer" value={text(insurer?.name)} />
              <Info label="Claim" value={text(claim?.claim_number)} />
              <Info label="Policy" value={text(claim?.policy_number)} />
              <Info label="Assessor" value={text(claim?.assessor_name)} />
              <Info label="Assessor contact" value={claim?.assessor_email || claim?.assessor_phone || "—"} />
              <Info label="Excess" value={claim?.excess_amount != null ? new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(claim.excess_amount) : "—"} />
              <Info label="Accident date" value={claim?.accident_date ? new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(`${claim.accident_date}T00:00:00`)) : "—"} />
              <Info label="Location" value={text(claim?.accident_location)} />
              <Info label="Authority ref" value={text(claim?.authority_reference)} />
            </dl>
            {claim?.accident_description ? <div className="mt-5 rounded-xl border border-[var(--border)] bg-[#091322] p-4"><div className="mb-1 text-xs font-medium text-[var(--muted)]">Accident description</div><p className="text-sm leading-6">{claim.accident_description}</p></div> : null}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-3"><UserRound className="size-4 text-[var(--brand)]" /><h2 className="font-semibold">Customer</h2></div>
            <p className="font-medium">{customerName}</p><p className="mt-2 text-sm text-[var(--muted)]">{customer?.email || "No email"}</p><p className="mt-1 text-sm text-[var(--muted)]">{customer?.phone || "No phone"}</p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-3"><History className="size-4 text-[var(--brand)]" /><div><h2 className="font-semibold">Recent activity</h2><p className="text-xs text-[var(--muted)]">Status history</p></div></div>
            <div className="space-y-4">
              {statusHistory.length ? statusHistory.map((entry) => <div key={entry.id} className="relative border-l border-[var(--border)] pl-4"><span className="absolute -left-1 top-1 size-2 rounded-full bg-[var(--brand)]" /><p className="text-sm font-medium">{statusLabel(entry.to_status)}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</p></div>) : <p className="text-sm text-[var(--muted)]">No activity yet.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--brand)]/25 bg-[rgba(88,211,178,0.06)] p-5">
            <div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-[var(--brand)]" /><div><h2 className="font-semibold">Next: evidence capture</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Upload identification, wide-angle and close-up damage photos before running AI. AI findings remain a draft until reviewed by an estimator.</p><Link href={`/jobs/${job.id}/photos`} className="mt-4 inline-flex text-sm font-semibold text-[var(--brand)]">Open photo capture →</Link></div></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="mt-1.5 text-sm text-white">{value}</dd></div>;
}
