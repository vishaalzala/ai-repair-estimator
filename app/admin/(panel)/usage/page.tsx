import { requirePlatformAdmin } from "@/lib/admin/context";

function money(value:number){return new Intl.NumberFormat("en-NZ",{style:"currency",currency:"NZD",minimumFractionDigits:2,maximumFractionDigits:4}).format(value);}

export default async function AdminUsagePage(){
  const {supabase}=await requirePlatformAdmin();
  const month=new Date(); month.setUTCDate(1); month.setUTCHours(0,0,0,0);
  const [ledgerResult,orgResult,chargesResult]=await Promise.all([
    supabase.from("ai_usage_ledger").select("id,organization_id,job_id,estimate_id,model,input_tokens,cached_input_tokens,output_tokens,provider_cost_usd,provider_cost_nzd,markup_percent,customer_charge_nzd,billing_status,created_at").gte("created_at",month.toISOString()).order("created_at",{ascending:false}).limit(2000),
    supabase.from("organizations").select("id,name"),
    supabase.from("estimate_ai_charges").select("organization_id,job_id,provider_cost_nzd,customer_charge_nzd,status").gte("created_at",month.toISOString()),
  ]);

  const orgs=new Map((orgResult.data??[]).map(o=>[o.id,o.name]));
  const ledger=ledgerResult.data??[];
  const charges=chargesResult.data??[];
  const provider=charges.reduce((s,r)=>s+Number(r.provider_cost_nzd??0),0);
  const revenue=charges.reduce((s,r)=>s+Number(r.customer_charge_nzd??0),0);
  const estimateCount=new Set(charges.map(r=>r.job_id).filter(Boolean)).size;
  const jobCount=new Set(ledger.map(r=>r.job_id).filter(Boolean)).size;
  const totalInput=ledger.reduce((s,r)=>s+Number(r.input_tokens??0),0);
  const cachedInput=ledger.reduce((s,r)=>s+Number(r.cached_input_tokens??0),0);
  const cacheHit=totalInput>0?(cachedInput/totalInput)*100:0;
  const callsPerEstimate=jobCount>0?ledger.length/jobCount:0;
  const avgProvider=estimateCount>0?provider/estimateCount:0;
  const modelCounts=new Map<string,number>();
  for(const row of ledger) modelCounts.set(String(row.model), (modelCounts.get(String(row.model))??0)+1);

  return <div className="mx-auto max-w-[1600px] p-5 sm:p-7 lg:p-9">
    <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Metering</p><h1 className="mt-2 text-3xl font-semibold">Usage & Costs</h1><p className="mt-2 text-sm text-[var(--muted)]">Provider cost, customer usage charges and cost-efficiency metrics for the current month.</p></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <Metric label="Provider cost" value={money(provider)}/>
      <Metric label="Customer AI charges" value={money(revenue)}/>
      <Metric label="AI usage margin" value={money(Math.max(0,revenue-provider))}/>
      <Metric label="Avg provider / estimate" value={money(avgProvider)}/>
      <Metric label="Cache hit" value={`${cacheHit.toFixed(1)}%`}/>
      <Metric label="Calls / estimate" value={callsPerEstimate.toFixed(2)}/>
    </div>

    <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">Model mix this month</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...modelCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([model,count])=><span key={model} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"><strong>{model}</strong> · {count} call{count===1?"":"s"}</span>)}
        {!modelCounts.size?<span className="text-sm text-slate-500">No AI usage recorded this month.</span>:null}
      </div>
    </section>

    <section className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <table className="w-full min-w-[1180px] text-left text-xs"><thead className="border-b border-[var(--border)] text-[10px] uppercase text-[var(--muted)]"><tr>{["Workshop","Model","Tokens in / cached / out","Cache hit","Provider USD","Provider NZD","Markup","Customer charge","Billing","Created"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
        <tbody>{ledger.map(row=>{
          const input=Number(row.input_tokens??0); const cached=Number(row.cached_input_tokens??0); const hit=input>0?(cached/input)*100:0;
          return <tr key={row.id} className="border-b border-[var(--border)]/70 last:border-0"><td className="px-3 py-3">{orgs.get(row.organization_id)??"Unknown"}</td><td className="px-3 py-3">{row.model}</td><td className="px-3 py-3">{input} / {cached} / {row.output_tokens}</td><td className="px-3 py-3">{hit.toFixed(1)}%</td><td className="px-3 py-3">${Number(row.provider_cost_usd).toFixed(6)}</td><td className="px-3 py-3">{money(Number(row.provider_cost_nzd))}</td><td className="px-3 py-3">{Number(row.markup_percent).toFixed(1)}%</td><td className="px-3 py-3 font-semibold">{money(Number(row.customer_charge_nzd))}</td><td className="px-3 py-3 capitalize">{row.billing_status}</td><td className="px-3 py-3 text-[var(--muted)]">{new Date(row.created_at).toLocaleString("en-NZ")}</td></tr>;
        })}</tbody>
      </table>
    </section>
  </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"><div className="text-xs text-[var(--muted)]">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>}
