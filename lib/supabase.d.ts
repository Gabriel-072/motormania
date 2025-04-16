interface ClerkUser {
    clerk_id: string;
    email: string;
    full_name: string;
    created_at: string;
    updated_at: string;
  }
  
  interface Entry {
    id: number;
    user_id: string;
    numbers: string[];
    region: string;
    created_at: string;
  }
  
  declare module '@supabase/supabase-js' {
    interface Database {
      public: {
        Tables: {
          clerk_users: { Row: ClerkUser };
          entries: { Row: Entry };
        };
      };
    }
  }