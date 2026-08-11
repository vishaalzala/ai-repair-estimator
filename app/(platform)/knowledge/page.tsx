import { BookOpen, Brain, FileText, Globe2, LockKeyhole, Sparkles, Users } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { KnowledgeDocumentUploader } from "@/components/knowledge/document-uploader";
import { retireKnowledge, teachAi } from "./actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";

function scopeIcon(scope: string) {
  if (scope === "global") return Globe2;
  if (scope === "organization") return Users;
  return LockKeyhole;
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const query = await searchParams;
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  const canPublishWorkshop = ["owner", "admin", "manager"].includes(role);

  const [sourceResult, documentResult, candidateResult] = await Promise.all([
    supabase.from("knowledge_sources").select("id, scope, source_type, title, content_text, status, created_by, created_at, updated_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("knowledge_documents").select("id, source_id, file_name, mime_type, version, processing_status, processing_error, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("learning_candidates").select("id, scope, title, pattern_summary, confidence, status, created_at").or(`organization_id.eq.${organizationId},scope.eq.global`).order("created_at", { ascending: false }).limit(30),
  ]);

  const sources = sourceResult.data ?? [];
  const documents = documentResult.data ?? [];
  const candidates = candidateResult.data ?? [];
  const documentsBySource = new Map(documents.map((document) => [document.source_id, document]));
  const myKnowledge = sources.filter((source) => source.scope === "user");
  const workshopKnowledge = sources.filter((source) => source.scope === "organization");
  const globalKnowledge = sources.filter((source) => source.scope === "global");
  const configured = Boolean(process.env.OPENAI_API_KEY && process.env.AI_DOCUMENT_MODEL && process.env.AI_EMBEDDING_MODEL);

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Brain className="size-4" /> Controlled AI memory</div><h1 className="text-3xl font-semibold tracking-tight">AI Knowledge Center</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Teach the assistant without retraining the base model. User knowledge stays private to you, workshop knowledge stays inside this organization, and only platform administration can publish global knowledge.</p></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}
      {!configured ? <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">Manual knowledge works now. Document AI extraction and embeddings will remain pending until the secure OpenAI document + embedding configuration is added to the deployment.</div> : null}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Sparkles className="size-4" /></span><div><h2 className="font-semibold">Teach AI</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Store a workshop estimating preference, checklist reminder or procedure note. This creates retrievable context, not an automatic charge.</p></div></div><form action={teachAi} className="grid gap-3"><input name="title" required className={inputClass} placeholder="Knowledge title *" /><textarea name="content" required rows={6} className={inputClass} placeholder="Example: When replacing a door shell, remind me to review transfer of glass, regulator, wiring, locks, handles, trim and seals, plus trial fit and alignment." /><select name="scope" defaultValue="user" className={inputClass}><option value="user">Only me</option>{canPublishWorkshop ? <option value="organization">My workshop</option> : null}</select><button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Save knowledge</button></form></section>
          <KnowledgeDocumentUploader organizationId={organizationId} userId={userId} canPublishWorkshop={canPublishWorkshop} />
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-start gap-3"><BookOpen className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" /><div><h2 className="font-semibold">Knowledge vs rules</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]"><strong className="text-white">Knowledge</strong> is context the AI should consider. <strong className="text-white">Rules</strong> are deterministic checks with enforcement levels. Pricing remains a third, separate deterministic system.</p></div></div></section>
        </div>

        <div className="space-y-5">
          <KnowledgeGroup title="My knowledge" subtitle="Visible only to your user account" sources={myKnowledge} documentsBySource={documentsBySource} canRetire currentUserId={userId} />
          <KnowledgeGroup title="Workshop knowledge" subtitle="Available to members of this workshop only" sources={workshopKnowledge} documentsBySource={documentsBySource} canRetire={canPublishWorkshop} currentUserId={userId} />
          <KnowledgeGroup title="Global knowledge" subtitle="Platform-admin curated; read-only to workshops" sources={globalKnowledge} documentsBySource={documentsBySource} canRetire={false} currentUserId={userId} />
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Learning candidates</h2><p className="mt-1 text-xs text-[var(--muted)]">Repeated estimator behaviour can become a review candidate; it never becomes global automatically.</p></div><span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-xs text-[var(--muted)]">{candidates.length}</span></div>{candidates.length ? <div className="space-y-3">{candidates.map((candidate) => <article key={candidate.id} className="rounded-xl border border-[var(--border)] bg-[#091322] p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{candidate.title}</p><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{candidate.scope}</span><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{candidate.status}</span></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{candidate.pattern_summary}</p></article>)}</div> : <p className="text-sm text-[var(--muted)]">No repeated learning patterns have been promoted to candidates yet.</p>}</section>
        </div>
      </div>
    </div>
  );
}

function KnowledgeGroup({
  title,
  subtitle,
  sources,
  documentsBySource,
  canRetire,
  currentUserId,
}: {
  title: string;
  subtitle: string;
  sources: Array<{ id: string; scope: string; source_type: string; title: string; content_text: string | null; status: string; created_by: string | null; created_at: string }>;
  documentsBySource: Map<string, { id: string; file_name: string; processing_status: string; processing_error: string | null }>;
  canRetire: boolean;
  currentUserId: string;
}) {
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p></div><span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-xs text-[var(--muted)]">{sources.length}</span></div>{sources.length ? <div className="space-y-3">{sources.map((source) => { const Icon = scopeIcon(source.scope); const document = documentsBySource.get(source.id); const ownerCanRetire = source.scope !== "user" || source.created_by === currentUserId; return <article key={source.id} className="rounded-xl border border-[var(--border)] bg-[#091322] p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Icon className="size-3.5 text-[var(--brand)]" /><p className="text-sm font-semibold">{source.title}</p><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] uppercase tracking-wide text-[var(--muted)]">{source.source_type}</span><span className={`rounded-full px-2 py-0.5 text-[9px] ${source.status === "active" ? "bg-[rgba(88,211,178,0.08)] text-[var(--brand)]" : source.status === "failed" ? "bg-red-400/10 text-red-200" : "bg-amber-300/10 text-amber-100"}`}>{source.status}</span></div>{source.content_text ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--muted)]">{source.content_text}</p> : null}{document ? <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--muted)]"><FileText className="size-3" /><span className="truncate">{document.file_name}</span><span>· {document.processing_status}</span></div> : null}</div>{canRetire && ownerCanRetire && source.status !== "retired" ? <form action={retireKnowledge}><input type="hidden" name="source_id" value={source.id} /><button className="text-[10px] font-semibold text-[var(--muted)] hover:text-white">Retire</button></form> : null}</div></article>; })}</div> : <p className="text-sm text-[var(--muted)]">No active items in this scope yet.</p>}</section>;
}
