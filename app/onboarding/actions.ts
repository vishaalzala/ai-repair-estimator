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

  // Generate the tenant ID in the server action and use a minimal INSERT response.
  // Requesting `.select("id")` here makes PostgREST apply the organizations SELECT
  // policy before the organization bootstrap trigger has made the creator an owner,
  // which blocks first-workshop creation under RLS.
  const organizationId = randomUUID();
  const { error: organizationError } = await supabase.from("organizations").insert({
    id: organizationId,
    name,
    slug: makeSlug(name),
    created_by: userId,
  });

  if (organizationError) {
    console.error("[onboarding] Unable to create organization", {
      code: organizationError.code,
      message: organizationError.message,
      details: organizationError.details,
      hint: organizationError.hint,
    });
    redirect("/onboarding?error=Unable%20to%20create%20the%20workshop%20right%20now");
  }

  if (city) {
    const { error: branchError } = await supabase.from("branches").insert({
      organization_id: organizationId,
      name: "Main Workshop",
      city,
      country_code: "NZ",
      is_primary: true,
    });

    if (branchError) {
      // The organization and owner membership are already valid. Keep onboarding
      // successful and let the owner complete branch details later in Settings.
      console.error("[onboarding] Unable to create primary branch", {
        code: branchError.code,
        message: branchError.message,
        details: branchError.details,
        hint: branchError.hint,
      });
    }
  }

  redirect("/dashboard");
}
