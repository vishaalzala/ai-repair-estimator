import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireOrganizationContext } from "@/lib/auth/context";
import { MessageComposer, MessageHistory } from "@/components/communications/message-ui";

export default async function CommunicationsPage({ searchParams }: {
  searchParams: Promise<{ customerId?: string; channel?: string; message?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { supabase, organizationId } = await requireOrganizationContext();
  const customerId = query.customerId || null;
  const [{ data: selectedCustomer }, { data: messages }] = await Promise.all([
    customerId ? supabase.from("customers").select("id,first_name,last_name,business_name,email,phone").eq("organization_id", organizationId).eq("id", customerId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("workshop_messages").select("id,channel,recipient,subject,body,status,provider_error,created_at,sent_at")
      .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(150),
  ]);
  const name = selectedCustomer?.business_name || [selectedCustomer?.first_name,selectedCustomer?.last_name].filter(Boolean).join(" ") || "Customer";
  return (
    <div className="mx-auto max-w-[1450px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <h1 className="text-3xl font-semibold">Communications</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">SMS and email sent by your workshop; records belong only to your organization.</p>
      {query.message ? <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{query.message}</p> : null}
      {query.error ? <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{query.error}</p> : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-[390px_1fr]">
        {selectedCustomer ? (
          <div><p className="mb-3 text-sm">To <Link className="font-semibold text-[var(--brand)] hover:underline" href={`/customers/${selectedCustomer.id}`}>{name}</Link></p>
            <MessageComposer requestKey={randomUUID()} customerId={selectedCustomer.id} email={selectedCustomer.email} phone={selectedCustomer.phone} defaultChannel={query.channel === "email" ? "email" : "sms"} />
          </div>
        ) : <section className="self-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Send a message</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Open a customer profile or job and choose Send SMS or Send Email. This links the message to the correct customer/job and prevents sending against the wrong record.</p><Link href="/customers" className="mt-4 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[#06110e]">Choose customer</Link></section>}
        <MessageHistory messages={messages ?? []} />
      </div>
    </div>
  );
}
