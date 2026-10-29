import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { MessageComposer, MessageHistory } from "@/components/communications/message-ui";

export default async function JobMessagesPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ channel?: string; message?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, organizationId } = await requireOrganizationContext();
  const { data: job } = await supabase.from("jobs").select("id,job_number,customer_id,vehicle_id")
    .eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!job) notFound();

  const [customerResult, vehicleResult, messagesResult] = await Promise.all([
    job.customer_id ? supabase.from("customers").select("id,first_name,last_name,business_name,email,phone").eq("organization_id", organizationId).eq("id", job.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    job.vehicle_id ? supabase.from("vehicles").select("make,model,registration").eq("organization_id", organizationId).eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("workshop_messages").select("id,channel,recipient,subject,body,status,provider_error,created_at,sent_at")
      .eq("organization_id", organizationId).eq("job_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  const customer = customerResult.data;
  const vehicle = vehicleResult.data;
  const customerName = customer?.business_name || [customer?.first_name,customer?.last_name].filter(Boolean).join(" ") || "Customer pending";
  return (
    <div className="mx-auto max-w-[1300px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <Link href={`/jobs/${job.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white"><ArrowLeft className="size-4" /> Back to {job.job_number}</Link>
      <header className="mb-6"><div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--brand)]"><MessageSquare className="size-4" /> Job communications</div>
        <h1 className="mt-2 text-3xl font-semibold">Messages</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{[vehicle?.make,vehicle?.model,vehicle?.registration].filter(Boolean).join(" ") || "Vehicle pending"} · {customerName}</p>
      </header>
      {query.message ? <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{query.message}</p> : null}
      {query.error ? <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{query.error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[390px_1fr]">
        <MessageComposer requestKey={randomUUID()} jobId={job.id} customerId={customer?.id} email={customer?.email} phone={customer?.phone} defaultChannel={query.channel === "email" ? "email" : "sms"} />
        <MessageHistory messages={messagesResult.data ?? []} />
      </div>
    </div>
  );
}
