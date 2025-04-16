import { createClient } from "@supabase/supabase-js";

export const supabaseServer = (jwt?: string) =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    jwt ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! : process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : {} }
  );

export const createServerSupabaseClient = supabaseServer;