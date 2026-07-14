import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public (anon) Supabase client for read-only access from Server Components.
 * RLS restricts this to published posts + reference data.
 *
 * Returns null when env is not configured, so the app still builds/renders
 * (data functions fall back to empty results).
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
