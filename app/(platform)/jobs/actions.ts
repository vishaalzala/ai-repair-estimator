"use server";

import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { defaultWorkSourceForInsurer, normalizeInsuranceCustomer } from "@/lib/insurance/insurers";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type QuickJobInput = {
  registration?: string;
  vin?: string;
  make?: string;
  model?: string;
  modelYear?: string;
  insurerName?: string;
  accidentDescription?: string;
};

export async function createQuickJob(input: QuickJobInput) {
  const { supabase, organizationId } = await requireOrganizationContext();
  const insurerName = normalizeInsuranceCustomer(input.insurerName);
  if (!insurerName) throw new Error("Select an insurer or Private Job before starting the assessment.");

  const payload = {
    customer_first_name: "",
    customer_last_name: "",
    customer_email: "",
    customer_phone: "",
    registration: input.registration?.trim() ?? "",
    vin: input.vin?.trim() ?? "",
    make: input.make?.trim() ?? "",
    model: input.model?.trim() ?? "",
    variant: "",
    model_year: input.modelYear?.trim() ?? "",
    colour: "",
    paint_code: "",
    odometer_km: "",
    body_type: "",
    fuel_type: "",
    is_ev: false,
    is_hybrid: false,
    adas_present: "",
    repair_type: "collision",
    repair_size: "",
    work_source: defaultWorkSourceForInsurer(insurerName),
    job_reference: "",
    insurer_name: insurerName,
    claim_number: "",
    policy_number: "",
    assessor_name: "",
    assessor_email: "",
    assessor_phone: "",
    excess_amount: "",
    accident_date: "",
    accident_location: "",
    accident_description: input.accidentDescription?.trim() ?? "",
    authority_reference: "",
  };

  const { data: jobId, error } = await supabase.rpc("create_job_intake", {
    p_organization_id: organizationId,
    p_payload: payload,
  });

  if (error || !jobId) {
    console.error("create_job_intake quick intake failed", error?.code);
    throw new Error("Unable to start the assessment right now.");
  }

  return { jobId: String(jobId) };
}

export async function createJob(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizationContext();

  const firstName = value(formData, "customer_first_name");
  const lastName = value(formData, "customer_last_name");
  const make = value(formData, "make");
  const model = value(formData, "model");
  const adasValue = value(formData, "adas_present");
  const insurerName = normalizeInsuranceCustomer(value(formData, "insurer_name"));
  if (!insurerName) {
    redirect("/jobs/new?error=Please%20select%20an%20insurer%20or%20Private%20Job");
  }
  const requestedWorkSource = value(formData, "work_source");
  const payload = {
    customer_first_name: firstName,
    customer_last_name: lastName,
    customer_email: value(formData, "customer_email"),
    customer_phone: value(formData, "customer_phone"),
    registration: value(formData, "registration"),
    vin: value(formData, "vin"),
    make,
    model,
    variant: value(formData, "variant"),
    model_year: value(formData, "model_year"),
    colour: value(formData, "colour"),
    paint_code: value(formData, "paint_code"),
    odometer_km: value(formData, "odometer_km"),
    body_type: value(formData, "body_type"),
    fuel_type: value(formData, "fuel_type"),
    is_ev: formData.get("is_ev") === "on",
    is_hybrid: formData.get("is_hybrid") === "on",
    adas_present: adasValue,
    repair_type: value(formData, "repair_type"),
    repair_size: value(formData, "repair_size"),
    work_source: requestedWorkSource || defaultWorkSourceForInsurer(insurerName),
    job_reference: value(formData, "job_reference"),
    insurer_name: insurerName,
    claim_number: value(formData, "claim_number"),
    policy_number: value(formData, "policy_number"),
    assessor_name: value(formData, "assessor_name"),
    assessor_email: value(formData, "assessor_email"),
    assessor_phone: value(formData, "assessor_phone"),
    excess_amount: value(formData, "excess_amount"),
    accident_date: value(formData, "accident_date"),
    accident_location: value(formData, "accident_location"),
    accident_description: value(formData, "accident_description"),
    authority_reference: value(formData, "authority_reference"),
  };

  const { data: jobId, error } = await supabase.rpc("create_job_intake", {
    p_organization_id: organizationId,
    p_payload: payload,
  });

  if (error || !jobId) {
    console.error("create_job_intake failed", error?.code);
    redirect("/jobs/new?error=Unable%20to%20create%20the%20assessment.%20Please%20check%20the%20details%20and%20try%20again");
  }

  redirect(`/jobs/${jobId}`);
}
