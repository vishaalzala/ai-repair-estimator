"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function makeSlug(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return `${base || "workshop"}-${randomUUID().slice(0, 8)}`;
}

export async function createWorkshop(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  if (name.length < 2) {
    redirect("/onboarding?error=Please%20enter%20your%20workshop%20name");
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .insert({ name, slug: makeSlug(name), created_by: userId })
    .select("id")
    .single();

  if (error || !organization) {
    redirect("/onboarding?error=Unable%20to%20create%20the%20workshop%20right%20now");
  }

  if (city) {
    await supabase.from("branches").insert({
      organization_id: organization.id,
      name: "Main Workshop",
      city,
      country_code: "NZ",
      is_primary: true,
    });
  }

  redirect("/dashboard");
}
