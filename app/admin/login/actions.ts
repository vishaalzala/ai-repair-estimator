"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function enc(value: string) {
  return encodeURIComponent(value);
}

export async function adminSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(`/admin/login?error=${enc("Email and password are required")}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect(`/admin/login?error=${enc("Unable to sign in with those details")}`);

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("id, role, status")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    redirect(`/admin/login?error=${enc("This account is not authorised for Super Admin")}`);
  }

  await Promise.all([
    supabase.from("platform_admins").update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", admin.id),
    supabase.from("platform_audit_logs").insert({ actor_user_id: data.user.id, action: "admin_login", entity_type: "platform_admin", entity_id: admin.id, metadata: { role: admin.role } }),
  ]);

  redirect("/admin");
}

export async function adminSignOut() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    await supabase.from("platform_audit_logs").insert({ actor_user_id: auth.user.id, action: "admin_logout", entity_type: "platform_admin", entity_id: auth.user.id });
  }
  await supabase.auth.signOut();
  redirect("/admin/login");
}
