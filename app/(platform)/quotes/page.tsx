import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { quoteStates } from "@/app/(platform)/jobs/[id]/stage-actions";

function currency(amount: number, code: string) {
  return new Intl.NumberFormat("en-NZ", {style:"currency", currency:code}).format(amount);
}

export default async function QuotesPage({ searchParams }: {
  searchParams: Promise<{ q?:string; status?:string }>;
}) {
  const query = await searchParams;
  const { supabase, organizationId } = await requireOrganizationContext();
  const [jobsResult, estimateResult] = await Promise.all([
    supabase.from("jobs").select("id,job_number,job_reference,quote_status,status,customer_id,vehicle_id,updated_at")
      .eq("organization_id", organizationId).order("updated_at",{ascending:false}).limit(200),
    supabase.from("estimate_versions").select("job_id,version_number,total_inc_tax,currency")
      .eq("organization_id",organizationId).order("version_number",{ascending:false}).limit(1000),
  ]);
  const jobs = jobsResult.data ?? [];
  const vehicleIds = jobs.map(j=>j.vehicle_id).filter((v):v is string=>Boolean(v));
  const customerIds = jobs.map(j=>j.customer_id).filter((v):v is string=>Boolean(v));
  const [vehicleResult, customerResult] = await Promise.all([
    vehicleIds.length ? supabase.from("vehicles").select("id,registration,make,model").eq("organization_id",organizationId).in("id",vehicleIds) : Promise.resolve({data:[]}),
    customerIds.length ? supabase.from("customers").select("id,first_name,last_name,business_name").eq("organization_id",organizationId).in("id",customerIds) : Promise.resolve({data:[]}),
  ]);
  const vehicles = new Map((vehicleResult.data ?? []).map(v=>[v.id,v]));
  const customers = new Map((customerResult.data ?? []).map(c=>[c.id,c]));
  const latest = new Map<string,{total_inc_tax:number;currency:string}>();
  for(const item of estimateResult.data ?? []) if(!latest.has(item.job_id)) latest.set(item.job_id,item);
  const selectedStatus = quoteStates.some(s=>s.value===query.status) ? query.status : "all";
  const counts = new Map(quoteStates.map(s=>[s.value,jobs.filter(j=>j.quote_status===s.value).length]));
  const q=(query.q??"").toLowerCase().trim();
  const rows = jobs.filter(j=>{
    if (selectedStatus!=="all" && j.quote_status!==selectedStatus) return false;
    const c=j.customer_id?customers.get(j.customer_id):null;
    const v=j.vehicle_id?vehicles.get(j.vehicle_id):null;
    const name=c?.business_name || [c?.first_name,c?.last_name].filter(Boolean).join(" ");
    return !q || [j.job_number,j.job_reference,v?.registration,v?.make,v?.model,name].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--brand)]"><FileText className="size-4"/> Quotation workflow</p><h1 className="mt-2 text-3xl font-semibold">Quotes and authorisations</h1><p className="mt-2 text-sm text-[var(--muted)]">Quotation progress is managed separately from repair production progress.</p></div>
        <Link href="/jobs/new" className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">New assessment</Link></div>
      <div className="mt-6 flex flex-wrap gap-2">
        {[{value:"all",label:"All quotes"},...quoteStates].map((s)=>(
          <Link key={s.value} href={`/quotes?status=${s.value}${q?"&q="+encodeURIComponent(q):""}`} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${selectedStatus===s.value?"border-[var(--brand)] bg-[var(--surface-3)] text-[var(--brand)]":"border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]"}`}>
            {s.label} · {s.value==="all"?jobs.length:counts.get(s.value)||0}
          </Link>
        ))}
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <form method="get" className="border-b border-[var(--border)] p-4">
          <input type="hidden" name="status" value={selectedStatus} />
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[#091322] px-4 py-3"><Search className="size-4 text-[var(--muted)]" /><input name="q" defaultValue={query.q??""} className="w-full bg-transparent text-sm outline-none" placeholder="Search job, rego or customer…"/></label>
        </form>
        {jobsResult.error ? <p className="p-6 text-red-300">Unable to load quotes.</p> : rows.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]"><tr><th className="p-4">Job</th><th className="p-4">Vehicle</th><th className="p-4">Customer</th><th className="p-4">Quote status</th><th className="p-4">Last saved version</th><th className="p-4">Actions</th></tr></thead>
            <tbody>{rows.map((j)=>{
              const v=j.vehicle_id?vehicles.get(j.vehicle_id):null;
              const c=j.customer_id?customers.get(j.customer_id):null;
              const total=latest.get(j.id);
              return <tr key={j.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
                <td className="p-4"><Link className="font-semibold text-[var(--brand)]" href={`/jobs/${j.id}`}>{j.job_number}</Link></td>
                <td className="p-4">{[v?.make,v?.model].filter(Boolean).join(" ")||"Vehicle pending"}<p className="text-xs text-[var(--muted)]">{v?.registration||"Rego pending"}</p></td>
                <td className="p-4">{c?.business_name||[c?.first_name,c?.last_name].filter(Boolean).join(" ")||"Customer pending"}</td>
                <td className="p-4 capitalize">{quoteStates.find(s=>s.value===j.quote_status)?.label||"Awaiting quoting"}</td>
                <td className="p-4">{total?currency(Number(total.total_inc_tax),total.currency):"Not saved"}</td>
                <td className="p-4"><div className="flex gap-3"><Link href={`/jobs/${j.id}/estimate`} className="font-semibold text-[var(--brand)]">Estimate</Link><Link href={`/jobs/${j.id}`} className="text-[var(--muted)] hover:text-white">Manage</Link></div></td>
              </tr>;
            })}</tbody>
          </table></div>
        ): <p className="p-8 text-sm text-[var(--muted)]">No matching quotations.</p>}
      </section>
    </div>
  );
}
