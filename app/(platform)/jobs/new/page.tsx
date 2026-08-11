import { ArrowLeft, Camera, CarFront, FileText, Shield, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { requireOrganizationContext } from "@/lib/auth/context";
import { QuickIntake } from "@/components/jobs/quick-intake";
import { createJob } from "../actions";

const steps = [
  { label: "Intake", icon: FileText },
  { label: "Photos", icon: Camera },
  { label: "Damage review", icon: Sparkles },
  { label: "Estimate", icon: Shield },
];

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 text-sm outline-none transition focus:border-[var(--brand)]";
const labelClass = "grid gap-2 text-sm";
const labelTextClass = "text-xs font-medium text-[var(--muted)]";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, context] = await Promise.all([searchParams, requireOrganizationContext()]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href="/jobs" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to jobs</Link>
      <div className="mb-7"><h1 className="text-3xl font-semibold tracking-tight">New assessment</h1><p className="mt-2 text-sm text-[var(--muted)]">Start from photos with AI Quick Intake, or enter the assessment manually. Customer details can be added later.</p></div>

      {error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <QuickIntake organizationId={context.organizationId} userId={context.userId} />

      <div className="my-8 flex items-center gap-4"><div className="h-px flex-1 bg-[var(--border)]" /><span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">Or enter manually</span><div className="h-px flex-1 bg-[var(--border)]" /></div>

      <div className="mb-5 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => { const Icon = step.icon; return <div key={step.label} className={`rounded-xl border p-3 ${index === 0 ? "border-[var(--brand)] bg-[rgba(88,211,178,0.08)]" : "border-[var(--border)] bg-[var(--surface)]"}`}><div className="flex items-center gap-2 text-xs font-medium"><Icon className="size-4" /> {step.label}</div></div>; })}
      </div>

      <form action={createJob} className="space-y-5">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><UserRound className="size-4" /></span><div><h2 className="font-semibold">Customer <span className="text-xs font-normal text-[var(--muted)]">(optional)</span></h2><p className="mt-0.5 text-xs text-[var(--muted)]">Leave this empty if the customer or claim contact is not known yet.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClass}><span className={labelTextClass}>First name</span><input name="customer_first_name" className={inputClass} autoComplete="given-name" /></label>
            <label className={labelClass}><span className={labelTextClass}>Last name</span><input name="customer_last_name" className={inputClass} autoComplete="family-name" /></label>
            <label className={labelClass}><span className={labelTextClass}>Email</span><input name="customer_email" type="email" className={inputClass} autoComplete="email" /></label>
            <label className={labelClass}><span className={labelTextClass}>Phone</span><input name="customer_phone" className={inputClass} autoComplete="tel" /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><CarFront className="size-4" /></span><div><h2 className="font-semibold">Vehicle</h2><p className="mt-0.5 text-xs text-[var(--muted)]">Enter whatever is known. Missing vehicle details can be completed later or populated by AI from photos.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass}><span className={labelTextClass}>Registration</span><input name="registration" className={inputClass} autoCapitalize="characters" /></label>
            <label className={labelClass}><span className={labelTextClass}>VIN</span><input name="vin" className={inputClass} autoCapitalize="characters" /></label>
            <label className={labelClass}><span className={labelTextClass}>Year</span><input name="model_year" type="number" min="1900" max="2100" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Make</span><input name="make" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Model</span><input name="model" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Variant</span><input name="variant" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Colour</span><input name="colour" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Paint code</span><input name="paint_code" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Odometer (km)</span><input name="odometer_km" type="number" min="0" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Body type</span><input name="body_type" className={inputClass} placeholder="SUV, hatch, ute…" /></label>
            <label className={labelClass}><span className={labelTextClass}>Fuel type</span><input name="fuel_type" className={inputClass} placeholder="Petrol, diesel, electric…" /></label>
            <label className={labelClass}><span className={labelTextClass}>ADAS present</span><select name="adas_present" className={inputClass} defaultValue=""><option value="">Not confirmed</option><option value="true">Yes</option><option value="false">No</option></select></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-5 text-sm text-[var(--muted)]"><label className="flex items-center gap-2"><input type="checkbox" name="is_ev" className="size-4 accent-[var(--brand)]" /> Electric vehicle</label><label className="flex items-center gap-2"><input type="checkbox" name="is_hybrid" className="size-4 accent-[var(--brand)]" /> Hybrid</label></div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Shield className="size-4" /></span><div><h2 className="font-semibold">Insurance & repair context</h2><p className="mt-0.5 text-xs text-[var(--muted)]">Claim information can be completed later if it is not available yet.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass}><span className={labelTextClass}>Insurer</span><input name="insurer_name" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Claim number</span><input name="claim_number" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Policy number</span><input name="policy_number" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Assessor</span><input name="assessor_name" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Assessor email</span><input name="assessor_email" type="email" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Assessor phone</span><input name="assessor_phone" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Excess</span><input name="excess_amount" type="number" min="0" step="0.01" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Accident date</span><input name="accident_date" type="date" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Accident location</span><input name="accident_location" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Repair type</span><select name="repair_type" className={inputClass} defaultValue="collision"><option value="collision">Collision</option><option value="mechanical">Mechanical</option><option value="mixed">Collision + mechanical</option><option value="assessment">Assessment only</option></select></label>
            <label className={labelClass}><span className={labelTextClass}>Repair size</span><select name="repair_size" className={inputClass} defaultValue=""><option value="">Not classified</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="major">Major</option></select></label>
            <label className={labelClass}><span className={labelTextClass}>Work source</span><input name="work_source" className={inputClass} placeholder="Insurer, private, fleet…" /></label>
            <label className={labelClass}><span className={labelTextClass}>Job reference</span><input name="job_reference" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Authority reference</span><input name="authority_reference" className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2 lg:col-span-3`}><span className={labelTextClass}>Accident description</span><textarea name="accident_description" rows={4} className={inputClass} placeholder="Brief description of the incident and reported damage." /></label>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--muted)]">Manual creation saves the assessment first. You can add photos and run AI from the job afterward.</p>
          <button type="submit" className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]">Create assessment & continue</button>
        </div>
      </form>
    </div>
  );
}
