import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, LockKeyhole, MessageSquareText, Trash2 } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { addJobNote, deleteJobNote } from "./actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";

function label(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default async function NotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  const { data: job } = await supabase.from("jobs").select("id, job_number, vehicle_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!job) notFound();

  const [vehicleResult, notesResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("job_notes").select("id, note_type, visibility, content, created_by, created_at, updated_at").eq("organization_id", organizationId).eq("job_id", job.id).order("created_at", { ascending: false }),
  ]);
  const vehicle = vehicleResult.data;
  const notes = notesResult.data ?? [];
  const addAction = addJobNote.bind(null, job.id);
  const deleteAction = deleteJobNote.bind(null, job.id);
  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><MessageSquareText className="size-4" /> Controlled job notes</div><h1 className="text-3xl font-semibold tracking-tight">Notes</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"} · Each note has an explicit output destination.</p></header>
      {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 xl:sticky xl:top-6 xl:self-start"><h2 className="font-semibold">Add note</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Internal notes never appear on insurer/customer output unless their visibility is deliberately changed.</p><form action={addAction} className="mt-5 grid gap-3"><select name="note_type" defaultValue="general" className={inputClass}><option value="repair">Repair note</option><option value="general">General estimate note</option><option value="insurer">Insurer note</option><option value="technician">Technician note</option><option value="parts">Parts note</option><option value="supplement">Supplement note</option><option value="internal">Internal note</option><option value="ai">AI review note</option></select><select name="visibility" defaultValue="internal" className={inputClass}><option value="internal">Internal only</option><option value="insurer_pdf">Insurance estimate PDF</option><option value="technician_sheet">Technician job sheet</option><option value="customer_output">Customer output</option></select><textarea name="content" required rows={7} className={inputClass} placeholder="Write the note…" /><button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Save note</button></form></section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Job notes</h2><p className="mt-1 text-xs text-[var(--muted)]">Newest first</p></div><span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-xs text-[var(--muted)]">{notes.length}</span></div>{notes.length === 0 ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[#091322] px-6 text-center"><div><FileText className="mx-auto size-8 text-[var(--muted)]" /><p className="mt-3 font-medium">No notes yet</p><p className="mt-2 text-sm text-[var(--muted)]">Add repair, insurer, technician or internal notes as the assessment develops.</p></div></div> : <div className="space-y-3">{notes.map((note) => { const canDelete = note.created_by === userId || ["owner", "admin", "manager"].includes(role); return <article key={note.id} className="rounded-xl border border-[var(--border)] bg-[#091322] p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-white">{label(note.note_type)}</span><span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{note.visibility === "internal" ? <LockKeyhole className="size-3" /> : null}{label(note.visibility)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{note.content}</p><p className="mt-3 text-[10px] text-[var(--muted)]">{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.created_at))}</p></div>{canDelete ? <form action={deleteAction}><input type="hidden" name="note_id" value={note.id} /><button aria-label="Delete note" className="rounded-lg p-2 text-[var(--muted)] hover:bg-red-400/10 hover:text-red-200"><Trash2 className="size-4" /></button></form> : null}</div></article>; })}</div>}</section>
      </div>
    </div>
  );
}
