"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const allowed = new Set(["pdf","docx","txt","md"]);
function safe(name:string){return name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120);}

export function AdminKnowledgeUploader({ storageOrganizationId, userId }: { storageOrganizationId: string; userId: string }) {
  const router = useRouter();
  const supabase = useMemo(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!),[]);
  const [busy,setBusy]=useState(false); const [status,setStatus]=useState<string|null>(null);
  async function upload(formData:FormData){
    const file=formData.get("file"); if(!(file instanceof File))return;
    const ext=file.name.split(".").pop()?.toLowerCase()??""; if(!allowed.has(ext)){setStatus("Use PDF, DOCX, TXT or Markdown.");return;} if(file.size>20*1024*1024){setStatus("Keep each training document at 20 MB or less.");return;}
    setBusy(true); setStatus("Creating global AI knowledge source…");
    const title=String(formData.get("title")??"").trim()||file.name.replace(/\.[^.]+$/,"");
    const {data:source,error:sourceError}=await supabase.from("knowledge_sources").insert({organization_id:null,user_id:null,scope:"global",source_type:"document",title,status:"processing",created_by:userId}).select("id").single();
    if(sourceError||!source){setBusy(false);setStatus("Unable to create global knowledge source.");return;}
    const path=`admin-global/${source.id}/${crypto.randomUUID()}-${safe(file.name)}`;
    const {error:uploadError}=await supabase.storage.from("knowledge-documents").upload(path,file,{contentType:file.type||undefined,upsert:false});
    if(uploadError){await supabase.from("knowledge_sources").update({status:"failed"}).eq("id",source.id);setBusy(false);setStatus("Upload failed.");return;}
    const {data:document,error:docError}=await supabase.from("knowledge_documents").insert({organization_id:storageOrganizationId,source_id:source.id,file_name:file.name,mime_type:file.type||"application/octet-stream",storage_path:path,processing_status:"pending",created_by:userId}).select("id").single();
    if(docError||!document){setBusy(false);setStatus("Document was uploaded but could not be registered.");return;}
    setStatus("Extracting estimating knowledge…");
    const response=await fetch("/api/knowledge/ingest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({documentId:document.id})});
    const result=await response.json().catch(()=>({})) as {message?:string}; setStatus(result.message??(response.ok?"Knowledge ready.":"Knowledge stored; processing is pending.")); setBusy(false); router.refresh();
  }
  return <form action={upload} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-start gap-3"><FileUp className="mt-0.5 size-5 text-[var(--brand)]"/><div><h2 className="font-semibold">Upload training document</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Upload approved estimates, estimating guides or checklists. Extracted knowledge is global and reviewed by platform administration.</p></div></div><input name="title" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm" placeholder="Training document title (optional)"/><input name="file" type="file" required accept=".pdf,.docx,.txt,.md" className="text-xs text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-3)] file:px-3 file:py-2 file:text-white"/><button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e] disabled:opacity-50">{busy?<Loader2 className="size-4 animate-spin"/>:<FileUp className="size-4"/>} Upload & teach AI</button>{status?<p className="text-xs text-[var(--muted)]">{status}</p>:null}</form>;
}
