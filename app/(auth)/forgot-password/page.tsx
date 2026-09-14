import Link from "next/link";
import { ArrowLeft, CarFront, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/20 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden min-h-[620px] flex-col justify-between bg-gradient-to-br from-[#102b35] via-[#0d1d2c] to-[#091322] p-10 lg:flex">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-[#06110e]"><CarFront className="size-5" /></span>
            <div><strong className="block">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Automotive estimating workspace</span></div>
          </div>
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-black/10 px-3 py-1.5 text-xs text-[var(--brand)]"><KeyRound className="size-3.5" /> Secure account recovery</div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">Reset access without exposing your account.</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">Enter your account email and we&apos;ll send a secure recovery link if an account exists for that address.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><ShieldCheck className="size-4 text-[var(--brand)]" /> Recovery links are time-limited and verified before a password can be changed.</div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-[#06110e]"><CarFront className="size-5" /></span><strong>RepairQuote AI</strong></div></div>

          <Link href="/login" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--brand)]"><ArrowLeft className="size-3.5" /> Back to sign in</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Account recovery</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Forgot password?</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Enter the email address you use for your workshop account.</p>

          {error ? <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          {message ? <div className="mt-6 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{message}</div> : null}

          <form action={requestPasswordReset} className="mt-8 space-y-5">
            <label className="grid gap-2 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">Email address</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <input name="email" type="email" autoComplete="email" required className="w-full rounded-xl border border-[var(--border)] bg-[#091322] py-3 pl-10 pr-3.5 outline-none transition focus:border-[var(--brand)]" placeholder="you@workshop.co.nz" />
              </div>
            </label>
            <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]">Send reset link</button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-[var(--muted)]">For privacy, we&apos;ll show the same confirmation whether or not that email is registered.</p>
        </section>
      </div>
    </main>
  );
}
