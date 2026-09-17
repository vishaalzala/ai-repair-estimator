import { BookOpen, Brain, Database, ShieldCheck, Sparkles } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin/context";
import { AdminKnowledgeUploader } from "@/components/admin/admin-knowledge-uploader";
import { createGlobalKnowledge, createTrainingCase, retireGlobalKnowledge, retireTrainingCase } from "./actions";

const field = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

export default async function AdminKnowledgePage() {
  const { supabase, userId } = await requirePlatformAdmin();
  const [sourcesResult, membershipResult, trainingResult] = await Promise.all([
    supabase.from("knowledge_sources").select("id,title,source_type,content_text,status,created_at,updated_at").eq("scope", "global").order("updated_at", { ascending: false }).limit(200),
    supabase.from("organization_members").select("organization_id").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle(),
    supabase.from("estimator_training_cases").select("id,title,source_reference,source_document_name,source_photo_archive_name,status,vehicle_make,vehicle_model,vehicle_variant,vehicle_year,repair_area,damage_summary,damage_tags,estimator_lessons,photo_count,knowledge_source_id,created_at,updated_at").order("updated_at", { ascending: false }).limit(100),
  ]);
  const storageOrgId = membershipResult.data?.organization_id;
  const trainingCases = trainingResult.data ?? [];
  const trainingCaseIds = trainingCases.map((trainingCase) => trainingCase.id);
  const trainingLinesResult = trainingCaseIds.length
    ? await supabase.from("estimator_training_lines").select("training_case_id").in("training_case_id", trainingCaseIds)
    : { data: [] as Array<{ training_case_id: string }> };
  const lineCounts = new Map<string, number>();
  for (const line of trainingLinesResult.data ?? []) {
    lineCounts.set(line.training_case_id, (lineCounts.get(line.training_case_id) ?? 0) + 1);
  }

  return <div className="mx-auto max-w-[1500px] p-5 sm:p-7 lg:p-9">
    <header className="mb-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]"><Brain className="size-4" /> AI Estimator Training Centre</div>
      <h1 className="mt-2 text-3xl font-semibold">AI Knowledge</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted)]">Teach the platform estimator how a complete repair estimate should be built. Approved Training Cases and published global knowledge are included in future estimates; workshop prices remain controlled by Settings and are never learned blindly from old quotes.</p>
    </header>

    <section className="mb-5 grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><BookOpen className="size-5 text-[var(--brand)]" /><h2 className="mt-3 text-sm font-semibold">1. Add an approved case</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Use a final human-reviewed estimate together with a short description of the matching damage/photos.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><Sparkles className="size-5 text-[var(--brand)]" /><h2 className="mt-3 text-sm font-semibold">2. Teach structure, not prices</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Capture separate R&R, repair, paint/blend, parts, decals, scans, materials and alignment operations. Historical amounts remain examples only.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><ShieldCheck className="size-5 text-[var(--brand)]" /><h2 className="mt-3 text-sm font-semibold">3. Keep estimator control</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Current photos and estimator instructions always override precedent. Hidden damage stays TBC/check-after-strip unless the current job supports it.</p></div>
    </section>

    <section className="mb-6 rounded-2xl border border-[var(--brand)]/25 bg-[linear-gradient(145deg,rgba(88,211,178,0.08),rgba(12,25,42,0.96)_45%)] p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><Database className="mt-0.5 size-5 text-[var(--brand)]" /><div><h2 className="font-semibold">Training Cases — project estimator memory</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">Approved cases are stored separately from ordinary rules and publish a safe, price-neutral example into the estimator knowledge context. Retiring a case also retires its generated knowledge entry.</p></div></div>
        <span className="rounded-full bg-[rgba(88,211,178,0.1)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">{trainingCases.length} case{trainingCases.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form action={createTrainingCase} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[#07111f]/70 p-4">
          <div><h3 className="text-sm font-semibold">Approve & teach a case</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Enter the human-approved case summary and line structure. Prices are intentionally not required.</p></div>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">Case title<input name="training_title" required className={field} placeholder="2023 Hyundai Kona — RH rear impact — Estimate #10450" /></label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Year<input name="vehicle_year" type="number" min="1900" max="2100" className={field} /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Make<input name="vehicle_make" className={field} placeholder="Hyundai" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Model<input name="vehicle_model" className={field} placeholder="Kona" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Variant<input name="vehicle_variant" className={field} placeholder="Optional" /></label>
          </div>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">Repair / impact area<input name="repair_area" className={field} placeholder="Rear / RH quarter / bumper / tail-lamp area" /></label>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">Damage summary from photos<textarea name="damage_summary" required rows={4} className={field} placeholder="Describe only what the approved case/photos support." /></label>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">Damage tags, comma separated<input name="damage_tags" className={field} placeholder="rear impact, RH rear quarter, rear bumper, tailgate, tail lamp" /></label>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">Reusable estimator lessons<textarea name="estimator_lessons" rows={5} className={field} placeholder="Explain what a good estimator should consider on a similar case, and what should remain TBC." /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Source reference<input name="source_reference" className={field} placeholder="estimate-10450" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Photo count<input name="photo_count" type="number" min="0" className={field} placeholder="29" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Estimate/document name<input name="source_document_name" className={field} placeholder="Estimate #10450.pdf" /></label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">Photo archive name<input name="source_photo_archive_name" className={field} placeholder="job-10450-accident-damage-photos.zip" /></label>
          </div>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">Approved line structure<textarea name="training_lines" rows={10} className={field} placeholder={"One line per operation using:\ncategory | side | operation | description\n\nrr | REAR | R&R | Rear bumper complete assembly\npaint | RH | PAINT | R/rear quarter\npaint | RH | BLEND | R/rear door\nparts | REAR | REPLACE | Rear bumper"} /></label>
          <p className="text-[11px] leading-5 text-[var(--muted)]">The estimator receives the approved line structure and lessons, but not historical dollar amounts. Current workshop rates and supplier pricing remain authoritative.</p>
          <button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Approve & teach estimator</button>
        </form>

        <div className="space-y-3">
          {trainingCases.map((trainingCase) => {
            const tags = Array.isArray(trainingCase.damage_tags) ? trainingCase.damage_tags : [];
            const vehicle = [trainingCase.vehicle_year, trainingCase.vehicle_make, trainingCase.vehicle_model, trainingCase.vehicle_variant].filter(Boolean).join(" ") || "Vehicle not specified";
            return <article key={trainingCase.id} className="rounded-2xl border border-[var(--border)] bg-[#091322] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{trainingCase.title}</h3><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${trainingCase.status === "approved" ? "bg-[rgba(88,211,178,0.1)] text-[var(--brand)]" : "bg-white/5 text-[var(--muted)]"}`}>{trainingCase.status}</span></div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{vehicle} · {trainingCase.photo_count} source photo{trainingCase.photo_count === 1 ? "" : "s"} · {lineCounts.get(trainingCase.id) ?? 0} structured lines</p>
                  {trainingCase.repair_area ? <p className="mt-2 text-xs font-medium text-white/85">{trainingCase.repair_area}</p> : null}
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{trainingCase.damage_summary}</p>
                  {trainingCase.estimator_lessons ? <div className="mt-3 rounded-xl border border-[var(--border)] bg-[#07111f] p-3"><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">Estimator lesson</div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{trainingCase.estimator_lessons}</p></div> : null}
                  {tags.length ? <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((tag) => <span key={String(tag)} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] text-[var(--muted)]">{String(tag)}</span>)}</div> : null}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--muted)]"><span>Source: {trainingCase.source_reference || "—"}</span><span>Estimate: {trainingCase.source_document_name || "—"}</span><span>Photos: {trainingCase.source_photo_archive_name || "—"}</span><span>Knowledge: {trainingCase.knowledge_source_id ? "linked" : "not linked"}</span></div>
                </div>
                {trainingCase.status !== "retired" ? <form action={retireTrainingCase}><input type="hidden" name="training_case_id" value={trainingCase.id} /><button className="text-xs font-semibold text-[var(--muted)] hover:text-white">Retire</button></form> : null}
              </div>
            </article>;
          })}
          {!trainingCases.length ? <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">No Training Cases yet. Add a human-approved estimate example to start project memory.</div> : null}
        </div>
      </div>
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
