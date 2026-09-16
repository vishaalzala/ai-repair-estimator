import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getProxySupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY;

  return url && key ? { url, key } : null;
}

function redirectToLogin(request: NextRequest, reason?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  if (reason) url.searchParams.set("setup", reason);
  else url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
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
  if (pathname === "/reset-password") {
    url.searchParams.set("next", "/reset-password");
  } else if (requestedNext && requestedNext !== "/") {
    url.searchParams.set("next", requestedNext);
  }

  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/health");

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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
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
      return NextResponse.redirect(url);
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
