import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/constants";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const recoveryPending = request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";
  const isRecoveryFlow =
    type === "recovery" || requestedNext === "/reset-password" || recoveryPending;
  const redirectTo = request.nextUrl.clone();

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      redirectTo.pathname = isRecoveryFlow ? "/reset-password" : "/onboarding";
      redirectTo.search = "";
      return NextResponse.redirect(redirectTo);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirectTo.pathname = isRecoveryFlow ? "/reset-password" : "/onboarding";
      redirectTo.search = "";
      return NextResponse.redirect(redirectTo);
    }
  }

  if (isRecoveryFlow) {
    redirectTo.pathname = "/forgot-password";
    redirectTo.search = "";
    redirectTo.searchParams.set(
      "error",
      "That password reset link is invalid or has expired. Please request a new reset link.",
    );
    return NextResponse.redirect(redirectTo);
  }

  redirectTo.pathname = "/login";
  redirectTo.search = "";
  redirectTo.searchParams.set(
    "error",
    "Unable to confirm that email link. Please request a new link and try again.",
  );
  return NextResponse.redirect(redirectTo);
}
