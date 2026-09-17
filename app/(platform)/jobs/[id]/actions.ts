"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function integer(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function numeric(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableBoolean(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

export async function updateJobOverview(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, customer_id, vehicle_id, status, repair_type, repair_size, work_source, job_reference")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();

  if (!job) redirect("/jobs?error=Job%20not%20found");

  let customerId = job.customer_id as string | null;
  const customerPayload = {
    first_name: text(formData, "customer_first_name"),
    last_name: text(formData, "customer_last_name"),
    business_name: text(formData, "customer_business_name"),
    email: text(formData, "customer_email"),
    phone: text(formData, "customer_phone"),
    address_line1: text(formData, "customer_address_line1"),
    address_line2: text(formData, "customer_address_line2"),
    city: text(formData, "customer_city"),
    region: text(formData, "customer_region"),
    postcode: text(formData, "customer_postcode"),
  };
  const hasCustomerDetails = Object.values(customerPayload).some(Boolean);

  if (customerId) {
    const { error } = await supabase.from("customers").update(customerPayload).eq("organization_id", organizationId).eq("id", customerId);
    if (error) redirect(`/jobs/${jobId}?error=Unable%20to%20update%20customer`);
  } else if (hasCustomerDetails) {
    const { data: created, error } = await supabase.from("customers").insert({
      organization_id: organizationId,
      customer_type: customerPayload.business_name ? "business" : "person",
      country_code: "NZ",
      created_by: userId,
      ...customerPayload,
    }).select("id").single();
    if (error || !created) redirect(`/jobs/${jobId}?error=Unable%20to%20create%20customer`);
    customerId = created.id;
  }

  let vehicleId = job.vehicle_id as string | null;
  const vehiclePayload = {
    customer_id: customerId,
    registration: text(formData, "registration"),
    vin: text(formData, "vin"),
    make: text(formData, "make"),
    model: text(formData, "model"),
    variant: text(formData, "variant"),
    model_year: integer(formData, "model_year"),
    colour: text(formData, "colour"),
    paint_code: text(formData, "paint_code"),
    odometer_km: integer(formData, "odometer_km"),
    body_type: text(formData, "body_type"),
    fuel_type: text(formData, "fuel_type"),
    is_ev: formData.get("is_ev") === "on",
    is_hybrid: formData.get("is_hybrid") === "on",
    adas_present: nullableBoolean(formData, "adas_present"),
  };

  if (vehicleId) {
    const { error } = await supabase.from("vehicles").update(vehiclePayload).eq("organization_id", organizationId).eq("id", vehicleId);
    if (error) redirect(`/jobs/${jobId}?error=Unable%20to%20update%20vehicle`);
  } else {
    const { data: created, error } = await supabase.from("vehicles").insert({ organization_id: organizationId, created_by: userId, ...vehiclePayload }).select("id").single();
    if (error || !created) redirect(`/jobs/${jobId}?error=Unable%20to%20create%20vehicle`);
    vehicleId = created.id;
  }

  const nextStatus = String(formData.get("status") ?? job.status).trim() || job.status;
  const jobPayload = {
    customer_id: customerId,
    vehicle_id: vehicleId,
    status: nextStatus,
    repair_type: text(formData, "repair_type"),
    repair_size: text(formData, "repair_size"),
    work_source: text(formData, "work_source"),
    job_reference: text(formData, "job_reference"),
  };
  const { error: jobError } = await supabase.from("jobs").update(jobPayload).eq("organization_id", organizationId).eq("id", jobId);
  if (jobError) redirect(`/jobs/${jobId}?error=Unable%20to%20update%20job`);

  if (nextStatus !== job.status) {
    await supabase.from("job_status_history").insert({ organization_id: organizationId, job_id: jobId, from_status: job.status, to_status: nextStatus, changed_by: userId });
  }

  const insurerName = text(formData, "insurer_name");
  let insurerId: string | null = null;
  if (insurerName) {
    const { data: existing } = await supabase.from("insurers").select("id").eq("organization_id", organizationId).ilike("name", insurerName).limit(1).maybeSingle();
    if (existing?.id) {
      insurerId = existing.id;
    } else {
      const { data: created } = await supabase.from("insurers").insert({ organization_id: organizationId, name: insurerName }).select("id").single();
      insurerId = created?.id ?? null;
    }
  }

  const claimPayload = {
    insurer_id: insurerId,
    claim_number: text(formData, "claim_number"),
    policy_number: text(formData, "policy_number"),
    assessor_name: text(formData, "assessor_name"),
    assessor_email: text(formData, "assessor_email"),
    assessor_phone: text(formData, "assessor_phone"),
    excess_amount: numeric(formData, "excess_amount"),
    accident_date: text(formData, "accident_date"),
    accident_location: text(formData, "accident_location"),
    accident_description: text(formData, "accident_description"),
    authority_reference: text(formData, "authority_reference"),
  };

  const { data: claim } = await supabase.from("claims").select("id").eq("organization_id", organizationId).eq("job_id", jobId).maybeSingle();
  if (claim?.id) {
    const { error } = await supabase.from("claims").update(claimPayload).eq("organization_id", organizationId).eq("id", claim.id);
    if (error) redirect(`/jobs/${jobId}?error=Unable%20to%20update%20claim`);
  } else {
    const { error } = await supabase.from("claims").insert({ organization_id: organizationId, job_id: jobId, ...claimPayload });
    if (error) redirect(`/jobs/${jobId}?error=Unable%20to%20create%20claim`);
  }

  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action: "job_overview_updated",
    entity_type: "job",
    entity_id: jobId,
    before_data: { status: job.status, repair_type: job.repair_type, repair_size: job.repair_size, work_source: job.work_source, job_reference: job.job_reference },
    after_data: { ...jobPayload, vehicle_id: vehicleId, customer_id: customerId },
    reason: "Updated from job overview",
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/estimate`);
  redirect(`/jobs/${jobId}?message=Details%20saved`);
}
