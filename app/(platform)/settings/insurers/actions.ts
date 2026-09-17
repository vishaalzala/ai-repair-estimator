"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

function value(formData: FormData, key: string) { const v = String(formData.get(key) ?? "").trim(); return v || null; }

export async function saveInsurer(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizationContext();
  const id = value(formData, "insurer_id");
  const name = value(formData, "name");
  if (!name) redirect("/settings/insurers?error=Insurer%20name%20is%20required");
  const payload = { name, contact_name: value(formData, "contact_name"), email: value(formData, "email"), phone: value(formData, "phone"), notes: value(formData, "notes") };
  const result = id ? await supabase.from("insurers").update(payload).eq("organization_id", organizationId).eq("id", id) : await supabase.from("insurers").insert({ organization_id: organizationId, ...payload });
  if (result.error) redirect("/settings/insurers?error=Unable%20to%20save%20insurer");
  revalidatePath("/settings/insurers");
  redirect("/settings/insurers?message=Insurer%20saved");
}
