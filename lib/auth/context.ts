import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireOrganizationContext() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  return {
    supabase,
    userId,
    organizationId: membership.organization_id,
    role: membership.role,
  };
}
