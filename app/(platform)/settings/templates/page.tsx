import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

export default async function TemplatesPage() {
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data } = await supabase.from("report_templates").select("id,name,report_type,header_text,footer_text,show_evidence_photos,show_internal_notes,is_default,is_active,updated_at").eq("organization_id", organizationId).order("name");
  const templates = data ?? [];
  return <div className="mx-auto max-w-[1100px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
    <Link href="/settings" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Back to settings</Link>
    <header><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#178f75]"><FileText className="size-4" /> Output</div><h1 className="text-3xl font-semibold">Report templates</h1><p className="mt-2 text-sm text-slate-500">Review the insurer-facing report formats configured for this workshop.</p></header>
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{templates.length ? <div className="divide-y divide-slate-100">{templates.map((template) => <article key={template.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_180px_180px]"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{template.name}</h2>{template.is_default ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Default</span> : null}{!template.is_active ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Inactive</span> : null}</div><p className="mt-1 text-xs capitalize text-slate-500">{template.report_type.replaceAll("_", " ")}</p>{template.header_text ? <p className="mt-3 text-sm text-slate-600">{template.header_text}</p> : null}</div><div className="text-sm text-slate-600"><p>Evidence photos</p><p className="mt-1 text-xs text-slate-500">{template.show_evidence_photos ? "Included" : "Hidden"}</p></div><div className="text-sm text-slate-600"><p>Internal notes</p><p className="mt-1 text-xs text-slate-500">{template.show_internal_notes ? "Included" : "Hidden"}</p></div></article>)}</div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><FileText className="mx-auto size-9 text-slate-400" /><p className="mt-4 font-medium">No report templates yet</p><p className="mt-2 text-sm text-slate-500">The default insurer report format will be used.</p></div></div>}</section>
  </div>;
}
