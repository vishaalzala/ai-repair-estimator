import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrlConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  );
  const supabasePublicKeyConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY,
  );

  const healthy = supabaseUrlConfigured && supabasePublicKeyConfigured;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "configuration_error",
      app: "ai-repair-estimator",
      checks: {
        supabaseUrlConfigured,
        supabasePublicKeyConfigured,
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
