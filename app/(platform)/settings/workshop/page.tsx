import { Building2, Calculator, ReceiptText, ShieldCheck } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { updateRateCardRate, updateWorkshopProfile } from "../actions";

const inputClass = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)] disabled:opacity-60";

export default async function WorkshopSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const query = await searchParams;
  const { supabase, organizationId, role } = await requireOrganizationContext();
  const canManage = ["owner", "admin", "manager"].includes(role);

  const [organizationResult, settingsResult, rateCardResult, categoryResult] = await Promise.all([
    supabase.from("organizations").select("id, name, slug").eq("id", organizationId).maybeSingle(),
    supabase.from("workshop_settings").select("trading_name, legal_name, gst_number, email, phone, address_line_1, address_line_2, suburb, city, postcode, country_code, default_currency, gst_rate, estimate_valid_days, estimate_terms").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("rate_cards").select("id, name, is_default, is_active").eq("organization_id", organizationId).eq("is_default", true).eq("is_active", true).maybeSingle(),
    supabase.from("estimate_categories").select("id, code, name, pricing_basis, sort_order, is_active").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
  ]);

  const organization = organizationResult.data;
  const settings = settingsResult.data;
  const rateCard = rateCardResult.data;
  const categories = categoryResult.data ?? [];
  const { data: ratesData } = rateCard
    ? await supabase.from("rate_card_rates").select("category_id, hourly_rate, fixed_rate").eq("organization_id", organizationId).eq("rate_card_id", rateCard.id)
    : { data: [] };
  const rateByCategory = new Map((ratesData ?? []).map((rate) => [rate.category_id, rate]));

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="mb-6"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]"><Building2 className="size-4" /> Workshop configuration</div><h1 className="text-3xl font-semibold tracking-tight">Workshop & pricing</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Commercial rates belong to the workshop, not the AI model. Formal estimate versions snapshot the rates actually used so historical totals never move when settings change.</p></header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-[var(--brand)]/30 bg-[rgba(88,211,178,0.08)] px-4 py-3 text-sm text-[var(--brand)]">{query.message}</div> : null}
      {!canManage ? <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">You can view rates, but only workshop management can change commercial settings.</div> : null}

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><ReceiptText className="size-4" /></span><div><h2 className="font-semibold">Business details</h2><p className="mt-1 text-xs text-[var(--muted)]">Used later for report headers, estimate terms and tax display.</p></div></div>
          <form action={updateWorkshopProfile} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 sm:col-span-2"><span className="text-xs text-[var(--muted)]">Trading name</span><input name="trading_name" disabled={!canManage} defaultValue={settings?.trading_name || organization?.name || ""} className={inputClass} /></label>
            <label className="grid gap-2 sm:col-span-2"><span className="text-xs text-[var(--muted)]">Legal name</span><input name="legal_name" disabled={!canManage} defaultValue={settings?.legal_name || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">GST number</span><input name="gst_number" disabled={!canManage} defaultValue={settings?.gst_number || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Email</span><input name="email" type="email" disabled={!canManage} defaultValue={settings?.email || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Phone</span><input name="phone" disabled={!canManage} defaultValue={settings?.phone || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Address</span><input name="address_line_1" disabled={!canManage} defaultValue={settings?.address_line_1 || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Address line 2</span><input name="address_line_2" disabled={!canManage} defaultValue={settings?.address_line_2 || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Suburb</span><input name="suburb" disabled={!canManage} defaultValue={settings?.suburb || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">City</span><input name="city" disabled={!canManage} defaultValue={settings?.city || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Postcode</span><input name="postcode" disabled={!canManage} defaultValue={settings?.postcode || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Country</span><input name="country_code" maxLength={2} disabled={!canManage} defaultValue={settings?.country_code || "NZ"} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Currency</span><input name="default_currency" maxLength={3} disabled={!canManage} defaultValue={settings?.default_currency || "NZD"} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">GST rate %</span><input name="gst_rate" type="number" min="0" max="100" step="0.01" disabled={!canManage} defaultValue={Number(settings?.gst_rate ?? 15)} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-[var(--muted)]">Estimate valid days</span><input name="estimate_valid_days" type="number" min="1" max="365" disabled={!canManage} defaultValue={settings?.estimate_valid_days ?? 30} className={inputClass} /></label>
            <label className="grid gap-2 sm:col-span-2"><span className="text-xs text-[var(--muted)]">Estimate terms</span><textarea name="estimate_terms" rows={5} disabled={!canManage} defaultValue={settings?.estimate_terms || ""} className={inputClass} /></label>
            {canManage ? <div className="sm:col-span-2 flex justify-end"><button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Save workshop settings</button></div> : null}
          </form>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Calculator className="size-4" /></span><div><h2 className="font-semibold">{rateCard?.name || "Default rate card"}</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">These initial workshop defaults are editable. AI never chooses or changes commercial rates.</p></div></div><ShieldCheck className="size-5 shrink-0 text-[var(--brand)]" /></div>
          {!rateCard ? <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">No default rate card exists. Complete workshop onboarding or contact platform support.</p> : <div className="space-y-2">{categories.map((category) => { const rate = rateByCategory.get(category.id); const usesHours = category.pricing_basis === "hourly"; const usesFixed = category.pricing_basis === "fixed"; return <form action={updateRateCardRate} key={category.id} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[#091322] p-3 sm:grid-cols-[1fr_130px_130px_auto] sm:items-end"><input type="hidden" name="rate_card_id" value={rateCard.id} /><input type="hidden" name="category_id" value={category.id} /><div><p className="text-sm font-medium">{category.name}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">{category.pricing_basis}</p></div><label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Hourly rate</span><input name="hourly_rate" type="number" min="0" step="0.01" disabled={!canManage || !usesHours} defaultValue={rate?.hourly_rate ?? ""} className={inputClass} placeholder={usesHours ? "0.00" : "—"} /></label><label className="grid gap-1"><span className="text-[10px] text-[var(--muted)]">Fixed rate</span><input name="fixed_rate" type="number" min="0" step="0.01" disabled={!canManage || !usesFixed} defaultValue={rate?.fixed_rate ?? ""} className={inputClass} placeholder={usesFixed ? "0.00" : "—"} /></label>{canManage ? <button className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface-2)]">Save</button> : <span />}</form>; })}</div>}
        </section>
      </div>
    </div>
  );
}
