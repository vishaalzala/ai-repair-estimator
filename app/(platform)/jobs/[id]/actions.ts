"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

const editableRoles = new Set(["owner", "admin", "manager", "estimator", "reviewer"]);

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullable(formData: FormData, key: string) {
  const result = value(formData, key);
  return result || null;
}

function intValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function triState(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (raw === "yes") return true;
  if (raw === "no") return false;
  return null;
}

export async function updateJobOverview(jobId: string, formData: FormData) {
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  if (!editableRoles.has(role)) redirect(`/jobs/${jobId}?error=You%20do%20not%20have%20permission%20to%20edit%20this%20job`);

  const { data: existingJob } = await supabase
    .from("jobs")
    .select("id, status, customer_id, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();

  if (!existingJob) redirect("/jobs?error=Job%20not%20found");

  const linkedCustomerId = nullable(formData, "existing_customer_id");
  let customerId = existingJob.customer_id as string | null;

  if (linkedCustomerId) {
    const { data: linkedCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", linkedCustomerId)
      .maybeSingle();
    if (linkedCustomer) customerId = linkedCustomer.id;
  } else {
    const customerPayload = {
      customer_type: value(formData, "customer_type") || "individual",
      first_name: nullable(formData, "customer_first_name"),
      last_name: nullable(formData, "customer_last_name"),
      business_name: nullable(formData, "customer_business_name"),
      email: nullable(formData, "customer_email"),
      phone: nullable(formData, "customer_phone"),
      address_line1: nullable(formData, "customer_address_line1"),
      address_line2: nullable(formData, "customer_address_line2"),
      city: nullable(formData, "customer_city"),
      region: nullable(formData, "customer_region"),
      postcode: nullable(formData, "customer_postcode"),
      country_code: value(formData, "customer_country_code") || "NZ",
      notes: nullable(formData, "customer_notes"),
    };
    const hasCustomerDetails = Object.entries(customerPayload).some(([key, item]) => !["customer_type", "country_code"].includes(key) && Boolean(item));
    if (customerId) {
      const { error } = await supabase.from("customers").update(customerPayload).eq("organization_id", organizationId).eq("id", customerId);
      if (error) redirect(`/jobs/${jobId}?edit=1&error=Unable%20to%20update%20customer%20details`);
    } else if (hasCustomerDetails) {
      const { data: created, error } = await supabase.from("customers").insert({ organization_id: organizationId, created_by: userId, ...customerPayload }).select("id").single();
      if (error || !created) redirect(`/jobs/${jobId}?edit=1&error=Unable%20to%20create%20customer`);
      customerId = created.id;
    }
  }

  let vehicleId = existingJob.vehicle_id as string | null;
  const vehiclePayload = {
    customer_id: customerId,
    registration: nullable(formData, "registration"),
    vin: nullable(formData, "vin"),
    make: nullable(formData, "make"),
    model: nullable(formData, "model"),
    variant: nullable(formData, "variant"),
    model_year: intValue(formData, "model_year"),
    colour: nullable(formData, "colour"),
    paint_code: nullable(formData, "paint_code"),
    odometer_km: intValue(formData, "odometer_km"),
    body_type: nullable(formData, "body_type"),
    fuel_type: nullable(formData, "fuel_type"),
    vehicle_origin: nullable(formData, "vehicle_origin"),
    vehicle_size: nullable(formData, "vehicle_size"),
    is_ev: formData.get("is_ev") === "on",
    is_hybrid: formData.get("is_hybrid") === "on",
    adas_present: triState(formData, "adas_present"),
  };

  if (vehicleId) {
    const { error } = await supabase.from("vehicles").update(vehiclePayload).eq("organization_id", organizationId).eq("id", vehicleId);
    if (error) redirect(`/jobs/${jobId}?edit=1&error=Unable%20to%20update%20vehicle%20details`);
  } else {
    const { data: created, error } = await supabase.from("vehicles").insert({ organization_id: organizationId, created_by: userId, ...vehiclePayload }).select("id").single();
    if (error || !created) redirect(`/jobs/${jobId}?edit=1&error=Unable%20to%20create%20vehicle`);
    vehicleId = created.id;
  }

  const nextStatus = value(formData, "status") || existingJob.status;
  const { error: jobError } = await supabase
    .from("jobs")
    .update({
      customer_id: customerId,
      vehicle_id: vehicleId,
      job_reference: nullable(formData, "job_reference"),
      repair_type: nullable(formData, "repair_type"),
      repair_size: nullable(formData, "repair_size"),
      work_source: nullable(formData, "work_source"),
      assigned_to: nullable(formData, "assigned_to"),
      branch_id: nullable(formData, "branch_id"),
      status: nextStatus,
    })
    .eq("organization_id", organizationId)
    .eq("id", jobId);
  if (jobError) redirect(`/jobs/${jobId}?edit=1&error=Unable%20to%20update%20job%20details`);

  const { data: currentClaim } = await supabase.from("claims").select("id").eq("organization_id", organizationId).eq("job_id", jobId).maybeSingle();
  const claimPayload = {
    insurer_id: nullable(formData, "insurer_id"),
    claim_number: nullable(formData, "claim_number"),
    policy_number: nullable(formData, "policy_number"),
    assessor_name: nullable(formData, "assessor_name"),
    assessor_email: nullable(formData, "assessor_email"),
    assessor_phone: nullable(formData, "assessor_phone"),
    case_manager_name: nullable(formData, "case_manager_name"),
    case_manager_email: nullable(formData, "case_manager_email"),
    excess_amount: numberValue(formData, "excess_amount"),
    accident_date: nullable(formData, "accident_date"),
    accident_location: nullable(formData, "accident_location"),
    accident_description: nullable(formData, "accident_description"),
    authority_reference: nullable(formData, "authority_reference"),
  };
  if (currentClaim) {
    const { error } = await supabase.from("claims").update(claimPayload).eq("organization_id", organizationId).eq("id", currentClaim.id);
    if (error) redirect(`/jobs/${jobId}?edit=1&error=Unable%20to%20update%20claim%20details`);
  } else {
    const { error } = await supabase.from("claims").insert({ organization_id: organizationId, job_id: jobId, ...claimPayload });
    if (error) redirect(`/jobs/${jobId}?edit=1&error=Unable%20to%20create%20claim%20details`);
  }

  const dueAt = nullable(formData, "due_at");
  const priority = value(formData, "priority") || "normal";
  const { data: currentSchedule } = await supabase.from("job_schedules").select("id").eq("organization_id", organizationId).eq("job_id", jobId).maybeSingle();
  if (currentSchedule) {
    await supabase.from("job_schedules").update({ due_at: dueAt, priority }).eq("organization_id", organizationId).eq("id", currentSchedule.id);
  } else if (dueAt || priority !== "normal") {
    await supabase.from("job_schedules").insert({ organization_id: organizationId, job_id: jobId, due_at: dueAt, priority, is_completed: false, created_by: userId });
  }

  await supabase.from("activity_events").insert({
    organization_id: organizationId,
    job_id: jobId,
    actor_user_id: userId,
    event_type: "job_details_updated",
    title: "Job details updated",
    details: { status_before: existingJob.status, status_after: nextStatus },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/estimate`);
  revalidatePath("/jobs");
  redirect(`/jobs/${jobId}?saved=1`);
}
