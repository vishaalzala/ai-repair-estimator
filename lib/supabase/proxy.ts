import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  CANONICAL_AUTH_HOST,
  LEGACY_AUTH_HOST,
  PASSWORD_RECOVERY_COOKIE,
} from "@/lib/auth/constants";

function getProxySupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY;

  return url && key ? { url, key } : null;
}

function requestHostname(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host.split(":")[0].toLowerCase();
}

function privateNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function redirectLegacyAliasToCanonical(request: NextRequest) {
  if (requestHostname(request) !== LEGACY_AUTH_HOST) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = CANONICAL_AUTH_HOST;
  url.port = "";
  return privateNoStore(NextResponse.redirect(url, 307));
}

function redirectToLogin(request: NextRequest, reason?: string) {
  const url = request.nextUrl.clone();
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  url.pathname = isAdminRoute ? "/admin/login" : "/login";
  if (reason) url.searchParams.set("setup", reason);
  else if (!isAdminRoute) url.searchParams.set("next", request.nextUrl.pathname);
  return privateNoStore(NextResponse.redirect(url));
}

function redirectExpiredRecoveryLink(request: NextRequest) {
  const isRecoveryPending = request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";
  if (!isRecoveryPending) return null;

  const errorCode = request.nextUrl.searchParams.get("error_code");
  const errorDescription = request.nextUrl.searchParams.get("error_description")?.toLowerCase() ?? "";
  const expired =
    errorCode === "otp_expired" ||
    errorDescription.includes("expired") ||
    errorDescription.includes("invalid");

  if (!expired) return null;

  const url = request.nextUrl.clone();
  url.pathname = "/forgot-password";
  url.search = "";
  url.searchParams.set(
    "error",
    "That password reset link is invalid or has expired. Please request a new reset link.",
  );
  return privateNoStore(NextResponse.redirect(url));
}

function redirectAuthCodeToConfirm(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const pathname = request.nextUrl.pathname;

  if (!code || pathname.startsWith("/auth/confirm")) return null;
  if (pathname !== "/" && pathname !== "/login" && pathname !== "/reset-password") return null;

  const url = request.nextUrl.clone();
  url.pathname = "/auth/confirm";
  url.search = "";
  url.searchParams.set("code", code);

  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  if (flowId) url.searchParams.set("sb_flow_id", flowId);

  const requestedNext = request.nextUrl.searchParams.get("next");
  const isRecoveryPending = request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";
  if (pathname === "/reset-password" || requestedNext === "/reset-password" || isRecoveryPending) {
    url.searchParams.set("next", "/reset-password");
  } else if (requestedNext && requestedNext !== "/") {
    url.searchParams.set("next", requestedNext);
  }

  return privateNoStore(NextResponse.redirect(url));
}

export async function updateSession(request: NextRequest) {
  const canonicalRedirect = redirectLegacyAliasToCanonical(request);
  if (canonicalRedirect) return canonicalRedirect;

  let response = privateNoStore(NextResponse.next({ request }));
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/stripe/webhook");

  const expiredRecoveryRedirect = redirectExpiredRecoveryLink(request);
  if (expiredRecoveryRedirect) return expiredRecoveryRedirect;

  const authCodeRedirect = redirectAuthCodeToConfirm(request);
  if (authCodeRedirect) return authCodeRedirect;

  const config = getProxySupabaseConfig();

  if (!config) {
    console.error("[supabase] Missing public Supabase URL/key in deployment environment.");
    return isPublicRoute ? response : redirectToLogin(request, "supabase");
  }

  try {
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = privateNoStore(NextResponse.next({ request }));
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(cacheHeaders ?? {}).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
          response.headers.set("Cache-Control", "private, no-store, max-age=0");
        },
      },
    });

    const { data, error } = await supabase.auth.getClaims();

    if (error) {
      console.warn("[supabase] Session refresh failed:", error.message);
    }

    if (!data?.claims && !isPublicRoute) {
      return redirectToLogin(request);
    }

    if (data?.claims && (pathname === "/login" || pathname === "/signup")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return privateNoStore(NextResponse.redirect(url));
    }

    return response;
  } catch (error) {
    console.error(
      "[supabase] Failed to initialize session middleware:",
      error instanceof Error ? error.message : "unknown error",
    );

    return isPublicRoute ? response : redirectToLogin(request, "supabase-runtime");
  }
}
