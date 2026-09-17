import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { signUp } from "@/lib/auth/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5 py-10 text-slate-950">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-10">
        <div className="mb-8 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-white"><Building2 className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#178f75]">Workshop owner</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Create your account</h1><p className="mt-2 text-sm leading-6 text-slate-500">After sign-up you can create the secure workshop workspace and become its owner.</p></div></div>

        {error ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <form action={signUp} className="space-y-5">
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">Full name</span><input name="full_name" required autoComplete="name" className="app-input" /></label>
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">Email address</span><input name="email" type="email" required autoComplete="email" className="app-input" /></label>
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">Password</span><input name="password" type="password" required minLength={10} autoComplete="new-password" className="app-input" /><span className="text-[11px] text-slate-500">Use at least 10 characters and avoid reusing a password from another service.</span></label>
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">Confirm password</span><input name="confirm_password" type="password" required minLength={10} autoComplete="new-password" className="app-input" /></label>
          <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-strong)]">Create account</button>
        </form>

        <div className="mt-6 flex items-start gap-2 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#178f75]" /> Workshop records are isolated by organization after onboarding.</div>
        <p className="mt-5 text-center text-xs text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-[#178f75]">Sign in</Link></p>
      </div>
    </main>
  );
}
