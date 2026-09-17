"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function saveSupplier(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizationContext();
  const id = text(formData, "supplier_id");
  const name = text(formData, "name");
  if (!name) redirect("/suppliers?error=Supplier%20name%20is%20required");
  const payload = {
    name,
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    account_reference: text(formData, "account_reference"),
    notes: text(formData, "notes"),
    is_active: formData.get("is_active") !== "false",
  };

  const result = id
    ? await supabase.from("suppliers").update(payload).eq("organization_id", organizationId).eq("id", id)
    : await supabase.from("suppliers").insert({ organization_id: organizationId, ...payload });
  if (result.error) redirect("/suppliers?error=Unable%20to%20save%20supplier");
  revalidatePath("/suppliers");
  redirect("/suppliers?message=Supplier%20saved");
}
