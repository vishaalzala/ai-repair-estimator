import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PlatformAdminRole = "super_admin" | "admin" | "support" | "billing_admin" | "ai_admin";

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) redirect("/admin/login");

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("id, user_id, role, status, mfa_required, last_login_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=This%20account%20does%20not%20have%20platform%20administrator%20access");
  }

  return {
    supabase,
    userId,
    adminId: admin.id,
    role: admin.role as PlatformAdminRole,
    mfaRequired: Boolean(admin.mfa_required),
  };
}

export async function getPlatformAdminIfSignedIn() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) return null;

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("id, user_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return admin ? { supabase, userId, admin } : null;
}
