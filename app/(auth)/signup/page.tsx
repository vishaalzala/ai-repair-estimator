import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { signUp } from "@/lib/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-2xl shadow-black/20 sm:p-10">
        <div className="mb-8 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-[#06110e]"><Building2 className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Workshop owner</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Create your account</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">After sign-up you can create the secure workshop workspace and become its owner.</p></div></div>

        {error ? <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <form action={signUp} className="space-y-5">
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">Full name</span><input name="full_name" required autoComplete="name" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" /></label>
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">Email address</span><input name="email" type="email" required autoComplete="email" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" /></label>
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">Password</span><input name="password" type="password" required minLength={10} autoComplete="new-password" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" /><span className="text-[11px] text-[var(--muted)]">Use at least 10 characters and avoid reusing a password from another service.</span></label>
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">Confirm password</span><input name="confirm_password" type="password" required minLength={10} autoComplete="new-password" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" /></label>
          <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]">Create account</button>
        </form>

        <div className="mt-6 flex items-start gap-2 border-t border-[var(--border)] pt-5 text-xs leading-5 text-[var(--muted)]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" /> Workshop records are isolated by organization after onboarding.</div>
        <p className="mt-5 text-center text-xs text-[var(--muted)]">Already have an account? <Link href="/login" className="font-semibold text-[var(--brand)]">Sign in</Link></p>
      </div>
    </main>
  );
}
