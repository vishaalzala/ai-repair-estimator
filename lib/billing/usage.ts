import type { SupabaseClient } from "@supabase/supabase-js";
import { createUsageInvoiceItem, stripeConfigured, updateUsageInvoiceItem } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type ModelPrice = {
  provider: string;
  model: string;
  input_usd_per_million: number | string;
  cached_input_usd_per_million: number | string;
  output_usd_per_million: number | string;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
};

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function priceForRun(prices: ModelPrice[], provider: string, model: string, createdAt: string) {
  const created = Date.parse(createdAt);
  return prices
    .filter((price) => price.provider === provider && price.model === model)
    .filter((price) => Date.parse(price.effective_from) <= created)
    .filter((price) => !price.effective_to || Date.parse(price.effective_to) > created)
    .sort((a, b) => Date.parse(b.effective_from) - Date.parse(a.effective_from))[0] ?? null;
}

export async function meterJobAiUsage(input: {
  supabase: SupabaseClient;
  organizationId: string;
  jobId: string;
  estimateId: string;
}) {
  const { supabase, organizationId, jobId, estimateId } = input;
  const billingClient = process.env.SUPABASE_SECRET_KEY ? createAdminClient() : supabase;

  const [runsResult, pricesResult, subscriptionResult, settingsResult, jobResult] = await Promise.all([
    billingClient
      .from("ai_analysis_runs")
      .select("id,provider,model,status,input_tokens,cached_input_tokens,output_tokens,created_at")
      .eq("organization_id", organizationId)
      .eq("job_id", jobId)
      .eq("status", "completed")
      .order("created_at", { ascending: true }),
    billingClient
      .from("ai_model_prices")
      .select("provider,model,input_usd_per_million,cached_input_usd_per_million,output_usd_per_million,effective_from,effective_to,active"),
    billingClient
      .from("organization_subscriptions")
      .select("plan_id,status,stripe_customer_id,stripe_subscription_id")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    billingClient
      .from("platform_settings")
      .select("key,value")
      .in("key", ["usd_to_nzd_rate", "ai_markup_percent"]),
    billingClient.from("jobs").select("job_number").eq("organization_id", organizationId).eq("id", jobId).maybeSingle(),
  ]);

  const runs = runsResult.data ?? [];
  if (!runs.length) return null;
  const prices = (pricesResult.data ?? []) as ModelPrice[];
  const settings = new Map((settingsResult.data ?? []).map((row) => [row.key, row.value]));
  const fxRate = Math.max(0.000001, numberValue(settings.get("usd_to_nzd_rate"), 1.7));

  const subscription = subscriptionResult.data;
  const { data: plan } = subscription?.plan_id
    ? await billingClient
      .from("plans")
      .select("ai_markup_percent,minimum_estimate_charge_nzd")
      .eq("id", subscription.plan_id)
      .maybeSingle()
    : { data: null };

  const markupPercent = Math.max(0, numberValue(plan?.ai_markup_percent, numberValue(settings.get("ai_markup_percent"), 10)));
  const minimumEstimateCharge = Math.max(0, numberValue(plan?.minimum_estimate_charge_nzd, 0));

  for (const run of runs) {
    const inputTokens = Math.max(0, numberValue(run.input_tokens));
    const cachedTokens = Math.min(inputTokens, Math.max(0, numberValue(run.cached_input_tokens)));
    const uncachedInputTokens = Math.max(0, inputTokens - cachedTokens);
    const outputTokens = Math.max(0, numberValue(run.output_tokens));
    const price = priceForRun(prices, String(run.provider), String(run.model), run.created_at);
    if (!price) continue;

    const providerCostUsd =
      (uncachedInputTokens / 1_000_000) * numberValue(price.input_usd_per_million) +
      (cachedTokens / 1_000_000) * numberValue(price.cached_input_usd_per_million) +
      (outputTokens / 1_000_000) * numberValue(price.output_usd_per_million);
    const providerCostNzd = providerCostUsd * fxRate;
    const markupAmountNzd = providerCostNzd * (markupPercent / 100);
    const customerChargeNzd = providerCostNzd + markupAmountNzd;

    await Promise.all([
      billingClient.from("ai_analysis_runs").update({ estimated_cost_usd: providerCostUsd }).eq("id", run.id),
      billingClient.from("ai_usage_ledger").upsert({
        organization_id: organizationId,
        job_id: jobId,
        estimate_id: estimateId,
        ai_run_id: run.id,
        provider: run.provider,
        model: run.model,
        input_tokens: inputTokens,
        cached_input_tokens: cachedTokens,
        output_tokens: outputTokens,
        provider_cost_usd: providerCostUsd,
        fx_rate_usd_nzd: fxRate,
        provider_cost_nzd: providerCostNzd,
        markup_percent: markupPercent,
        markup_amount_nzd: markupAmountNzd,
        customer_charge_nzd: customerChargeNzd,
      }, { onConflict: "ai_run_id" }),
    ]);
  }

  const { data: ledgerRows } = await billingClient
    .from("ai_usage_ledger")
    .select("provider_cost_usd,provider_cost_nzd,customer_charge_nzd")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId);

  const providerCostUsd = (ledgerRows ?? []).reduce((sum, row) => sum + numberValue(row.provider_cost_usd), 0);
  const providerCostNzd = (ledgerRows ?? []).reduce((sum, row) => sum + numberValue(row.provider_cost_nzd), 0);
  const rawCustomerChargeNzd = (ledgerRows ?? []).reduce((sum, row) => sum + numberValue(row.customer_charge_nzd), 0);
  const customerChargeNzd = Math.max(rawCustomerChargeNzd, minimumEstimateCharge);
  const markupAmountNzd = Math.max(0, customerChargeNzd - providerCostNzd);

  const { data: existingCharge } = await billingClient
    .from("estimate_ai_charges")
    .select("id,status,stripe_invoice_item_id")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .maybeSingle();

  let stripeInvoiceItemId = existingCharge?.stripe_invoice_item_id ?? null;
  let billingStatus = existingCharge?.status ?? "unbilled";
  const description = `AI Estimate Usage — ${jobResult.data?.job_number ?? jobId.slice(0, 8)}`;
  const stripeBillingReady = stripeConfigured() && Boolean(process.env.SUPABASE_SECRET_KEY);

  if (
    stripeBillingReady &&
    subscription?.stripe_customer_id &&
    ["active", "trialing"].includes(subscription.status) &&
    billingStatus !== "billed" &&
    customerChargeNzd > 0
  ) {
    try {
      if (stripeInvoiceItemId) {
        stripeInvoiceItemId = await updateUsageInvoiceItem({
          invoiceItemId: stripeInvoiceItemId,
          amountNzd: customerChargeNzd,
          description,
        });
      } else {
        stripeInvoiceItemId = await createUsageInvoiceItem({
          customerId: subscription.stripe_customer_id,
          amountNzd: customerChargeNzd,
          description,
          organizationId,
          jobId,
        });
      }
      if (stripeInvoiceItemId) billingStatus = "pending_invoice";
    } catch (error) {
      console.error("Unable to sync AI usage charge to Stripe", error instanceof Error ? error.message : "unknown error");
    }
  }

  await billingClient.from("estimate_ai_charges").upsert({
    organization_id: organizationId,
    job_id: jobId,
    estimate_id: estimateId,
    provider_cost_usd: providerCostUsd,
    provider_cost_nzd: providerCostNzd,
    markup_percent: markupPercent,
    markup_amount_nzd: markupAmountNzd,
    customer_charge_nzd: customerChargeNzd,
    status: billingStatus,
    stripe_invoice_item_id: stripeInvoiceItemId,
    finalized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "job_id" });

  if (billingStatus === "pending_invoice") {
    await billingClient
      .from("ai_usage_ledger")
      .update({ billing_status: "pending_invoice", stripe_invoice_item_id: stripeInvoiceItemId })
      .eq("organization_id", organizationId)
      .eq("job_id", jobId)
      .neq("billing_status", "billed");
  }

  return {
    providerCostUsd,
    providerCostNzd,
    customerChargeNzd,
    markupPercent,
    billingStatus,
  };
}
