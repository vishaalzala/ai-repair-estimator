import { CarFront, ShieldCheck, Sparkles } from "lucide-react";
import { signIn } from "@/lib/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/20 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden min-h-[620px] flex-col justify-between bg-gradient-to-br from-[#102b35] via-[#0d1d2c] to-[#091322] p-10 lg:flex">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-[#06110e]"><CarFront className="size-5" /></span>
            <div><strong className="block">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Automotive estimating workspace</span></div>
          </div>
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-black/10 px-3 py-1.5 text-xs text-[var(--brand)]"><Sparkles className="size-3.5" /> AI-assisted, estimator controlled</div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">Build more complete, defensible repair estimates.</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">Review visible damage, apply workshop rules, identify potential omissions and keep every final decision with the estimator.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><ShieldCheck className="size-4 text-[var(--brand)]" /> Tenant-isolated workshop data with audit-ready history.</div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-[#06110e]"><CarFront className="size-5" /></span><strong>RepairQuote AI</strong></div></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Secure access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Use your workshop account to continue.</p>

          {error ? <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

          <form action={signIn} className="mt-8 space-y-5">
            <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">Email address</span><input name="email" type="email" autoComplete="email" required className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" placeholder="you@workshop.co.nz" /></label>
            <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">Password</span><input name="password" type="password" autoComplete="current-password" required className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" /></label>
            <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]">Sign in</button>
          </form>

          <p className="mt-6 text-xs leading-5 text-[var(--muted)]">Accounts are created by your workshop administrator during the pilot and onboarding stages.</p>
        </section>
      </div>
    </main>
  );
}
