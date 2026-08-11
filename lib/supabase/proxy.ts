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

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/health");

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
