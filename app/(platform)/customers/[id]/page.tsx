import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CarFront, FileText, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: customer } = await supabase.from("customers").select("id,customer_type,first_name,last_name,business_name,email,phone,address_line1,address_line2,city,region,postcode,country_code,notes,created_at,updated_at").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!customer) notFound();
  const [{ data: vehicles }, { data: jobs }] = await Promise.all([
    supabase.from("vehicles").select("id,registration,model_year,make,model,variant,colour,vin,updated_at").eq("organization_id", organizationId).eq("customer_id", id).order("updated_at", { ascending: false }),
    supabase.from("jobs").select("id,job_number,status,vehicle_id,job_reference,updated_at").eq("organization_id", organizationId).eq("customer_id", id).order("updated_at", { ascending: false }),
  ]);
  const vehicleById = new Map((vehicles ?? []).map((vehicle) => [vehicle.id, vehicle]));
  const name = customer.business_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer";
  const address = [customer.address_line1, customer.address_line2, customer.city, customer.region, customer.postcode].filter(Boolean).join(", ");

  return <div className="mx-auto max-w-[1300px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
    <Link href="/customers" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Back to customers</Link>
    <header className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e8f7f2] text-[#178f75]"><UserRound className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#178f75]">{customer.customer_type}</p><h1 className="mt-1 text-3xl font-semibold">{name}</h1><p className="mt-2 text-sm text-slate-500">Customer record and linked repair history.</p></div></header>
    <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Contact</h2><div className="mt-4 space-y-3 text-sm text-slate-600"><Info icon={Mail} value={customer.email || "No email"} /><Info icon={Phone} value={customer.phone || "No phone"} /><Info icon={MapPin} value={address || "No address"} /></div>{customer.notes ? <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{customer.notes}</div> : null}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Summary</h2><dl className="mt-4 grid grid-cols-2 gap-3"><Metric label="Vehicles" value={vehicles?.length ?? 0} /><Metric label="Jobs" value={jobs?.length ?? 0} /></dl></section></aside>
      <div className="space-y-5"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Vehicles</h2></div>{vehicles?.length ? <div className="divide-y divide-slate-100">{vehicles.map((vehicle) => <Link key={vehicle.id} href={`/vehicles/${vehicle.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"><CarFront className="size-5 text-[#178f75]" /><div className="min-w-0 flex-1"><p className="font-semibold">{[vehicle.model_year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ") || "Vehicle"}</p><p className="mt-1 text-xs text-slate-500">{vehicle.registration || "No registration"} · {vehicle.vin || "VIN pending"}</p></div></Link>)}</div> : <div className="p-8 text-center text-sm text-slate-500">No linked vehicles.</div>}</section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Repair jobs</h2></div>{jobs?.length ? <div className="divide-y divide-slate-100">{jobs.map((job) => { const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined; return <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"><FileText className="size-5 text-[#178f75]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{job.job_number}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-slate-500">{job.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-slate-500">{vehicle?.registration || "Vehicle pending"}{job.job_reference ? ` · Ref ${job.job_reference}` : ""}</p></div></Link>; })}</div> : <div className="p-8 text-center text-sm text-slate-500">No repair jobs.</div>}</section></div>
    </div>
  </div>;
}

function Info({ icon: Icon, value }: { icon: typeof Mail; value: string }) { return <div className="flex items-start gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-slate-400" /><span>{value}</span></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-50 p-3 text-center"><div className="text-xl font-semibold">{value}</div><div className="mt-1 text-[10px] text-slate-500">{label}</div></div>; }
