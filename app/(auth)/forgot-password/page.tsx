import Link from "next/link";
import { ArrowLeft, CarFront, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth/actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5 py-10 text-slate-950">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[620px] flex-col justify-between border-r border-slate-200 bg-slate-50 p-10 lg:flex">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-white"><CarFront className="size-5" /></span><div><strong className="block">RepairQuote AI</strong><span className="text-xs text-slate-500">Automotive estimating workspace</span></div></div>
          <div><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-[#178f75]"><KeyRound className="size-3.5" /> Secure account recovery</div><h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">Reset access without exposing your account.</h1><p className="mt-5 max-w-lg text-sm leading-7 text-slate-500">Enter your account email and we&apos;ll send a secure recovery link if an account exists for that address.</p></div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-[#178f75]" /> Recovery links are time-limited and verified before a password can be changed.</div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white"><CarFront className="size-5" /></span><strong>RepairQuote AI</strong></div></div>
          <Link href="/login" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#178f75]"><ArrowLeft className="size-3.5" /> Back to sign in</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#178f75]">Account recovery</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Forgot password?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Enter the email address you use for your workshop account.</p>

          {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

          <form action={requestPasswordReset} className="mt-8 space-y-5">
            <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">Email address</span><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input name="email" type="email" autoComplete="email" required className="app-input pl-10" placeholder="you@workshop.co.nz" /></div></label>
            <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-strong)]">Send reset link</button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-slate-500">For privacy, we&apos;ll show the same confirmation whether or not that email is registered.</p>
        </section>
      </div>
    </main>
  );
}
