// lib/chatSupabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in environment variables');
}

// Function to create a Supabase client with the given token
export const createChatSupabaseClient = (token?: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
};