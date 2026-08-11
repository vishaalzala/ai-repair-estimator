"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(token: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/auth/invite/${encodeURIComponent(token)}/login`);

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.rpc("accept_organization_invitation", { p_token_hash: tokenHash });
  if (error) redirect(`/auth/invite/${encodeURIComponent(token)}?error=This%20invitation%20could%20not%20be%20accepted.%20Check%20the%20email%20account%20and%20expiry`);
  redirect("/dashboard");
}

export async function invitationSignIn(token: string, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(`/auth/invite/${encodeURIComponent(token)}/login?error=Email%20and%20password%20are%20required`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/auth/invite/${encodeURIComponent(token)}/login?error=Unable%20to%20sign%20in%20with%20those%20details`);
  redirect(`/auth/invite/${encodeURIComponent(token)}`);
}
