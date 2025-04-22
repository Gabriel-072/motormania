// 📁 /app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// --- Define payload structures explicitly ---
interface EmailAddress { email_address: string; id: string; }
interface UserCreatedData {
  id: string; username?: string | null; email_addresses: EmailAddress[];
  first_name?: string | null; last_name?: string | null;
}
interface ClerkWebhookPayload { type: string; data: UserCreatedData | any; object: 'event'; }

// --- Constants & Environment Variables ---
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL; // Production URL - CRITICAL
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';
const INITIAL_FREE_NUMBERS_COUNT = 5;

// --- Startup Checks ---
if (!CLERK_WEBHOOK_SECRET) { console.error("FATAL ERROR: CLERK_WEBHOOK_SECRET env var is not set."); }
if (!APP_URL) { console.error("FATAL ERROR: NEXT_PUBLIC_SITE_URL env var is not set."); }
if (!INTERNAL_API_SECRET) { console.warn("WARN: INTERNAL_API_SECRET not set, internal API calls unsecured."); }

// --- POST Handler ---
export async function POST(req: Request) {
  console.log("Clerk Webhook: Request received.");

  if (!CLERK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Server config error: Clerk secret missing' }, { status: 500 });
  }
  if (!APP_URL) {
      return NextResponse.json({ error: 'Server config error: App URL missing' }, { status: 500 });
  }

  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.warn("Clerk Webhook: Missing required Svix headers.");
    return new NextResponse('Missing Svix headers', { status: 400 });
  }

  // Read raw body for verification
  const rawBody = await req.text();
  let evt: ClerkWebhookPayload;
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  try {
    console.log("Clerk Webhook: Verifying signature...");
    evt = wh.verify(rawBody, {
      "svix-id": svix_id, "svix-timestamp": svix_timestamp, "svix-signature": svix_signature,
    }) as ClerkWebhookPayload;
    console.log("Clerk Webhook: Signature verified successfully.");
  } catch (err: any) {
    console.error('Clerk Webhook: Signature verification failed:', err.message);
    return NextResponse.json({ 'Error': 'Webhook signature verification failed', details: err.message }, { status: 400 });
  }

  const eventType = evt.type;
  console.log(`Clerk Webhook: Processing event type: ${eventType}`);

  // --- Handle User Creation ---
  if (eventType === "user.created") {
    const userData = evt.data as UserCreatedData;
    const { id: clerk_id, username, email_addresses, first_name, last_name } = userData;
    const email = email_addresses?.[0]?.email_address;

    if (!email || !clerk_id) {
      console.error(`Clerk Webhook Error (user.created): Missing Clerk ID or Email. ID: ${clerk_id}, EmailFound: ${!!email}`);
      return NextResponse.json({ error: "Required user data missing from Clerk payload" }, { status: 400 });
    }
    console.log(`Clerk Webhook: Processing user.created for ClerkID: ${clerk_id}, Email: ${email}`);

    try {
      const fullName = `${first_name || ""} ${last_name || ""}`.trim() || email.split("@")[0];
      const now = new Date().toISOString();
      const supabase = supabaseServer(); // Get Supabase client instance

      // 1. Upsert user into clerk_users
      console.log(`Clerk Webhook: Upserting into clerk_users for ${clerk_id}...`);
      const { error: userUpsertError } = await supabase.from("clerk_users").upsert({
          clerk_id: clerk_id, email: email, username: username || null, full_name: fullName, updated_at: now,
        }, { onConflict: 'clerk_id' }); // Assumes clerk_id is PK/UNIQUE
      if (userUpsertError) throw new Error(`DB Error (clerk_users upsert): ${userUpsertError.message}`);
      console.log(`Clerk Webhook: User ${clerk_id} synced to clerk_users.`);

      // 2. Generate initial free numbers
      const initialNumbers = Array.from({ length: INITIAL_FREE_NUMBERS_COUNT }, () => Math.floor(100000 + Math.random() * 900000).toString());
      console.log(`Clerk Webhook: Generated ${INITIAL_FREE_NUMBERS_COUNT} numbers for ${clerk_id}.`);

      // 3. Upsert initial entry into entries
      console.log(`Clerk Webhook: Upserting into entries for ${clerk_id}...`);
      const { error: entriesUpsertError } = await supabase.from("entries").upsert({
          user_id: clerk_id, numbers: initialNumbers, paid_numbers_count: 0,
          name: fullName, email: email, region: "CO", // CONFIRM 'entries' COLUMNS
        }, { onConflict: 'user_id', ignoreDuplicates: false }); // REQUIRES UNIQUE(user_id)
      if (entriesUpsertError) throw new Error(`DB Error (entries upsert): ${entriesUpsertError.message}`);
      console.log(`Clerk Webhook: Initial entries created/updated for user ${clerk_id}.`);

      // 4. Upsert Wallet entry (Simplified)
      console.log(`Clerk Webhook: Upserting into wallet for ${clerk_id}...`);
      const { error: walletError } = await supabase.from("wallet").upsert({ // CONFIRM 'wallet' TABLE/COLUMNS
          user_id: clerk_id, mmc_coins: 0, fuel_coins: 0, // Corrected column names
        }, { onConflict: 'user_id', ignoreDuplicates: false }); // REQUIRES UNIQUE(user_id)
      if (walletError) { console.warn(`Clerk Webhook DB Warning (Wallet upsert ${clerk_id}):`, walletError.message); } // Log warning, don't fail
      else { console.log(`Clerk Webhook: Wallet entry created/updated for user ${clerk_id}.`); }

      // 5. Trigger centralized email confirmation API (Fire-and-forget)
      console.log(`Clerk Webhook: Triggering email confirmation API for ${email}...`);
      fetch(`${APP_URL}/api/send-numbers-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${INTERNAL_API_SECRET}` },
        body: JSON.stringify({ to: email, name: fullName, numbers: initialNumbers, context: 'registro' }),
      }).catch(fetchError => { console.error(`Non-blocking: Email API trigger failed for ${email}:`, fetchError); });

      console.log(`✅ Clerk Webhook: Successfully processed user.created for ${clerk_id}`);
      return NextResponse.json({ success: true, message: `User ${clerk_id} processed.` });

    } catch (error) {
       console.error(`❌ Clerk Webhook: Error processing user.created for Clerk ID ${clerk_id}:`, error);
       const message = error instanceof Error ? error.message : "Unknown processing error";
       return NextResponse.json({ error: "Failed to process user creation", details: message }, { status: 500 });
    }
  } // --- End user.created handler ---

  console.log(`Clerk Webhook: Event type ${eventType} received but no handler configured.`);
  return NextResponse.json({ success: true, message: `Event type ${eventType} received but no action needed.` });
}