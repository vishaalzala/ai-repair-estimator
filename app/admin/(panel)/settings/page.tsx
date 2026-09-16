import { requirePlatformAdmin } from "@/lib/admin/context";
import { savePlatformSettings } from "./actions";

const field = "rounded-xl border border-[var(--border)] bg-[#091322] px-3 py-2.5 text-sm";

export default async function AdminSettingsPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data: settings } = await supabase.from("platform_settings").select("key,value,updated_at");
  const map = new Map((settings ?? []).map((setting) => [setting.key, setting.value]));
  const fx = Number(map.get("usd_to_nzd_rate") ?? 1.7);
  const markup = Number(map.get("ai_markup_percent") ?? 10);

  return (
    <div className="mx-auto max-w-[1200px] p-5 sm:p-7 lg:p-9">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Platform configuration</p>
        <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Global SaaS settings. API secrets remain in Vercel environment variables and are never exposed here.</p>
      </header>
      <form action={savePlatformSettings} className="grid max-w-2xl gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <label className="grid gap-2 text-xs text-[var(--muted)]">USD → NZD billing FX rate<input name="usd_to_nzd_rate" type="number" min="0.000001" step="0.000001" defaultValue={fx} className={field} /><span>Used to convert OpenAI USD cost into NZD customer usage cost. Update this when your billing FX policy changes.</span></label>
        <label className="grid gap-2 text-xs text-[var(--muted)]">Default AI usage markup %<input name="ai_markup_percent" type="number" min="0" step="0.01" defaultValue={markup} className={field} /><span>Plans can override this. Starter is currently configured at 10%.</span></label>
        <button className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e]">Save platform settings</button>
      </form>
      <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-semibold">Secret configuration</h2>
        <div className="mt-3 grid gap-2 text-xs text-[var(--muted)]">
          <p>OpenAI API: {process.env.OPENAI_API_KEY ? "Configured" : "Missing"}</p>
          <p>Stripe API: {process.env.STRIPE_SECRET_KEY ? "Configured" : "Missing"}</p>
          <p>Stripe webhook: {process.env.STRIPE_WEBHOOK_SECRET ? "Configured" : "Missing"}</p>
          <p>Supabase secret key: {process.env.SUPABASE_SECRET_KEY ? "Configured" : "Not configured (optional)"}</p>
        </div>
      </section>
    </div>
  );
}
