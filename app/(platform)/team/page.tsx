import { Copy, MailPlus, ShieldCheck, UserRound, Users } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { createWorkshopInvitation, revokeWorkshopInvitation } from "./actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; invite?: string }>;
}) {
  const query = await searchParams;
  const { supabase, organizationId, role } = await requireOrganizationContext();
  const canManage = ["owner", "admin", "manager"].includes(role);

  const [memberResult, invitationResult] = await Promise.all([
    supabase.from("organization_members").select("user_id, role, status, created_at").eq("organization_id", organizationId).order("created_at"),
    canManage ? supabase.from("organization_invitations").select("id, email, role, status, expires_at, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
  ]);
  const members = memberResult.data ?? [];
  const invitations = invitationResult.data ?? [];
  const userIds = members.map((member) => member.user_id);
  const { data: profilesData } = userIds.length ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds) : { data: [] };
  const profileById = new Map((profilesData ?? []).map((profile) => [profile.id, profile]));

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Users className="size-4" /> Workshop access</div><h1 className="text-3xl font-semibold tracking-tight">Team</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Invite estimators, reviewers, parts staff and technicians with explicit organization roles. Invitations expire after seven days and are locked to the invited email address.</p></header>
      {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}
      {query.invite ? <div className="mb-5 rounded-2xl border border-[var(--brand)]/30 bg-[var(--surface)] p-4"><div className="flex items-start gap-3"><Copy className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" /><div className="min-w-0"><p className="text-sm font-semibold">Invitation link created</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Send this link only to the intended recipient. The token itself is not stored in plain text.</p><code className="mt-3 block overflow-x-auto rounded-lg bg-[#091322] p-3 text-xs text-[var(--brand)]">{query.invite}</code></div></div></div> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Members</h2><p className="mt-1 text-xs text-[var(--muted)]">Active and inactive workshop memberships</p></div><span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-xs text-[var(--muted)]">{members.length}</span></div><div className="space-y-3">{members.map((member) => { const profile = profileById.get(member.user_id); return <article key={member.user_id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[#091322] p-4"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-3)] text-[var(--brand)]"><UserRound className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile?.full_name || "Workshop user"}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">{member.role.replaceAll("_", " ")}</p></div></div><span className={`rounded-full px-2 py-0.5 text-[10px] ${member.status === "active" ? "bg-[rgba(88,211,178,0.08)] text-[var(--brand)]" : "bg-white/5 text-[var(--muted)]"}`}>{member.status}</span></article>; })}</div></section>

        <aside className="space-y-5">
          {canManage ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-4 flex items-start gap-3"><MailPlus className="mt-0.5 size-5 text-[var(--brand)]" /><div><h2 className="font-semibold">Invite team member</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Email delivery will later use the transactional email provider. For now the secure invitation link is generated for you.</p></div></div><form action={createWorkshopInvitation} className="grid gap-3"><input name="email" type="email" required className={inputClass} placeholder="person@workshop.co.nz" /><select name="role" defaultValue="estimator" className={inputClass}><option value="admin">Admin</option><option value="manager">Manager</option><option value="estimator">Estimator</option><option value="reviewer">Reviewer / Approver</option><option value="parts">Parts</option><option value="technician">Technician / Panel Beater</option><option value="read_only">Read only</option></select><button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Create invitation</button></form></section> : <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[var(--brand)]" /><div><h2 className="font-semibold">Role managed</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Only workshop owners, admins and managers can create invitations.</p></div></div></section>}
          {canManage ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">Invitations</h2><div className="mt-4 space-y-3">{invitations.length ? invitations.map((invitation) => <div key={invitation.id} className="rounded-xl border border-[var(--border)] bg-[#091322] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{invitation.email}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{invitation.role.replaceAll("_", " ")} · {invitation.status}</p><p className="mt-1 text-[10px] text-[var(--muted)]">Expires {new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(invitation.expires_at))}</p></div>{invitation.status === "pending" ? <form action={revokeWorkshopInvitation}><input type="hidden" name="invitation_id" value={invitation.id} /><button className="text-[10px] font-semibold text-red-200">Revoke</button></form> : null}</div></div>) : <p className="text-sm text-[var(--muted)]">No invitations yet.</p>}</div></section> : null}
        </aside>
      </div>
    </div>
  );
}
