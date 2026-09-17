import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CarFront, KeyRound, ShieldCheck } from "lucide-react";
import { updatePassword } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/forgot-password?error=This%20reset%20link%20is%20invalid%20or%20has%20expired.%20Please%20request%20a%20new%20one.");

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5 py-10 text-slate-950">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[620px] flex-col justify-between border-r border-slate-200 bg-slate-50 p-10 lg:flex">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-white"><CarFront className="size-5" /></span><div><strong className="block">RepairQuote AI</strong><span className="text-xs text-slate-500">Automotive estimating workspace</span></div></div>
          <div><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-[#178f75]"><KeyRound className="size-3.5" /> Verified recovery session</div><h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">Choose a new password for your account.</h1><p className="mt-5 max-w-lg text-sm leading-7 text-slate-500">Your recovery link has been verified. Set a strong new password to finish restoring access.</p></div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-[#178f75]" /> After the password is changed you&apos;ll sign in again with the new password.</div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white"><CarFront className="size-5" /></span><strong>RepairQuote AI</strong></div></div>
          <Link href="/login" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#178f75]"><ArrowLeft className="size-3.5" /> Back to sign in</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#178f75]">Password recovery</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Set new password</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Use at least 10 characters. Avoid reusing a password from another service.</p>
          {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <form action={updatePassword} className="mt-8 space-y-5">
            <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">New password</span><input name="password" type="password" autoComplete="new-password" minLength={10} required className="app-input" /></label>
            <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">Confirm new password</span><input name="confirm_password" type="password" autoComplete="new-password" minLength={10} required className="app-input" /></label>
            <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-strong)]">Update password</button>
          </form>
        </section>
      </div>
    </main>
  );
}
