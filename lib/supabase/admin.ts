import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("Supabase URL is not configured");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not configured");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
