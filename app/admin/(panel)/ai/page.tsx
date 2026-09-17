import { Bot, CheckCircle2, CircleDollarSign, Gauge, Zap } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin/context";
import { aiModelPolicyMode, escalationModel, modelFor } from "@/lib/ai/model-policy";
import { addModelPrice } from "./actions";

const field="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-slate-900";

export default async function AdminAiPage(){
  const {supabase}=await requirePlatformAdmin();
  const [pricesResult,runsResult]=await Promise.all([
    supabase.from("ai_model_prices").select("id,provider,model,input_usd_per_million,cached_input_usd_per_million,output_usd_per_million,effective_from,active").order("effective_from",{ascending:false}),
    supabase.from("ai_analysis_runs").select("id,task,provider,model,status,input_tokens,cached_input_tokens,output_tokens,estimated_cost_usd,latency_ms,created_at").order("created_at",{ascending:false}).limit(100),
  ]);

  const activePrices=(pricesResult.data??[]).filter(p=>p.active);
  const runs=runsResult.data??[];
  const completed=runs.filter(r=>r.status==="completed");
  const inputTokens=completed.reduce((sum,r)=>sum+Number(r.input_tokens??0),0);
  const cachedTokens=completed.reduce((sum,r)=>sum+Number(r.cached_input_tokens??0),0);
  const cacheHit=inputTokens>0?(cachedTokens/inputTokens)*100:0;
  const recentCost=completed.reduce((sum,r)=>sum+Number(r.estimated_cost_usd??0),0);

  const models=[
    ["Vehicle intake",modelFor("intake"),"Luna / low-detail vision"],
    ["Damage analysis",modelFor("damage"),"Luna / low-detail vision"],
    ["Estimate generation",modelFor("estimate"),"Terra normally"],
    ["Complex estimate escalation",escalationModel(),"Sol only when complexity threshold is met"],
    ["Estimate review",modelFor("review"),"Terra / low reasoning"],
    ["Document extraction",modelFor("document"),"Luna"],
    ["Training Cases",modelFor("training"),"Terra / reduced photo set"],
  ];

  return <div className="mx-auto max-w-[1600px] p-5 sm:p-7 lg:p-9">
    <header className="mb-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]"><Bot className="size-4"/> AI operations</div>
      <h1 className="mt-2 text-3xl font-semibold text-slate-950">AI Configuration</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Cost-aware routing, token usage and provider pricing used by SaaS metering.</p>
    </header>

    <div className="grid gap-4 sm:grid-cols-3">
      <Metric icon={<Gauge className="size-4"/>} label="Routing policy" value={aiModelPolicyMode()==="optimized"?"Optimized":"Custom"} />
      <Metric icon={<Zap className="size-4"/>} label="Recent cache hit" value={`${cacheHit.toFixed(1)}%`} />
      <Metric icon={<CircleDollarSign className="size-4"/>} label="Recent provider cost" value={`US$${recentCost.toFixed(4)}`} />
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {models.map(([label,value,note])=><section key={label} className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><CheckCircle2 className="size-3.5 text-[var(--brand)]"/>{label}</div>
        <div className="mt-2 break-all text-sm font-semibold text-slate-950">{value}</div>
        <div className="mt-1 text-xs text-slate-500">{note}</div>
      </section>)}
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Active model prices</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">USD per 1M tokens. Cached input is metered separately.</p>
        <div className="mt-4 space-y-2">{activePrices.map(p=><div key={p.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-[1.5fr_repeat(3,1fr)]">
          <strong>{p.model}</strong><span>Input ${Number(p.input_usd_per_million).toFixed(2)}</span><span>Cached ${Number(p.cached_input_usd_per_million).toFixed(2)}</span><span>Output ${Number(p.output_usd_per_million).toFixed(2)}</span>
        </div>)}</div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><CircleDollarSign className="size-4 text-[var(--brand)]"/><h2 className="font-semibold text-slate-950">Add / replace model price</h2></div>
        <form action={addModelPrice} className="mt-4 grid gap-3">
          <input name="model" required className={field} placeholder="gpt-5.6-terra"/>
          <input name="input" type="number" min="0" step="0.000001" required className={field} placeholder="Input USD / 1M"/>
          <input name="cached" type="number" min="0" step="0.000001" required className={field} placeholder="Cached input USD / 1M"/>
          <input name="output" type="number" min="0" step="0.000001" required className={field} placeholder="Output USD / 1M"/>
          <button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Publish price</button>
        </form>
      </section>
    </div>

    <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">Recent AI runs</h2>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs">
        <thead className="text-[10px] uppercase text-[var(--muted)]"><tr>{["Task","Model","Status","Input","Cached","Output","Cache hit","Cost USD","Latency","Created"].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>{runs.map(r=>{
          const input=Number(r.input_tokens??0); const cached=Number(r.cached_input_tokens??0); const hit=input>0?(cached/input)*100:0;
          return <tr key={r.id} className="border-t border-[var(--border)]">
            <td className="px-3 py-3">{r.task}</td><td className="px-3 py-3">{r.model}</td><td className="px-3 py-3 capitalize">{r.status}</td>
            <td className="px-3 py-3">{input}</td><td className="px-3 py-3">{cached}</td><td className="px-3 py-3">{r.output_tokens??0}</td>
            <td className="px-3 py-3">{hit.toFixed(1)}%</td><td className="px-3 py-3">${Number(r.estimated_cost_usd??0).toFixed(6)}</td>
            <td className="px-3 py-3">{r.latency_ms?`${r.latency_ms} ms`:"—"}</td><td className="px-3 py-3 text-[var(--muted)]">{new Date(r.created_at).toLocaleString("en-NZ")}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </section>
  </div>;
}

function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){
  return <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-xs text-[var(--muted)]">{icon}{label}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>;
}
