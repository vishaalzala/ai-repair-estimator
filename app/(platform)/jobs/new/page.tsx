import { ArrowLeft, Camera, CarFront, FileText, Shield, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { requireOrganizationContext } from "@/lib/auth/context";
import { QuickIntake } from "@/components/jobs/quick-intake";
import { INSURANCE_CUSTOMERS } from "@/lib/insurance/insurers";
import { createJob } from "../actions";

const steps = [
  { label: "Intake", icon: FileText },
  { label: "Photos", icon: Camera },
  { label: "Damage review", icon: Sparkles },
  { label: "Estimate", icon: Shield },
];

const inputClass = "rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const labelClass = "grid gap-2 text-sm";
const labelTextClass = "text-xs font-semibold text-slate-600";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, context] = await Promise.all([searchParams, requireOrganizationContext()]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
      <Link href="/jobs" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"><ArrowLeft className="size-4" /> Back to jobs</Link>
      <div className="mb-7"><h1 className="text-3xl font-bold tracking-tight text-slate-950">New assessment</h1><p className="mt-2 text-sm leading-6 text-slate-600">Start from photos with AI Quick Intake, or enter the assessment manually. Select the insurer or Private Job so the estimate can use the correct job context.</p></div>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

      <QuickIntake organizationId={context.organizationId} userId={context.userId} />

      <div className="my-8 flex items-center gap-4"><div className="h-px flex-1 bg-slate-200" /><span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Or enter manually</span><div className="h-px flex-1 bg-slate-200" /></div>

      <div className="mb-5 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => { const Icon = step.icon; return <div key={step.label} className={`rounded-xl border p-3 shadow-sm ${index === 0 ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className={`flex items-center gap-2 text-xs font-semibold ${index === 0 ? "text-emerald-800" : "text-slate-700"}`}><Icon className="size-4" /> {step.label}</div></div>; })}
      </div>

      <form action={createJob} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><UserRound className="size-4" /></span><div><h2 className="font-semibold text-slate-950">Customer <span className="text-xs font-normal text-slate-500">(optional)</span></h2><p className="mt-0.5 text-xs leading-5 text-slate-600">Leave this empty if the customer or claim contact is not known yet.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClass}><span className={labelTextClass}>First name</span><input name="customer_first_name" className={inputClass} autoComplete="given-name" /></label>
            <label className={labelClass}><span className={labelTextClass}>Last name</span><input name="customer_last_name" className={inputClass} autoComplete="family-name" /></label>
            <label className={labelClass}><span className={labelTextClass}>Email</span><input name="customer_email" type="email" className={inputClass} autoComplete="email" /></label>
            <label className={labelClass}><span className={labelTextClass}>Phone</span><input name="customer_phone" className={inputClass} autoComplete="tel" /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CarFront className="size-4" /></span><div><h2 className="font-semibold text-slate-950">Vehicle</h2><p className="mt-0.5 text-xs leading-5 text-slate-600">Enter whatever is known. Missing vehicle details can be completed later or populated by AI from photos.</p></div></div>
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
          <div className="mt-5 flex flex-wrap gap-5 text-sm font-medium text-slate-600"><label className="flex items-center gap-2"><input type="checkbox" name="is_ev" className="size-4 accent-emerald-500" /> Electric vehicle</label><label className="flex items-center gap-2"><input type="checkbox" name="is_hybrid" className="size-4 accent-emerald-500" /> Hybrid</label></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Shield className="size-4" /></span><div><h2 className="font-semibold text-slate-950">Insurance & repair context</h2><p className="mt-0.5 text-xs leading-5 text-slate-600">Select the insurer or Private Job first. Claim information can be completed later.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass}><span className={labelTextClass}>Insurer / job type</span><select name="insurer_name" className={inputClass} defaultValue="" required><option value="" disabled>Select insurer or Private Job</option>{INSURANCE_CUSTOMERS.map((insurer) => <option key={insurer} value={insurer}>{insurer}</option>)}</select></label>
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
            <label className={labelClass}><span className={labelTextClass}>Work source</span><input name="work_source" className={inputClass} placeholder="Defaults from insurer selection" /></label>
            <label className={labelClass}><span className={labelTextClass}>Job reference</span><input name="job_reference" className={inputClass} /></label>
            <label className={labelClass}><span className={labelTextClass}>Authority reference</span><input name="authority_reference" className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2 lg:col-span-3`}><span className={labelTextClass}>Accident description</span><textarea name="accident_description" rows={4} className={inputClass} placeholder="Brief description of the incident and reported damage." /></label>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-600">Manual creation saves the assessment first. You can add photos and run AI from the job afterward.</p>
          <button type="submit" className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300">Create assessment & continue</button>
        </div>
      </form>
    </div>
  );
}
