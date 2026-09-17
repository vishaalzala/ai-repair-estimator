import Link from "next/link";
import { ArrowLeft, CheckCircle2, Link2, PackageSearch, PlugZap } from "lucide-react";

const integrations = [
  { name: "PartsTrader", description: "Parts request and supplier quote workflow.", configured: () => Boolean(process.env.PARTSTRADER_API_KEY || process.env.PARTSTRADER_CLIENT_ID), category: "Parts" },
  { name: "BNT", description: "Parts catalogue and pricing connection when enabled for the platform.", configured: () => Boolean(process.env.BNT_API_KEY), category: "Parts" },
  { name: "Repco", description: "Parts catalogue and pricing connection when enabled for the platform.", configured: () => Boolean(process.env.REPCO_API_KEY), category: "Parts" },
  { name: "PartsMaster", description: "Parts catalogue and pricing connection when enabled for the platform.", configured: () => Boolean(process.env.PARTSMASTER_API_KEY), category: "Parts" },
];

export default function IntegrationsPage() {
  return <div className="mx-auto max-w-[1100px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
    <Link href="/settings" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Back to settings</Link>
    <header><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#178f75]"><PlugZap className="size-4" /> Connections</div><h1 className="text-3xl font-semibold">Integrations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">See which external services are available to your workshop. Secret credentials are managed securely by platform administration and are never shown here.</p></header>
    <div className="mt-6 grid gap-4 md:grid-cols-2">{integrations.map((integration) => { const connected = integration.configured(); return <section key={integration.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-xl bg-[#e8f7f2] text-[#178f75]"><PackageSearch className="size-5" /></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{connected ? "Available" : "Not connected"}</span></div><div className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{integration.category}</p><h2 className="mt-1 text-lg font-semibold">{integration.name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{integration.description}</p></div>{connected ? <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-4" /> Connection is available for supported workflows</div> : <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Link2 className="size-4" /> Platform administrator setup required</div>}</section>; })}</div>
  </div>;
}
