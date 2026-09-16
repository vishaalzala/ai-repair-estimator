type StripeObject = Record<string, unknown> & { id?: string; url?: string | null; customer?: string | null; subscription?: string | null; status?: string };

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function stripePost(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured");
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({})) as StripeObject & { error?: { message?: string } };
  if (!response.ok) throw new Error(json.error?.message || `Stripe request failed (${response.status})`);
  return json;
}

export async function createSubscriptionCheckout(input: {
  email: string;
  organizationId: string;
  planName: string;
  monthlyAmountNzd: number;
  successUrl: string;
  cancelUrl: string;
}) {
  const cents = Math.max(0, Math.round(input.monthlyAmountNzd * 100));
  const session = await stripePost("checkout/sessions", {
    mode: "subscription",
    customer_email: input.email,
    client_reference_id: input.organizationId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "metadata[organization_id]": input.organizationId,
    "subscription_data[metadata][organization_id]": input.organizationId,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "nzd",
    "line_items[0][price_data][unit_amount]": cents,
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": input.planName,
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return { id: String(session.id), url: String(session.url) };
}

export async function createUsageInvoiceItem(input: {
  customerId: string;
  amountNzd: number;
  description: string;
  organizationId: string;
  jobId: string;
}) {
  const cents = Math.max(0, Math.round(input.amountNzd * 100));
  if (cents <= 0) return null;
  const item = await stripePost("invoiceitems", {
    customer: input.customerId,
    amount: cents,
    currency: "nzd",
    description: input.description,
    "metadata[organization_id]": input.organizationId,
    "metadata[job_id]": input.jobId,
  });
  return item.id ? String(item.id) : null;
}
