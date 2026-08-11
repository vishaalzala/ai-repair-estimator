import Link from "next/link";
import { MailCheck, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation } from "./actions";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const acceptAction = acceptInvitation.bind(null, token);

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-2xl shadow-black/20 sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-[var(--brand)] text-[#06110e]"><MailCheck className="size-5" /></span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Workshop invitation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Join the workshop</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">The invitation is tied to a specific email address. Sign in with that account, then accept to create your organization membership.</p>
        {query.error ? <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
        {auth.user ? <form action={acceptAction} className="mt-7"><div className="mb-4 rounded-xl border border-[var(--border)] bg-[#091322] p-4 text-sm"><span className="text-[var(--muted)]">Signed in as</span><strong className="ml-2">{auth.user.email}</strong></div><button className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e]">Accept workshop invitation</button></form> : <div className="mt-7 grid gap-3"><Link href={`/auth/invite/${encodeURIComponent(token)}/login`} className="rounded-xl bg-[var(--brand)] px-4 py-3 text-center text-sm font-semibold text-[#06110e]">Sign in to accept</Link><Link href="/signup" className="rounded-xl border border-[var(--border)] px-4 py-3 text-center text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-white">Create an account first</Link></div>}
        <div className="mt-6 flex items-start gap-2 border-t border-[var(--border)] pt-5 text-xs leading-5 text-[var(--muted)]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" /> The server stores only a hash of the invitation token; the raw token exists only in the invitation link.</div>
      </div>
    </main>
  );
}
