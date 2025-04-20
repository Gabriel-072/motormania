import { createClient } from '@supabase/supabase-js';

// Public Supabase client (for general use, no token required)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Authenticated Supabase client (supports both authenticated and unauthenticated access)
export const createAuthClient = (jwt: string | null) =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      },
    }
  );