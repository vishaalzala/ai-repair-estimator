"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function enc(value: string) {
  return encodeURIComponent(value);
}

export async function adminSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(`/smartadmin/login?error=${enc("Email and password are required")}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect(`/smartadmin/login?error=${enc("Unable to sign in with those details")}`);

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("id, role, status")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    redirect(`/smartadmin/login?error=${enc("This account is not authorised for Super Admin")}`);
  }

  const [touchResult, auditResult] = await Promise.all([
    supabase.rpc("touch_platform_admin_login"),
    supabase.from("platform_audit_logs").insert({
      actor_user_id: data.user.id,
      action: "admin_login",
      entity_type: "platform_admin",
      entity_id: admin.id,
      metadata: { role: admin.role },
    }),
  ]);

  if (touchResult.error) {
    console.error("Unable to update platform admin last login", touchResult.error.code);
  }
  if (auditResult.error) {
    console.error("Unable to record platform admin login audit", auditResult.error.code);
  }

  redirect("/smartadmin");
}

export async function adminSignOut() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    await supabase.from("platform_audit_logs").insert({ actor_user_id: auth.user.id, action: "admin_logout", entity_type: "platform_admin", entity_id: auth.user.id });
  }
  await supabase.auth.signOut();
  redirect("/smartadmin/login");
}
