import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkshop } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membership) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 sm:p-10">
        <div className="mb-8 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-[#06110e]"><Building2 className="size-5" /></span>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Workshop setup</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Create your workspace</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">This becomes the secure tenant for your workshop, users, jobs, estimates, photos, rules and AI knowledge.</p></div>
        </div>

        {error ? <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <form action={createWorkshop} className="space-y-5">
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">Workshop / company name</span><div className="relative"><Building2 className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[var(--muted)]" /><input name="name" required minLength={2} className="w-full rounded-xl border border-[var(--border)] bg-[#091322] py-3 pl-10 pr-3.5 outline-none transition focus:border-[var(--brand)]" placeholder="Example Collision Repairs Ltd" /></div></label>
          <label className="grid gap-2 text-sm"><span className="text-xs font-medium text-[var(--muted)]">City</span><div className="relative"><MapPin className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[var(--muted)]" /><input name="city" className="w-full rounded-xl border border-[var(--border)] bg-[#091322] py-3 pl-10 pr-3.5 outline-none transition focus:border-[var(--brand)]" placeholder="Auckland" /></div></label>
          <button type="submit" className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]">Create workshop workspace</button>
        </form>

        <div className="mt-7 flex items-start gap-2 border-t border-[var(--border)] pt-5 text-xs leading-5 text-[var(--muted)]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" /> Data is isolated by organization using Supabase Row Level Security. Workshop knowledge is never shared with another tenant.</div>
      </div>
    </main>
  );
}
