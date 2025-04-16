export interface League {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  profile_image_url: string | null;
  join_password: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  league_members_count?: number; // number | undefined
}