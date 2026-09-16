import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createSubscriptionCheckout } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function billingRedirect(request: Request, key: "message" | "error", value: string) {
  const url = new URL("/billing", request.url);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return billingRedirect(request, "error", "Sign in again before connecting billing.");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership || !["owner", "admin", "manager"].includes(membership.role)) {
    return billingRedirect(request, "error", "Owner, admin or manager access is required to manage billing.");
  }

  const { data: subscription } = await supabase
    .from("organization_subscriptions")
    .select("plan_id,status,stripe_subscription_id")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!subscription) return billingRedirect(request, "error", "No SaaS subscription record was found for this workshop.");
  if (subscription.stripe_subscription_id && ["active", "trialing"].includes(subscription.status)) {
    return billingRedirect(request, "message", "This workshop already has a connected subscription.");
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("name,monthly_price_nzd,active")
    .eq("id", subscription.plan_id)
    .maybeSingle();
  if (!plan?.active) return billingRedirect(request, "error", "The selected SaaS plan is not available.");

  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const protocol = headerStore.get("x-forwarded-proto") ?? "https";
    const origin = host ? `${protocol}://${host}` : new URL(request.url).origin;
    const session = await createSubscriptionCheckout({
      email: auth.user.email,
      organizationId: membership.organization_id,
      planName: plan.name,
      monthlyAmountNzd: Number(plan.monthly_price_nzd),
      successUrl: `${origin}/billing?message=${encodeURIComponent("Payment setup completed. Stripe is confirming your subscription.")}`,
      cancelUrl: `${origin}/billing?message=${encodeURIComponent("Payment setup was cancelled. No changes were made.")}`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("Stripe checkout failed", error instanceof Error ? error.message : "unknown error");
    return billingRedirect(request, "error", "Online billing could not be started. Please contact platform support.");
  }
}
