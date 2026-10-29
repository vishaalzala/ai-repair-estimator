"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { messagingAvailability } from "@/lib/communications/config";

const senderRoles = new Set(["owner","admin","manager","estimator","reviewer"]);
type Channel = "sms" | "email";

function normalisePhone(value: string): string | null {
  let phone = value.replace(/[\s()-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (phone.startsWith("0")) phone = "+64" + phone.slice(1);
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  return phone;
}

function destination(jobId: string | null, customerId: string | null) {
  if (jobId) return "/jobs/" + jobId + "/messages";
  if (customerId) return "/customers/" + customerId;
  return "/communications";
}

function fail(path: string, reason: string): never {
  redirect(path + (path.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(reason));
}

async function dispatchMessage(channel: Channel, recipient: string, subject: string, body: string): Promise<{ provider: string; id: string }> {
  if (channel === "email") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MESSAGING_FROM_EMAIL;
    if (!apiKey || !from) throw new Error("Email provider is not configured");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [recipient], subject, text: body }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !result.id) throw new Error("Email provider rejected the message (" + response.status + ")");
    return { provider: "resend", id: result.id };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("SMS provider is not configured");
  const form = new URLSearchParams({ From: from, To: recipient, Body: body });
  const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(sid) + "/Messages.json", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(sid + ":" + token).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as { sid?: string; status?: string };
  if (!response.ok || !result.sid) throw new Error("SMS provider rejected the message (" + response.status + ")");
  return { provider: "twilio", id: result.sid };
}

export async function sendWorkshopMessage(formData: FormData) {
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  if (!senderRoles.has(role)) redirect("/communications?error=You%20do%20not%20have%20sending%20permission");

  const jobId = String(formData.get("job_id") ?? "").trim() || null;
  const customerId = String(formData.get("customer_id") ?? "").trim() || null;
  const path = destination(jobId, customerId);
  const channel = String(formData.get("channel") ?? "");
  const rawRecipient = String(formData.get("recipient") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const requestKey = String(formData.get("request_key") ?? "");

  if (channel !== "sms" && channel !== "email") fail(path, "Select SMS or Email");
  if (!body || body.length > 5000) fail(path, "Message must be 1-5000 characters");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestKey)) fail(path, "Reload the message form and try again");
  if (channel === "sms" && body.length > 1600) fail(path, "SMS must be at most 1600 characters");
  if (channel === "email" && (!subject || subject.length > 180)) fail(path, "Email subject is required (up to 180 characters)");
  const recipient = channel === "sms" ? normalisePhone(rawRecipient) : (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawRecipient) ? rawRecipient : null);
  if (!recipient) fail(path, channel === "sms" ? "Enter a valid NZ or international phone number" : "Enter a valid email address");

  if (jobId) {
    const { data: job } = await supabase.from("jobs").select("id,customer_id").eq("organization_id", organizationId).eq("id", jobId).maybeSingle();
    if (!job) fail(path, "Job not found");
    if (customerId && job.customer_id !== customerId) fail(path, "This customer is not linked to the job");
  }
  if (customerId) {
    const { data: customer } = await supabase.from("customers").select("id").eq("organization_id", organizationId).eq("id", customerId).maybeSingle();
    if (!customer) fail(path, "Customer not found");
  }

  const available = messagingAvailability();
  if (!available[channel]) fail(path, channel === "sms" ? "SMS is unavailable: configure Twilio in platform settings" : "Email is unavailable: configure Resend in platform settings");

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase.from("workshop_messages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("created_by", userId).gte("created_at", since);
  if ((count ?? 0) >= 10) fail(path, "Too many messages. Try again shortly");

  const { data: existing } = await supabase.from("workshop_messages").select("id,status")
    .eq("organization_id", organizationId).eq("idempotency_key", requestKey).maybeSingle();
  if (existing) redirect(path + "?message=" + encodeURIComponent("This message was already submitted (" + existing.status + ")"));

  const provider = channel === "sms" ? "twilio" : "resend";
  const { data: record, error: insertError } = await supabase.from("workshop_messages").insert({
    organization_id: organizationId, job_id: jobId, customer_id: customerId, channel,
    recipient, subject: channel === "email" ? subject : null, body,
    provider, status: "processing", idempotency_key: requestKey, created_by: userId,
  }).select("id").single();
  if (insertError || !record) fail(path, "Unable to record message; check for an existing submission");

  let status: "sent" | "failed" = "failed";
  let providerMessageId: string | null = null;
  let providerError: string | null = null;

  try {
    const sent = await dispatchMessage(channel, recipient, subject, body);
    providerMessageId = sent.id;
    status = "sent"; // Provider accepted the message; delivery may still be pending.
  } catch (error) {
    providerError = error instanceof Error ? error.message.slice(0, 250) : "Provider request failed";
  }

  const { error: updateError } = await supabase.from("workshop_messages").update({
    status, provider_message_id: providerMessageId, provider_error: providerError,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  }).eq("organization_id", organizationId).eq("id", record.id);
  if (updateError) console.error("Could not update message status", record.id, updateError.code);

  await supabase.from("activity_events").insert({
    organization_id: organizationId, job_id: jobId, actor_user_id: userId,
    event_type: status === "sent" ? "workshop_message_sent" : "workshop_message_failed",
    title: (channel === "sms" ? "SMS" : "Email") + (status === "sent" ? " accepted by provider" : " failed"),
    details: { communication_id: record.id, customer_id: customerId, channel, status },
  });
  revalidatePath(path);
  if (jobId) revalidatePath("/jobs/" + jobId);
  if (customerId) revalidatePath("/customers/" + customerId);
  revalidatePath("/communications");
  redirect(path + (status === "sent" ? "?message=Message%20accepted%20by%20provider" : "?error=Provider%20could%20not%20send%20the%20message"));
}

export async function prepareMessageRequestKey() {
  return randomUUID();
}
