"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const CANONICAL_AUTH_ORIGIN = "https://ai-repair-estimator.vercel.app";
const LEGACY_AUTH_HOST = "ai-repair-estimator-workshoppro.vercel.app";
export const PASSWORD_RECOVERY_COOKIE = "repairquote_password_recovery";

function encode(value: string) {
  return encodeURIComponent(value);
}

function normalizeAppUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() === LEGACY_AUTH_HOST) {
      return CANONICAL_AUTH_ORIGIN;
    }
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function getAppUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";

  if (host) {
    const requestUrl = normalizeAppUrl(`${protocol}://${host}`);
    if (requestUrl) return requestUrl;
  }

  const origin = normalizeAppUrl(headerStore.get("origin"));
  if (origin) return origin;

  return normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL ?? null);
}

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

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=Enter%20your%20email%20address");
  }

  const appUrl = await getAppUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    ...(appUrl ? { redirectTo: `${appUrl}/auth/confirm?next=/reset-password` } : {}),
  });

  if (error) {
    redirect(`/forgot-password?error=${encode("Unable to send a reset link right now. Please wait a moment and try again.")}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 2 * 60 * 60,
  });

  redirect(`/forgot-password?message=${encode("If an account exists for that email, a password reset link has been sent. Please check your inbox and spam folder.")}`);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 10) {
    redirect(`/reset-password?error=${encode("Use a password of at least 10 characters.")}`);
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?error=${encode("Passwords do not match.")}`);
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/forgot-password?error=${encode("This reset link is invalid or has expired. Please request a new one.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encode("Unable to update your password. Please request a new reset link and try again.")}`);
  }

  const cookieStore = await cookies();
  cookieStore.delete(PASSWORD_RECOVERY_COOKIE);
  await supabase.auth.signOut();
  redirect(`/login?message=${encode("Password updated successfully. Sign in with your new password.")}`);
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
  const appUrl = await getAppUrl();
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
