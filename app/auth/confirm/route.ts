import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000;

function wasRecoveryRequestedRecently(user: unknown) {
  const recoverySentAt = (user as { recovery_sent_at?: string | null } | null)?.recovery_sent_at;
  if (!recoverySentAt) return false;

  const recoveryTime = Date.parse(recoverySentAt);
  if (!Number.isFinite(recoveryTime)) return false;

  const age = Date.now() - recoveryTime;
  return age >= 0 && age <= RECOVERY_WINDOW_MS;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  let isRecoveryFlow = type === "recovery" || requestedNext === "/reset-password";
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (!isRecoveryFlow && wasRecoveryRequestedRecently(data.user)) {
        isRecoveryFlow = true;
      }

      redirectTo.pathname = isRecoveryFlow ? "/reset-password" : "/onboarding";
      redirectTo.search = "";
      return NextResponse.redirect(redirectTo);
    }
  }

  if (isRecoveryFlow) {
    redirectTo.pathname = "/forgot-password";
    redirectTo.search = "";
    redirectTo.searchParams.set("error", "That password reset link is invalid or has expired. Please request a new one.");
    return NextResponse.redirect(redirectTo);
  }

  redirectTo.pathname = "/login";
  redirectTo.search = "";
  redirectTo.searchParams.set("error", "Unable to confirm that email link. Please request a new link and try again.");
  return NextResponse.redirect(redirectTo);
}
