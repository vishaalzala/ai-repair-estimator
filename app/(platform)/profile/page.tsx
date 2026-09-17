import Link from "next/link";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

export default async function ProfilePage() {
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  const [{ data: userResult }, { data: organization }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
  ]);
  const user = userResult.user;
  const fullName = String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").trim() || "Workshop user";

  return <div className="mx-auto max-w-[900px] px-5 py-6 text-slate-950 sm:px-7 lg:px-9 lg:py-8">
    <header><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#178f75]"><UserRound className="size-4" /> Account</div><h1 className="text-3xl font-semibold">Profile & security</h1><p className="mt-2 text-sm text-slate-500">Your account identity and workshop access.</p></header>
    <div className="mt-6 grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e8f7f2] text-[#178f75]"><UserRound className="size-5" /></span><div><h2 className="font-semibold">Account details</h2><p className="text-xs text-slate-500">Signed-in identity</p></div></div><dl className="mt-5 space-y-4"><Row label="Name" value={fullName} /><Row label="Email" value={user?.email ?? "—"} /><Row label="Workshop" value={organization?.name ?? "—"} /><Row label="Role" value={role.replaceAll("_", " ")} /></dl></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e8f7f2] text-[#178f75]"><ShieldCheck className="size-5" /></span><div><h2 className="font-semibold">Security</h2><p className="text-xs text-slate-500">Protect workshop access</p></div></div><p className="mt-5 text-sm leading-6 text-slate-600">Password changes use the secure recovery flow so the account email is verified before credentials are replaced.</p><Link href="/forgot-password" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><KeyRound className="size-4" /> Change password</Link><div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">Account access is scoped to your workshop organization and role.</div></section>
    </div>
  </div>;
}

function Row({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1.5 text-sm font-medium capitalize text-slate-800">{value}</dd></div>; }
