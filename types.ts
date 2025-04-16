export interface ClerkUser {
  clerk_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  user_id: string;
  numbers: string[];
  created_at: string;
  region: string;
}