import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, FileImage, ShieldCheck } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { PhotoUploader } from "@/components/photos/photo-uploader";

const categoryLabels: Record<string, string> = {
  identification: "Identification",
  accident_damage: "Accident damage",
  pre_existing: "Pre-existing damage",
  hidden_damage: "Hidden / strip findings",
  extra_damage: "Extra damage",
  strip_down: "Strip-down",
  progress: "Repair progress",
  parts: "Parts",
  completed: "Completed repair",
  document: "Document",
};

export default async function JobPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, userId } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!job) notFound();

  const [{ data: vehicle }, { data: photos = [] }] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, make, model, model_year").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("photos").select("id, category, file_name, mime_type, file_size_bytes, storage_path_original, caption, created_at").eq("job_id", job.id).order("category").order("created_at", { ascending: true }),
  ]);

  const signed = await Promise.all(
    photos.map(async (photo) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.mime_type)) return [photo.id, null] as const;
      const { data } = await supabase.storage.from("job-files").createSignedUrl(photo.storage_path_original, 60 * 15);
      return [photo.id, data?.signedUrl ?? null] as const;
    }),
  );
  const signedById = new Map(signed);

  const groups = Object.entries(categoryLabels).map(([category, label]) => ({
    category,
    label,
    items: photos.filter((photo) => photo.category === category),
  })).filter((group) => group.items.length > 0);

  const vehicleTitle = [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Camera className="size-4" /> Evidence capture</div><h1 className="text-3xl font-semibold tracking-tight">Vehicle photos</h1><p className="mt-2 text-sm text-[var(--muted)]">{vehicleTitle} · {vehicle?.registration || "Registration pending"}</p></div><div className="flex items-center gap-2 text-xs text-[var(--muted)]"><ShieldCheck className="size-4 text-[var(--brand)]" /> Private workshop storage</div></header>

      <PhotoUploader organizationId={organizationId} jobId={job.id} userId={userId} />

      <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="font-semibold">Evidence library</h2><p className="mt-1 text-xs text-[var(--muted)]">{photos.length} photo{photos.length === 1 ? "" : "s"} attached to this assessment.</p></div>{photos.length >= 6 ? <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-2.5 py-1 text-xs text-[var(--brand)]"><CheckCircle2 className="size-3.5" /> Evidence started</span> : null}</div>

        {groups.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[var(--border)] bg-[#091322] px-6 text-center"><div><FileImage className="mx-auto size-8 text-[var(--muted)]" /><p className="mt-4 font-medium">No photos uploaded yet</p><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Begin with vehicle identification and wide-angle accident photos, then add close-ups for each damaged area.</p></div></div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.category}>
                <div className="mb-3 flex items-center gap-2"><h3 className="text-sm font-semibold">{group.label}</h3><span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{group.items.length}</span></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {group.items.map((photo) => {
                    const signedUrl = signedById.get(photo.id);
                    const sizeMb = photo.file_size_bytes / 1024 / 1024;
                    return <article key={photo.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[#091322]">{signedUrl ? <div className="relative aspect-[4/3] bg-black/20"><Image src={signedUrl} alt={photo.caption || `${group.label} vehicle evidence`} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover" /></div> : <div className="grid aspect-[4/3] place-items-center bg-[var(--surface-2)]"><div className="text-center"><FileImage className="mx-auto size-7 text-[var(--muted)]" /><p className="mt-2 text-xs text-[var(--muted)]">Original format stored</p></div></div>}<div className="p-3"><p className="truncate text-xs font-medium" title={photo.file_name}>{photo.file_name}</p><div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-[var(--muted)]"><span>{sizeMb.toFixed(sizeMb >= 10 ? 0 : 1)} MB</span><span>{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(photo.created_at))}</span></div></div></article>;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--brand)]/25 bg-[rgba(88,211,178,0.06)] p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Next step: damage review</p><p className="mt-1 text-xs text-[var(--muted)]">AI analysis will only be enabled after the evidence checklist and model configuration are ready.</p></div><Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-[var(--brand)]">Return to overview</Link></div>
    </div>
  );
}
