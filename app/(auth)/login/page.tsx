import Link from "next/link";
import { CarFront, ShieldCheck, Sparkles } from "lucide-react";
import { signIn } from "@/lib/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5 py-10 text-slate-950">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[620px] flex-col justify-between border-r border-slate-200 bg-slate-50 p-10 lg:flex">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-white"><CarFront className="size-5" /></span><div><strong className="block">RepairQuote AI</strong><span className="text-xs text-slate-500">Automotive estimating workspace</span></div></div>
          <div><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-[#178f75]"><Sparkles className="size-3.5" /> AI-assisted, estimator controlled</div><h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">Build more complete, defensible repair estimates.</h1><p className="mt-5 max-w-lg text-sm leading-7 text-slate-500">Review visible damage, apply workshop rules, identify potential omissions and keep every final decision with the estimator.</p></div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-[#178f75]" /> Tenant-isolated workshop data with audit-ready history.</div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white"><CarFront className="size-5" /></span><strong>RepairQuote AI</strong></div></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#178f75]">Secure access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">Use your workshop account to continue.</p>

          {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

          <form action={signIn} className="mt-8 space-y-5">
            <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">Email address</span><input name="email" type="email" autoComplete="email" required className="app-input" placeholder="you@workshop.co.nz" /></label>
            <label className="grid gap-2 text-sm"><span className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-slate-600">Password</span><Link href="/forgot-password" className="text-xs font-semibold text-[#178f75] hover:text-[#126f5d]">Forgot password?</Link></span><input name="password" type="password" autoComplete="current-password" required className="app-input" /></label>
            <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-strong)]">Sign in</button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">Setting up a new workshop? <Link href="/signup" className="font-semibold text-[#178f75]">Create an owner account</Link></p>
        </section>
      </div>
    </main>
  );
}
