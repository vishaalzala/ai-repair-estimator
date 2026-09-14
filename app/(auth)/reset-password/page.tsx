import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CarFront, KeyRound, ShieldCheck } from "lucide-react";
import { updatePassword } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/forgot-password?error=This%20reset%20link%20is%20invalid%20or%20has%20expired.%20Please%20request%20a%20new%20one.");
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/20 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden min-h-[620px] flex-col justify-between bg-gradient-to-br from-[#102b35] via-[#0d1d2c] to-[#091322] p-10 lg:flex">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-[#06110e]"><CarFront className="size-5" /></span>
            <div><strong className="block">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Automotive estimating workspace</span></div>
          </div>
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-black/10 px-3 py-1.5 text-xs text-[var(--brand)]"><KeyRound className="size-3.5" /> Verified recovery session</div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">Choose a new password for your account.</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">Your recovery link has been verified. Set a strong new password to finish restoring access.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><ShieldCheck className="size-4 text-[var(--brand)]" /> After the password is changed you&apos;ll sign in again with the new password.</div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-[#06110e]"><CarFront className="size-5" /></span><strong>RepairQuote AI</strong></div></div>

          <Link href="/login" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--brand)]"><ArrowLeft className="size-3.5" /> Back to sign in</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Password recovery</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Set new password</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use at least 10 characters. Avoid reusing a password from another service.</p>

          {error ? <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

          <form action={updatePassword} className="mt-8 space-y-5">
            <label className="grid gap-2 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">New password</span>
              <input name="password" type="password" autoComplete="new-password" minLength={10} required className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">Confirm new password</span>
              <input name="confirm_password" type="password" autoComplete="new-password" minLength={10} required className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 outline-none transition focus:border-[var(--brand)]" />
            </label>
            <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]">Update password</button>
          </form>
        </section>
      </div>
    </main>
  );
}
