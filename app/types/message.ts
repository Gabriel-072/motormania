// types/message.ts
export type Message = {
    id: string;
    user_id: string;
    username: string;
    message: string;
    created_at: string;
    reactions: { [key: string]: string[] }; // e.g., { "thumbs_up": ["user1", "user2"] }
    profile_image_url?: string; // Optional field
  };