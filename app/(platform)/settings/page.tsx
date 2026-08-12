import Link from "next/link";
import { Building2, ChevronRight, CircleDollarSign, Settings, Sparkles, Users } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";

export default async function SettingsPage() {
  const { supabase, organizationId, role } = await requireOrganizationContext();

  const [organizationResult, settingsResult, rateCardResult, memberResult, branchResult] = await Promise.all([
    supabase.from("organizations").select("name, slug, timezone, currency, country_code, status").eq("id", organizationId).maybeSingle(),
    supabase.from("workshop_settings").select("trading_name, legal_name, gst_number, gst_rate, email, phone, city, default_currency, estimate_valid_days, estimate_terms").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("rate_cards").select("id, name, is_active, is_default").eq("organization_id", organizationId).eq("is_default", true).maybeSingle(),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);

  const organization = organizationResult.data;
  const settings = settingsResult.data;
  const rateCard = rateCardResult.data;
  const canManage = ["owner", "admin", "manager"].includes(role);
  const requiredProfileFields = [settings?.trading_name || organization?.name, settings?.email, settings?.phone, settings?.city, settings?.gst_number];
  const profileComplete = requiredProfileFields.filter(Boolean).length;

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Settings className="size-4" /> Workspace settings</div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Manage workshop identity, commercial rates, team access and AI knowledge from one place.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Workshop profile" value={`${profileComplete}/5`} detail={profileComplete === 5 ? "Core details complete" : "Complete business details"} />
        <Metric label="Default GST" value={`${Number(settings?.gst_rate ?? 15).toFixed(0)}%`} detail={settings?.default_currency || organization?.currency || "NZD"} />
        <Metric label="Active users" value={memberResult.count ?? 0} detail={`${branchResult.count ?? 0} branch${(branchResult.count ?? 0) === 1 ? "" : "es"}`} />
        <Metric label="Rate card" value={rateCard?.name || "Not set"} detail={rateCard?.is_active ? "Active" : "Needs attention"} compact />
      </div>

      {!canManage ? <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">Your role can view configuration. Owner, admin or manager access is required to change commercial settings.</div> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SettingsCard
          href="/settings/workshop"
          icon={Building2}
          title="Workshop & pricing"
          description="Business details, GST, estimate validity, report terms and your default rate card."
          details={[
            settings?.trading_name || organization?.name || "Workshop",
            [settings?.city, organization?.country_code].filter(Boolean).join(", ") || "Location not completed",
            `Estimate validity ${settings?.estimate_valid_days ?? 30} days`,
          ]}
        />
        <SettingsCard
          href="/team"
          icon={Users}
          title="Team & permissions"
          description="Invite workshop users and control estimator, reviewer, parts and management roles."
          details={[
            `${memberResult.count ?? 0} active user${(memberResult.count ?? 0) === 1 ? "" : "s"}`,
            `Your role: ${role.replaceAll("_", " ")}`,
            "Tenant-isolated access",
          ]}
        />
        <SettingsCard
          href="/knowledge"
          icon={Sparkles}
          title="AI Knowledge"
          description="Teach workshop-specific estimating knowledge and manage private reference documents."
          details={["Workshop-scoped knowledge", "Human-reviewed learning", "No cross-workshop sharing"]}
        />
        <SettingsCard
          href="/settings/workshop"
          icon={CircleDollarSign}
          title="Commercial controls"
          description="Review labour categories and pricing defaults used by the deterministic estimate engine."
          details={[
            rateCard?.name || "Default rate card not found",
            `Currency ${settings?.default_currency || organization?.currency || "NZD"}`,
            `GST ${Number(settings?.gst_rate ?? 15).toFixed(2)}%`,
          ]}
        />
      </div>

      <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="font-semibold">Workspace information</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Organization" value={organization?.name || "—"} />
          <Info label="Workspace slug" value={organization?.slug || "—"} />
          <Info label="Timezone" value={organization?.timezone || "Pacific/Auckland"} />
          <Info label="Status" value={organization?.status || "active"} />
        </dl>
      </section>
    </div>
  );
}

function Metric({ label, value, detail, compact = false }: { label: string; value: string | number; detail: string; compact?: boolean }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="text-xs font-medium text-[var(--muted)]">{label}</div><div className={`mt-2 font-semibold ${compact ? "truncate text-lg" : "text-2xl"}`}>{value}</div><div className="mt-1 text-[11px] text-[var(--muted)]">{detail}</div></div>;
}

function SettingsCard({ href, icon: Icon, title, description, details }: { href: string; icon: typeof Settings; title: string; description: string; details: string[] }) {
  return <Link href={href} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--brand)]/35 hover:bg-[var(--surface-2)]"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2><ChevronRight className="size-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-white" /></div><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p><div className="mt-4 flex flex-wrap gap-2">{details.map((detail) => <span key={detail} className="rounded-full border border-[var(--border)] bg-[#091322] px-2.5 py-1 text-[10px] text-[var(--muted)]">{detail}</span>)}</div></div></div></Link>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="mt-1.5 font-medium">{value}</dd></div>;
}
