"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function customerPayload(formData: FormData) {
  const customerType = value(formData, "customer_type") === "business" ? "business" : "individual";
  return {
    customer_type: customerType,
    first_name: value(formData, "first_name") || null,
    last_name: value(formData, "last_name") || null,
    business_name: value(formData, "business_name") || null,
    email: value(formData, "email") || null,
    phone: value(formData, "phone") || null,
    address_line1: value(formData, "address_line1") || null,
    address_line2: value(formData, "address_line2") || null,
    city: value(formData, "city") || null,
    region: value(formData, "region") || null,
    postcode: value(formData, "postcode") || null,
    country_code: (value(formData, "country_code") || "NZ").slice(0, 2).toUpperCase(),
    notes: value(formData, "notes") || null,
  };
}

function validCustomer(payload: ReturnType<typeof customerPayload>) {
  if (payload.customer_type === "business") return Boolean(payload.business_name);
  return Boolean(payload.first_name || payload.last_name || payload.email || payload.phone);
}

export async function createCustomer(formData: FormData) {
  const { supabase, organizationId, userId } = await requireOrganizationContext();
  const payload = customerPayload(formData);
  if (!validCustomer(payload)) redirect("/customers?error=Add%20a%20customer%20name,%20business%20name,%20email%20or%20phone");

  const { error } = await supabase.from("customers").insert({
    organization_id: organizationId,
    ...payload,
    created_by: userId,
  });

  if (error) {
    console.error("Customer create failed", error.code);
    redirect("/customers?error=Unable%20to%20create%20the%20customer");
  }

  revalidatePath("/customers");
  redirect("/customers?message=Customer%20created");
}

export async function updateCustomer(formData: FormData) {
  const customerId = value(formData, "customer_id");
  if (!customerId) return;
  const { supabase, organizationId } = await requireOrganizationContext();
  const payload = customerPayload(formData);
  if (!validCustomer(payload)) redirect("/customers?error=Customer%20details%20cannot%20all%20be%20blank");

  const { error } = await supabase.from("customers").update(payload).eq("organization_id", organizationId).eq("id", customerId);
  if (error) {
    console.error("Customer update failed", error.code);
    redirect("/customers?error=Unable%20to%20update%20the%20customer");
  }

  revalidatePath("/customers");
}
