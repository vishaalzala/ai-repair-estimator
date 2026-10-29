import { sendWorkshopMessage, messagingAvailability } from "@/lib/communications/actions";

type MessageRow = {
  id: string; channel: string; recipient: string; subject: string | null; body: string;
  status: string; provider_error: string | null; created_at: string; sent_at: string | null;
};

export function MessageComposer({
  requestKey, jobId, customerId, email, phone, defaultChannel = "sms",
}: {
  requestKey: string; jobId?: string | null; customerId?: string | null;
  email?: string | null; phone?: string | null; defaultChannel?: "sms" | "email";
}) {
  const available = messagingAvailability();
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-semibold">Send a message</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
        SMS and email are sent only through configured providers. A provider accepting a message does not guarantee delivery.
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className={"rounded-full px-2.5 py-1 " + (available.sms ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300")}>SMS: {available.sms ? "Configured" : "Not configured"}</span>
        <span className={"rounded-full px-2.5 py-1 " + (available.email ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300")}>Email: {available.email ? "Configured" : "Not configured"}</span>
      </div>
      <form action={sendWorkshopMessage} className="mt-5 grid gap-3">
        <input type="hidden" name="job_id" value={jobId ?? ""} />
        <input type="hidden" name="customer_id" value={customerId ?? ""} />
        <input type="hidden" name="request_key" value={requestKey} />
        <label className="grid gap-1 text-xs text-[var(--muted)]">Method
          <select name="channel" defaultValue={defaultChannel} className="app-input">
            <option value="sms">SMS</option><option value="email">Email</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-[var(--muted)]">Recipient (phone for SMS, email for Email)
          <input name="recipient" defaultValue={defaultChannel === "email" ? email ?? "" : phone ?? ""} required maxLength={254} placeholder={defaultChannel === "email" ? "customer@example.com" : "021 123 4567"} className="app-input" />
          <span className="text-[10px]">SMS: use 02… (NZ) or +country code. For Email, enter an email address.</span>
        </label>
        <label className="grid gap-1 text-xs text-[var(--muted)]">Email subject (required only for Email)
          <input name="subject" maxLength={180} defaultValue={jobId ? "Update on your vehicle repair" : ""} placeholder="Job update" className="app-input" />
        </label>
        <label className="grid gap-1 text-xs text-[var(--muted)]">Message
          <textarea name="body" required rows={6} maxLength={5000} className="app-input" placeholder="Write your message…" />
        </label>
        <button type="submit" className="w-fit rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[#06110e]">Send message</button>
      </form>
    </section>
  );
}

export function MessageHistory({ messages }: { messages: MessageRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="font-semibold">Message history</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Provider acceptance and failures are logged. Delivery confirmation is not yet tracked.</p>
      </div>
      {!messages.length ? (
        <p className="p-7 text-sm text-[var(--muted)]">No messages sent yet.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {messages.map((message) => (
            <article key={message.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-lg bg-[var(--surface-3)] px-2 py-1 uppercase">{message.channel}</span>
                <strong className={message.status === "failed" ? "text-red-300" : message.status === "sent" ? "text-emerald-300" : "text-amber-300"}>{message.status === "sent" ? "Accepted by provider" : message.status}</strong>
                <span className="text-[var(--muted)]">{new Intl.DateTimeFormat("en-NZ", { dateStyle:"medium", timeStyle:"short", timeZone:"Pacific/Auckland" }).format(new Date(message.created_at))}</span>
              </div>
              <p className="text-xs text-[var(--muted)]">To: {message.recipient}</p>
              {message.subject ? <p className="text-sm font-semibold">{message.subject}</p> : null}
              <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
              {message.provider_error ? <p className="text-xs text-red-300">Provider error: {message.provider_error}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
