// 📁 /app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server"; // Ensure this helper creates Supabase client with SERVICE_ROLE_KEY
import type { WebhookEvent } from '@clerk/nextjs/server'; // Good practice to import if using officially supported types

// --- Define payload structures explicitly for type safety ---
interface EmailAddress {
  email_address: string;
  id: string;
  // verification?: { status: string; strategy: string; }; // Optional: Add if needed
}

interface UserCreatedData {
  id: string; // This is the Clerk User ID
  username?: string | null;
  email_addresses: EmailAddress[]; // Corrected Array Type Syntax
  first_name?: string | null;
  last_name?: string | null;
  // Add other relevant fields from Clerk user object if needed (e.g., public_metadata)
}

interface ClerkWebhookPayload {
  type: 'user.created' | 'user.updated' | 'user.deleted' | string; // Handle relevant types
  data: UserCreatedData | any; // Use specific type for user.created
  object: 'event';
}

// --- Constants ---
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'; // Ensure this is correct for your env
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || ''; // Shared secret for internal API calls
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';
const INITIAL_FREE_NUMBERS_COUNT = 5;

// --- Environment Variable Check ---
if (!CLERK_WEBHOOK_SECRET) {
  console.error("FATAL: CLERK_WEBHOOK_SECRET environment variable is not set for Clerk Webhook handler.");
  // Optionally throw error during startup in production environments
}
if (!INTERNAL_API_SECRET) {
    console.warn("WARN: INTERNAL_API_SECRET is not set. Internal API calls will not be secured.");
}


// --- POST Handler for Clerk Webhooks ---
export async function POST(req: Request) {
  if (!CLERK_WEBHOOK_SECRET) {
    // Check again in case startup check was bypassed
    return NextResponse.json({ error: 'Server configuration error: Webhook secret missing' }, { status: 500 });
  }

  // Get Svix headers for verification
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.warn("Clerk Webhook: Missing Svix headers.");
    return new NextResponse('Missing Svix headers', { status: 400 });
  }

  // Use raw body for verification (more robust)
  const rawBody = await req.text();
  let evt: ClerkWebhookPayload;
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  try {
    // Verify the payload against the headers
    evt = wh.verify(rawBody, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookPayload;
  } catch (err: any) {
    console.error('Error verifying Clerk webhook signature:', err.message);
    return NextResponse.json({ 'Error': 'Webhook signature verification failed', details: err.message }, { status: 400 });
  }

  // --- Handle the specific event type ---
  const eventType = evt.type;
  console.log(`Received Clerk webhook event: ${eventType}`);

  // --- Handle User Creation ---
  if (eventType === "user.created") {
    // Extract data with type assertion for clarity
    const userData = evt.data as UserCreatedData;
    const { id: clerk_id, username, email_addresses, first_name, last_name } = userData;
    const email = email_addresses?.[0]?.email_address;

    // Validate essential data from Clerk
    if (!email) {
      console.error(`Clerk Webhook Error (user.created): No email address found for user ${clerk_id}`);
      return NextResponse.json({ error: "Email address is required from Clerk" }, { status: 400 });
    }
    if (!clerk_id) {
       console.error(`Clerk Webhook Error (user.created): No clerk_id found in payload.`);
       return NextResponse.json({ error: "User ID is required from Clerk" }, { status: 400 });
    }

    try {
      // Prepare user data for DB
      const fullName = `${first_name || ""} ${last_name || ""}`.trim() || email.split("@")[0]; // Fallback name
      const now = new Date().toISOString(); // Consistent timestamp

      // 1. Upsert user into clerk_users table
      // Ensure your supabaseServer helper uses the Service Role Key
      const supabase = supabaseServer();
      const { error: userUpsertError } = await supabase
        .from("clerk_users") // CONFIRM table name
        .upsert({
          clerk_id: clerk_id,   // CONFIRM column name
          email: email,
          username: username || null,
          full_name: fullName,
          created_at: now,    // Set creation time on first insert
          updated_at: now,    // Always update timestamp
        }, { onConflict: 'clerk_id' }); // MUST have UNIQUE constraint on clerk_id

      if (userUpsertError) {
        console.error(`Clerk Webhook DB Error (Upsert User ${clerk_id}):`, userUpsertError);
        throw new Error(`Failed to sync user: ${userUpsertError.message}`);
      }
      console.log(`User ${clerk_id} synced to clerk_users.`);

      // 2. Generate initial free numbers
      const initialNumbers = Array.from({ length: INITIAL_FREE_NUMBERS_COUNT }, () =>
        Math.floor(100000 + Math.random() * 900000).toString()
      );

      // 3. Upsert initial entry into entries table
      // Assumes 'user_id' column in 'entries' references 'clerk_users.clerk_id'
      // Assumes 'user_id' has a UNIQUE constraint in 'entries' for onConflict
      const { error: entriesUpsertError, data: insertedEntries } = await supabase
        .from("entries") // CONFIRM table name
        .upsert({
          user_id: clerk_id,          // CONFIRM column name & FK relationship
          numbers: initialNumbers,
          paid_numbers_count: 0,    // Start with 0 paid numbers
          name: fullName,           // Denormalized - ok if intended
          email: email,             // Denormalized - ok if intended
          region: "CO",             // Or use DB default 'Bogota'? Or get from Clerk if possible?
          // created_at will use DB default
        }, { onConflict: 'user_id', ignoreDuplicates: false }) // MUST have UNIQUE constraint on user_id
        .select(); // Select to confirm

      if (entriesUpsertError) {
        console.error(`Clerk Webhook DB Error (Upsert Entry ${clerk_id}):`, entriesUpsertError);
        throw new Error(`Failed to upsert initial entries: ${entriesUpsertError.message}`);
      }
      console.log(`Initial entries created/updated for user ${clerk_id}.`);

      // 4. Upsert Wallet entry (Simplified: no initial bonus logic)
      const { error: walletError } = await supabase
        .from("wallet") // CONFIRM table name
        .upsert({
          user_id: clerk_id,       // CONFIRM column name & FK, MUST have UNIQUE constraint
          mmc_balance: 0,
          fuel_balance: 0,
        }, { onConflict: 'user_id', ignoreDuplicates: false });

      if (walletError) {
        // Log warning but don't necessarily fail the whole webhook for wallet init failure
        console.warn(`Clerk Webhook DB Warning (Upsert Wallet ${clerk_id}):`, walletError);
      } else {
        console.log(`Wallet entry created/updated for user ${clerk_id}.`);
      }

      // 5. Trigger centralized email confirmation API (Fire-and-forget)
      fetch(`${APP_URL}/api/send-numbers-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${INTERNAL_API_SECRET}` // Pass internal secret if configured
        },
        body: JSON.stringify({
          to: email,
          name: fullName,
          numbers: initialNumbers, // Pass the generated numbers
          context: 'registro'      // Specify context for registration email
        }),
      }).catch(fetchError => {
        // Log error but don't fail the main webhook response
        console.error(`Non-blocking: Failed to trigger confirmation email API for ${email} from Clerk webhook:`, fetchError);
      });
      console.log(`Confirmation email initiated via API for ${email}.`);

      // --- User Created processing finished successfully ---
      return NextResponse.json({ success: true, message: `User ${clerk_id} processed successfully.` });

    } catch (error) {
       // Catch errors specific to processing the user.created event AFTER verification
       console.error(`Error processing user.created for Clerk ID ${evt.data.id || 'UNKNOWN'}:`, error);
       const message = error instanceof Error ? error.message : "Unknown processing error";
       // Return 500 to indicate failure to process this specific event
       return NextResponse.json({ error: "Failed to process user creation event", details: message }, { status: 500 });
    }
  }
  // --- End Handle User Creation ---

  // TODO: Add handlers for other event types like 'user.updated', 'user.deleted' if needed

  // If event type is received but not explicitly handled, acknowledge receipt
  console.log(`Clerk webhook event type ${eventType} received but not processed.`);
  return NextResponse.json({ success: true, message: `Event type ${eventType} received but no action configured.` });

}