"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { FileUp, Loader2 } from "lucide-react";

const allowedExtensions = new Set(["pdf", "docx", "txt", "md"]);

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
}

export function KnowledgeDocumentUploader({
  organizationId,
  userId,
  canPublishWorkshop,
}: {
  organizationId: string;
  userId: string;
  canPublishWorkshop: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ), []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function upload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File)) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.has(extension)) {
      setStatus("Use PDF, DOCX, TXT or Markdown files.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus("For AI ingestion, keep each document at 20 MB or less.");
      return;
    }

    const requestedScope = String(formData.get("scope") ?? "user");
    const scope = requestedScope === "organization" && canPublishWorkshop ? "organization" : "user";
    const title = String(formData.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
    setBusy(true);
    setStatus("Creating private knowledge source…");

    const { data: source, error: sourceError } = await supabase.from("knowledge_sources").insert({
      organization_id: organizationId,
      user_id: scope === "user" ? userId : null,
      scope,
      source_type: "document",
      title,
      status: "processing",
      created_by: userId,
    }).select("id").single();
    if (sourceError || !source) {
      setBusy(false);
      setStatus("Unable to create the knowledge source.");
      return;
    }

    const storagePath = `${organizationId}/${source.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    setStatus("Uploading document privately…");
    const { error: uploadError } = await supabase.storage.from("knowledge-documents").upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
    if (uploadError) {
      await supabase.from("knowledge_sources").update({ status: "failed" }).eq("id", source.id);
      setBusy(false);
      setStatus("Document upload failed.");
      return;
    }

    const { data: document, error: documentError } = await supabase.from("knowledge_documents").insert({
      organization_id: organizationId,
      source_id: source.id,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      storage_path: storagePath,
      processing_status: "pending",
      created_by: userId,
    }).select("id").single();
    if (documentError || !document) {
      await supabase.storage.from("knowledge-documents").remove([storagePath]);
      await supabase.from("knowledge_sources").update({ status: "failed" }).eq("id", source.id);
      setBusy(false);
      setStatus("Unable to register the uploaded document.");
      return;
    }

    setStatus("Preparing AI knowledge…");
    const response = await fetch("/api/knowledge/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: document.id }),
    });
    const result = await response.json().catch(() => ({})) as { message?: string };
    setStatus(response.ok ? (result.message || "Document knowledge is ready.") : (result.message || "Document stored; AI ingestion is pending configuration."));
    setBusy(false);
    router.refresh();
  }

  return (
    <form action={upload} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[#091322] p-4">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><FileUp className="size-4" /></span><div><p className="text-sm font-semibold">Upload PDF / DOCX knowledge</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">The original stays private. Extracted sections and embeddings inherit the same user/workshop scope.</p></div></div>
      <input name="title" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none" placeholder="Knowledge title (optional)" />
      <select name="scope" defaultValue="user" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none"><option value="user">Only me</option>{canPublishWorkshop ? <option value="organization">My workshop</option> : null}</select>
      <input name="file" type="file" required accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="block w-full text-xs text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-3)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
      <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e] disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Upload & process</button>
      {status ? <p className="text-xs leading-5 text-[var(--muted)]">{status}</p> : null}
    </form>
  );
}
