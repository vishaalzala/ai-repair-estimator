import Link from "next/link";
import { LogIn } from "lucide-react";
import { invitationSignIn } from "../actions";

export default async function InvitationLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const signInAction = invitationSignIn.bind(null, token);

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-2xl shadow-black/20 sm:p-9">
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--brand)] text-[#06110e]"><LogIn className="size-5" /></span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Sign in for invitation</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use the exact email address that received the workshop invitation.</p>
        {query.error ? <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
        <form action={signInAction} className="mt-7 space-y-4"><label className="grid gap-2 text-sm"><span className="text-xs text-[var(--muted)]">Email</span><input name="email" type="email" required autoComplete="email" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none focus:border-[var(--brand)]" /></label><label className="grid gap-2 text-sm"><span className="text-xs text-[var(--muted)]">Password</span><input name="password" type="password" required autoComplete="current-password" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none focus:border-[var(--brand)]" /></label><button className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e]">Sign in and continue</button></form>
        <p className="mt-6 text-center text-xs text-[var(--muted)]">No account yet? <Link href="/signup" className="font-semibold text-[var(--brand)]">Create one</Link>, confirm the email, then open the invitation link again.</p>
      </div>
    </main>
  );
}
