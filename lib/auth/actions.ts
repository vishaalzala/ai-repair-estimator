"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Email%20and%20password%20are%20required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=Unable%20to%20sign%20in%20with%20those%20details");
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (fullName.length < 2 || !email || password.length < 10) {
    redirect("/signup?error=Enter%20your%20name,%20email%20and%20a%20password%20of%20at%20least%2010%20characters");
  }

  if (password !== confirmPassword) {
    redirect("/signup?error=Passwords%20do%20not%20match");
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      ...(appUrl ? { emailRedirectTo: `${appUrl}/auth/confirm` } : {}),
    },
  });

  if (error) {
    redirect("/signup?error=Unable%20to%20create%20the%20account.%20Please%20check%20the%20details%20and%20try%20again");
  }

  if (data.session) {
    redirect("/onboarding");
  }

  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account,%20then%20sign%20in");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
