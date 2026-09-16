import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function integerSecondsToIso(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const pieces = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = pieces.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = pieces.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  const unix = Number(timestamp);
  if (!Number.isFinite(unix) || Math.abs(Date.now() / 1000 - unix) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some((candidate) => {
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(candidate, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ message: "Stripe webhook is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature || !verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ message: "Invalid Stripe signature." }, { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = asRecord(JSON.parse(payload));
  } catch {
    return NextResponse.json({ message: "Invalid webhook payload." }, { status: 400 });
  }

  const eventType = text(event.type) ?? "unknown";
  const eventData = asRecord(event.data);
  const object = asRecord(eventData.object);
  const supabase = createAdminClient();

  try {
    if (eventType === "checkout.session.completed") {
      const metadata = asRecord(object.metadata);
      const organizationId = text(metadata.organization_id) ?? text(object.client_reference_id);
      const customerId = text(object.customer);
      const subscriptionId = text(object.subscription);
      if (organizationId) {
        await supabase.from("organization_subscriptions").update({
          status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          updated_at: new Date().toISOString(),
        }).eq("organization_id", organizationId);
      }
    }

    if (eventType === "customer.subscription.updated" || eventType === "customer.subscription.created") {
      const subscriptionId = text(object.id);
      const customerId = text(object.customer);
      const metadata = asRecord(object.metadata);
      const organizationId = text(metadata.organization_id);
      const update = {
        status: text(object.status) ?? "active",
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        current_period_start: integerSecondsToIso(object.current_period_start),
        current_period_end: integerSecondsToIso(object.current_period_end),
        cancel_at_period_end: Boolean(object.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      };
      if (organizationId) await supabase.from("organization_subscriptions").update(update).eq("organization_id", organizationId);
      else if (subscriptionId) await supabase.from("organization_subscriptions").update(update).eq("stripe_subscription_id", subscriptionId);
    }

    if (eventType === "customer.subscription.deleted") {
      const subscriptionId = text(object.id);
      if (subscriptionId) await supabase.from("organization_subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("stripe_subscription_id", subscriptionId);
    }

    if (eventType === "invoice.paid") {
      const customerId = text(object.customer);
      if (customerId) {
        const { data: subscription } = await supabase.from("organization_subscriptions").select("organization_id").eq("stripe_customer_id", customerId).maybeSingle();
        if (subscription) {
          const now = new Date().toISOString();
          await Promise.all([
            supabase.from("organization_subscriptions").update({ status: "active", updated_at: now }).eq("organization_id", subscription.organization_id),
            supabase.from("estimate_ai_charges").update({ status: "billed", billed_at: now, updated_at: now }).eq("organization_id", subscription.organization_id).eq("status", "pending_invoice"),
            supabase.from("ai_usage_ledger").update({ billing_status: "billed", billed_at: now }).eq("organization_id", subscription.organization_id).eq("billing_status", "pending_invoice"),
          ]);
        }
      }
    }

    if (eventType === "invoice.payment_failed") {
      const customerId = text(object.customer);
      if (customerId) await supabase.from("organization_subscriptions").update({ status: "past_due", updated_at: new Date().toISOString() }).eq("stripe_customer_id", customerId);
    }

    await supabase.from("platform_audit_logs").insert({
      actor_user_id: null,
      action: `stripe_${eventType.replaceAll(".", "_")}`,
      entity_type: "stripe_event",
      entity_id: text(event.id),
      metadata: { livemode: Boolean(event.livemode) },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ message: "Webhook processing failed." }, { status: 500 });
  }
}
