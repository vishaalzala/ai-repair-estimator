import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkshop } from "./actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
  if (membership) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5 py-10 text-slate-950">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-10">
        <div className="mb-8 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-white"><Building2 className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#178f75]">Workshop setup</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Create your workspace</h1><p className="mt-2 text-sm leading-6 text-slate-500">This becomes the secure tenant for your workshop, users, jobs, estimates, photos, rules and estimating knowledge.</p></div></div>
        {error ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <form action={createWorkshop} className="space-y-5">
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">Workshop / company name</span><div className="relative"><Building2 className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" /><input name="name" required minLength={2} className="app-input pl-10" placeholder="Example Collision Repairs Ltd" /></div></label>
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-slate-600">City</span><div className="relative"><MapPin className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" /><input name="city" className="app-input pl-10" placeholder="Auckland" /></div></label>
          <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-strong)]">Create workshop workspace</button>
        </form>
        <div className="mt-7 flex items-start gap-2 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#178f75]" /> Data is isolated by organization. Workshop records and knowledge are never shared with another tenant.</div>
      </div>
    </main>
  );
}
