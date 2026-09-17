import { Building2, Calculator, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { updateAutomaticEstimateChargeSettings, updateParkingFeeSettings, updateRateCardRate, updateWorkshopProfile } from "../actions";

const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

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
    supabase.from("workshop_settings").select("trading_name, legal_name, gst_number, email, phone, address_line_1, address_line_2, suburb, city, postcode, country_code, default_currency, gst_rate, estimate_valid_days, estimate_terms, parking_fee_enabled, parking_fee_daily_rate, panel_materials_enabled, panel_materials_percent, paint_setup_enabled, paint_setup_amount, environmental_fee_enabled, environmental_fee_amount").eq("organization_id", organizationId).maybeSingle(),
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
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-600"><Building2 className="size-4" /> Workshop configuration</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Workshop & pricing</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Set commercial rates and automatic estimating charges here. Saved estimate versions keep the rates and values actually used at the time.</p>
      </header>

      {query.error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</div> : null}
      {query.message ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.message}</div> : null}
      {!canManage ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">You can view rates, but only workshop management can change commercial settings.</div> : null}

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ReceiptText className="size-4" /></span><div><h2 className="font-semibold text-slate-950">Business details</h2><p className="mt-1 text-xs text-slate-500">Used on printed estimates, quote headers, terms and tax display.</p></div></div>
          <form action={updateWorkshopProfile} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 sm:col-span-2"><span className="text-xs text-slate-500">Trading name</span><input name="trading_name" disabled={!canManage} defaultValue={settings?.trading_name || organization?.name || ""} className={inputClass} /></label>
            <label className="grid gap-2 sm:col-span-2"><span className="text-xs text-slate-500">Legal name</span><input name="legal_name" disabled={!canManage} defaultValue={settings?.legal_name || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">GST number</span><input name="gst_number" disabled={!canManage} defaultValue={settings?.gst_number || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Email</span><input name="email" type="email" disabled={!canManage} defaultValue={settings?.email || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Phone</span><input name="phone" disabled={!canManage} defaultValue={settings?.phone || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Address</span><input name="address_line_1" disabled={!canManage} defaultValue={settings?.address_line_1 || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Address line 2</span><input name="address_line_2" disabled={!canManage} defaultValue={settings?.address_line_2 || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Suburb</span><input name="suburb" disabled={!canManage} defaultValue={settings?.suburb || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">City</span><input name="city" disabled={!canManage} defaultValue={settings?.city || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Postcode</span><input name="postcode" disabled={!canManage} defaultValue={settings?.postcode || ""} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Country</span><input name="country_code" maxLength={2} disabled={!canManage} defaultValue={settings?.country_code || "NZ"} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Currency</span><input name="default_currency" maxLength={3} disabled={!canManage} defaultValue={settings?.default_currency || "NZD"} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">GST rate %</span><input name="gst_rate" type="number" min="0" max="100" step="0.01" disabled={!canManage} defaultValue={Number(settings?.gst_rate ?? 15)} className={inputClass} /></label>
            <label className="grid gap-2"><span className="text-xs text-slate-500">Estimate valid days</span><input name="estimate_valid_days" type="number" min="1" max="365" disabled={!canManage} defaultValue={settings?.estimate_valid_days ?? 30} className={inputClass} /></label>
            <label className="grid gap-2 sm:col-span-2"><span className="text-xs text-slate-500">Estimate terms</span><textarea name="estimate_terms" rows={5} disabled={!canManage} defaultValue={settings?.estimate_terms || ""} className={inputClass} /></label>
            {canManage ? <div className="sm:col-span-2 flex justify-end"><button className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950">Save workshop settings</button></div> : null}
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Calculator className="size-4" /></span><div><h2 className="font-semibold text-slate-950">{rateCard?.name || "Default Workshop Rates"}</h2><p className="mt-1 text-xs leading-5 text-slate-500">These values control manual and automatic quote pricing.</p></div></div><ShieldCheck className="size-5 shrink-0 text-emerald-600" /></div>

          <form action={updateAutomaticEstimateChargeSettings} className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-4 flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-emerald-600" /><div><h3 className="font-semibold text-slate-950">Automatic estimate charges</h3><p className="mt-1 text-xs leading-5 text-slate-600">Open draft estimates recalculate when these defaults change. Saved versions remain unchanged.</p></div></div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-white p-3"><label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><input name="panel_materials_enabled" type="checkbox" disabled={!canManage} defaultChecked={Boolean(settings?.panel_materials_enabled ?? true)} className="size-4 accent-emerald-500" /> Panel Materials</label><p className="mt-1 text-xs text-slate-500">Automatically calculates a percentage of included hourly labour.</p><label className="mt-3 grid gap-1"><span className="text-[10px] text-slate-500">Labour percentage %</span><input name="panel_materials_percent" type="number" min="0" max="100" step="0.01" disabled={!canManage} defaultValue={Number(settings?.panel_materials_percent ?? 5)} className={inputClass} /></label></div>
              <div className="rounded-xl border border-emerald-100 bg-white p-3"><label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><input name="paint_setup_enabled" type="checkbox" disabled={!canManage} defaultChecked={Boolean(settings?.paint_setup_enabled ?? true)} className="size-4 accent-emerald-500" /> Paint Setup</label><p className="mt-1 text-xs text-slate-500">Automatically added under Paint Materials on every active quote.</p><label className="mt-3 grid gap-1"><span className="text-[10px] text-slate-500">Setup charge</span><input name="paint_setup_amount" type="number" min="0" step="0.01" disabled={!canManage} defaultValue={Number(settings?.paint_setup_amount ?? 70)} className={inputClass} /></label></div>
              <div className="rounded-xl border border-emerald-100 bg-white p-3"><label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><input name="environmental_fee_enabled" type="checkbox" disabled={!canManage} defaultChecked={Boolean(settings?.environmental_fee_enabled ?? true)} className="size-4 accent-emerald-500" /> Environmental Fee</label><p className="mt-1 text-xs text-slate-500">Automatically added under Miscellaneous on active quotes.</p><label className="mt-3 grid gap-1"><span className="text-[10px] text-slate-500">Environmental charge</span><input name="environmental_fee_amount" type="number" min="0" step="0.01" disabled={!canManage} defaultValue={Number(settings?.environmental_fee_amount ?? 10)} className={inputClass} /></label></div>
            </div>
            {canManage ? <div className="mt-4 flex justify-end"><button className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-emerald-950">Save automatic charges</button></div> : null}
          </form>

          {!rateCard ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">No default rate card exists. Complete workshop onboarding or contact platform support.</p> : <div className="space-y-2">
            {categories.map((category) => {
              const rate = rateByCategory.get(category.id);
              const usesHours = category.pricing_basis === "hourly";
              const usesFixed = category.pricing_basis === "fixed";
              return <div key={category.id} className="space-y-2">
                <form action={updateRateCardRate} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_130px_130px_auto] sm:items-end">
                  <input type="hidden" name="rate_card_id" value={rateCard.id} /><input type="hidden" name="category_id" value={category.id} />
                  <div><p className="text-sm font-medium text-slate-900">{category.name}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{category.pricing_basis}</p></div>
                  <label className="grid gap-1"><span className="text-[10px] text-slate-500">Hourly rate</span><input name="hourly_rate" type="number" min="0" step="0.01" disabled={!canManage || !usesHours} defaultValue={rate?.hourly_rate ?? ""} className={inputClass} placeholder={usesHours ? "0.00" : "—"} /></label>
                  <label className="grid gap-1"><span className="text-[10px] text-slate-500">Fixed rate</span><input name="fixed_rate" type="number" min="0" step="0.01" disabled={!canManage || !usesFixed} defaultValue={rate?.fixed_rate ?? ""} className={inputClass} placeholder={usesFixed ? "0.00" : "—"} /></label>
                  {canManage ? <button className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Save</button> : <span />}
                </form>

                {category.code === "miscellaneous" ? <form action={updateParkingFeeSettings} className="ml-3 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-[1fr_120px_150px_auto] sm:items-end">
                  <div><p className="text-sm font-semibold text-slate-900">Parking fees</p><p className="mt-1 text-xs leading-5 text-slate-500">Automatic Miscellaneous charge per commenced day from the job creation time.</p></div>
                  <label className="grid gap-1"><span className="text-[10px] text-slate-500">Status</span><span className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs"><input name="parking_fee_enabled" type="checkbox" disabled={!canManage} defaultChecked={Boolean(settings?.parking_fee_enabled)} className="size-4 accent-emerald-500" /> Enable</span></label>
                  <label className="grid gap-1"><span className="text-[10px] text-slate-500">Price / day</span><input name="parking_fee_daily_rate" type="number" min="0" step="0.01" disabled={!canManage} defaultValue={Number(settings?.parking_fee_daily_rate ?? 0)} className={inputClass} placeholder="0.00" /></label>
                  {canManage ? <button className="rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-emerald-950">Save parking</button> : <span />}
                </form> : null}
              </div>;
            })}
          </div>}
        </section>
      </div>
    </div>
  );
}
