import { BookOpen, Brain, ShieldCheck, Sparkles } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin/context";
import { AdminKnowledgeUploader } from "@/components/admin/admin-knowledge-uploader";
import { createGlobalKnowledge, retireGlobalKnowledge } from "./actions";

const field = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

export default async function AdminKnowledgePage() {
  const { supabase, userId } = await requirePlatformAdmin();
  const [sourcesResult, membershipResult] = await Promise.all([
    supabase.from("knowledge_sources").select("id,title,source_type,content_text,status,created_at,updated_at").eq("scope", "global").order("updated_at", { ascending: false }).limit(200),
    supabase.from("organization_members").select("organization_id").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle(),
  ]);
  const storageOrgId = membershipResult.data?.organization_id;

  return <div className="mx-auto max-w-[1500px] p-5 sm:p-7 lg:p-9">
    <header className="mb-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]"><Brain className="size-4" /> AI Estimator Training Centre</div>
      <h1 className="mt-2 text-3xl font-semibold">AI Knowledge</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted)]">Teach the platform estimator how a complete repair estimate should be built. Published global knowledge is included in future estimates; workshop prices remain controlled by Settings and are never learned from free-text rules.</p>
    </header>

    <section className="mb-5 grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><BookOpen className="size-5 text-[var(--brand)]" /><h2 className="mt-3 text-sm font-semibold">1. Describe the situation</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Example: “When a rear bumper and RH quarter are damaged in a rear impact…”</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><Sparkles className="size-5 text-[var(--brand)]" /><h2 className="mt-3 text-sm font-semibold">2. Tell AI what good estimators add</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">List the separate R&R, repair, paint/blend, parts, decals, scans, materials and alignment operations that should be considered.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><ShieldCheck className="size-5 text-[var(--brand)]" /><h2 className="mt-3 text-sm font-semibold">3. Mark uncertainty correctly</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Tell AI what must stay TBC or check-after-strip. Do not teach guessed hidden damage or hard-code supplier parts prices.</p></div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--brand)]/25 bg-[linear-gradient(145deg,rgba(88,211,178,0.08),rgba(12,25,42,0.96)_45%)] p-5">
          <div className="mb-4 flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-[var(--brand)]" /><div><h2 className="font-semibold">Teach a global estimating rule</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Write one repeatable rule at a time. Good rules explain when they apply, what separate estimate lines to consider, and what must remain TBC.</p></div></div>
          <form action={createGlobalKnowledge} className="grid gap-3">
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Rule title<input name="title" required className={field} placeholder="Example: Rear bumper + quarter impact completeness checklist" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Rule type<select name="rule_type" className={field} defaultValue="completeness"><option value="completeness">Estimate completeness</option><option value="remove_refit">Remove & Refit</option><option value="repair_replace">Repair vs Replace</option><option value="paint_blend">Paint & Blend</option><option value="parts">Parts / PartsTrader</option><option value="outwork_materials">Outwork & Materials</option><option value="inspection">Check after strip / inspection</option><option value="example_estimate">Approved estimate example</option></select></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">When this applies<textarea name="scenario" required rows={3} className={field} placeholder="Example: Rear impact where the rear bumper is displaced and the RH quarter/tailgate edge requires repair." /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">What AI should add / check<textarea name="expected" required rows={7} className={field} placeholder="Example: Consider bumper assembly R&R, sensor loom, lower garnish, side retainer, lamp R&R, boot trim for access, trial fit/gap check, separate quarter repair, separate tailgate repair, full paint lines, appropriate blend access and individual PartsTrader TBC replacement parts." /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">What stays TBC / check-after-strip<textarea name="tbc" rows={4} className={field} placeholder="Example: reinforcement, absorber, lamp mounting panel, hidden quarter inner structure, sensor brackets, radar calibration requirement, supplier parts prices." /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Additional guidance<textarea name="notes" rows={3} className={field} placeholder="Example: If company livery is visible and the panel is painted, add separate decal/signwriting outwork TBC. Do not blend panels that already receive full refinish." /></label>
            <button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Publish to AI Estimator</button>
          </form>
        </section>

        <section className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4"><h3 className="text-sm font-semibold text-amber-100">Do not teach prices as estimating knowledge</h3><p className="mt-2 text-xs leading-5 text-amber-100/75">Labour rates, paint rates, blend rates, parking fees and other deterministic workshop charges belong in Workshop Settings. Parts prices stay TBC until PartsTrader/supplier data is available. Use Knowledge to teach <em>what operations to consider</em>, not to override configured prices.</p></section>

        {storageOrgId ? <AdminKnowledgeUploader storageOrganizationId={storageOrgId} userId={userId} /> : <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Document upload needs this admin account to belong to at least one workshop for private storage ownership. Manual global knowledge works without it.</div>}
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Published global knowledge</h2><p className="mt-1 text-xs text-[var(--muted)]">Used by the estimator across workshops. Retired items stop influencing new estimates.</p></div><span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-xs text-[var(--muted)]">{sourcesResult.data?.length ?? 0}</span></div>
        <div className="space-y-3">{(sourcesResult.data ?? []).map(source => <article key={source.id} className="rounded-xl border border-[var(--border)] bg-[#091322] p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{source.title}</h3><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] uppercase text-[var(--muted)]">{source.source_type}</span><span className={`rounded-full px-2 py-0.5 text-[9px] ${source.status === "active" ? "bg-[rgba(88,211,178,0.1)] text-[var(--brand)]" : "bg-white/5 text-[var(--muted)]"}`}>{source.status}</span></div>{source.content_text ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--muted)]">{source.content_text}</p> : null}</div>{source.status !== "retired" ? <form action={retireGlobalKnowledge}><input type="hidden" name="source_id" value={source.id} /><button className="text-xs font-semibold text-[var(--muted)] hover:text-white">Retire</button></form> : null}</div></article>)}{!sourcesResult.data?.length ? <p className="text-sm text-[var(--muted)]">No global knowledge published yet.</p> : null}</div>
      </section>
    </div>
  </div>;
}
