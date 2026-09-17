import { redirect } from "next/navigation";
import { ShieldCheck, Sparkles } from "lucide-react";
import { getPlatformAdminIfSignedIn } from "@/lib/admin/context";
import { adminSignIn } from "./actions";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const existing = await getPlatformAdminIfSignedIn();
  if (existing) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5 py-10 text-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <div className="mb-7 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-white"><ShieldCheck className="size-5" /></span><div><strong className="block">RepairQuote AI</strong><span className="text-xs text-slate-500">Platform administration</span></div></div>
        <div className="mb-7"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#178f75]"><Sparkles className="size-3.5" /> Restricted access</div><h1 className="mt-2 text-3xl font-semibold">Super Admin</h1><p className="mt-2 text-sm leading-6 text-slate-500">Sign in with an authorised platform administrator account. Workshop roles do not grant access here.</p></div>
        {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <form action={adminSignIn} className="space-y-4">
          <label className="grid gap-2 text-xs text-slate-600">Email<input name="email" type="email" required autoComplete="email" className="app-input text-sm" /></label>
          <label className="grid gap-2 text-xs text-slate-600">Password<input name="password" type="password" required autoComplete="current-password" className="app-input text-sm" /></label>
          <button className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-strong)]">Sign in to Super Admin</button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">Separate from workshop login · all admin activity is auditable</p>
      </div>
    </main>
  );
}
