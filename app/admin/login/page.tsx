import { redirect } from "next/navigation";
import { ShieldCheck, Sparkles } from "lucide-react";
import { getPlatformAdminIfSignedIn } from "@/lib/admin/context";
import { adminSignIn } from "./actions";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const existing = await getPlatformAdminIfSignedIn();
  if (existing) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#050b14] px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-2xl shadow-black/30 sm:p-9">
        <div className="mb-7 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-[#06110e]"><ShieldCheck className="size-5" /></span><div><strong className="block">RepairQuote AI</strong><span className="text-xs text-[var(--muted)]">Platform administration</span></div></div>
        <div className="mb-7"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]"><Sparkles className="size-3.5" /> Restricted access</div><h1 className="mt-2 text-3xl font-semibold">Super Admin</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Sign in with an authorised platform administrator account. Workshop roles do not grant access here.</p></div>
        {error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        <form action={adminSignIn} className="space-y-4">
          <label className="grid gap-2 text-xs text-[var(--muted)]">Email<input name="email" type="email" required autoComplete="email" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 text-sm text-white outline-none focus:border-[var(--brand)]" /></label>
          <label className="grid gap-2 text-xs text-[var(--muted)]">Password<input name="password" type="password" required autoComplete="current-password" className="rounded-xl border border-[var(--border)] bg-[#091322] px-3.5 py-3 text-sm text-white outline-none focus:border-[var(--brand)]" /></label>
          <button className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e]">Sign in to Super Admin</button>
        </form>
        <p className="mt-6 text-center text-xs text-[var(--muted)]">Separate from workshop login · all admin activity is auditable</p>
      </div>
    </main>
  );
}
