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
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';
const INITIAL_FREE_NUMBERS_COUNT = 5;

if (!CLERK_WEBHOOK_SECRET) { console.error("FATAL: CLERK_WEBHOOK_SECRET env var is not set."); }
if (!INTERNAL_API_SECRET) { console.warn("WARN: INTERNAL_API_SECRET not set."); }

// --- POST Handler ---
export async function POST(req: Request) {
  console.log("Clerk webhook request received."); // Log entry

  if (!CLERK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Server config error: Clerk secret missing' }, { status: 500 });
  }

  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.warn("Clerk Webhook: Missing Svix headers.");
    return new NextResponse('Missing Svix headers', { status: 400 });
  }

  const rawBody = await req.text();
  let evt: ClerkWebhookPayload;
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  try {
    console.log("Verifying Clerk webhook signature...");
    evt = wh.verify(rawBody, {
      "svix-id": svix_id, "svix-timestamp": svix_timestamp, "svix-signature": svix_signature,
    }) as ClerkWebhookPayload;
    console.log("Clerk webhook signature verified.");
  } catch (err: any) {
    console.error('Error verifying Clerk webhook signature:', err.message);
    return NextResponse.json({ 'Error': 'Webhook signature verification failed', details: err.message }, { status: 400 });
  }

  const eventType = evt.type;
  console.log(`Processing Clerk event type: ${eventType}`);

  if (eventType === "user.created") {
    const userData = evt.data as UserCreatedData;
    const { id: clerk_id, username, email_addresses, first_name, last_name } = userData;
    const email = email_addresses?.[0]?.email_address;

    if (!email || !clerk_id) {
      console.error(`Clerk Webhook Error (user.created): Missing Clerk ID or Email. ID: ${clerk_id}, EmailFound: ${!!email}`);
      return NextResponse.json({ error: "Required user data missing" }, { status: 400 });
    }
    console.log(`Processing user.created for Clerk ID: ${clerk_id}, Email: ${email}`);

    try {
      const fullName = `${first_name || ""} ${last_name || ""}`.trim() || email.split("@")[0];
      const now = new Date().toISOString();
      const supabase = supabaseServer();

      // 1. Upsert user into clerk_users
      console.log(`Attempting upsert into clerk_users for ${clerk_id}...`);
      const { error: userUpsertError } = await supabase.from("clerk_users").upsert({
          clerk_id: clerk_id, email: email, username: username || null, full_name: fullName, updated_at: now,
          // Let created_at use DB default or set it if needed: created_at: now,
        }, { onConflict: 'clerk_id' }); // REQUIRES UNIQUE constraint on clerk_id (PK)
      if (userUpsertError) throw new Error(`DB Error (clerk_users upsert): ${userUpsertError.message}`);
      console.log(`User ${clerk_id} synced to clerk_users.`);

      // 2. Generate initial free numbers
      const initialNumbers = Array.from({ length: INITIAL_FREE_NUMBERS_COUNT }, () => Math.floor(100000 + Math.random() * 900000).toString());
      console.log(`Generated initial numbers for ${clerk_id}:`, initialNumbers);

      // 3. Upsert initial entry into entries
      console.log(`Attempting upsert into entries for ${clerk_id}...`);
      const { error: entriesUpsertError } = await supabase.from("entries").upsert({
          user_id: clerk_id, numbers: initialNumbers, paid_numbers_count: 0,
          name: fullName, email: email, region: "CO", // Match your schema columns
        }, { onConflict: 'user_id', ignoreDuplicates: false }); // REQUIRES UNIQUE constraint on user_id
      if (entriesUpsertError) throw new Error(`DB Error (entries upsert): ${entriesUpsertError.message}`);
      console.log(`Initial entries created/updated for user ${clerk_id}.`);

      // 4. Upsert Wallet entry (Simplified)
      // Assumes UNIQUE constraint on user_id in 'wallet' table
      console.log(`Attempting upsert into wallet for ${clerk_id}...`); // Added log
      const { error: walletError } = await supabase
        .from("wallet") // CONFIRM table name - OK based on schema
        .upsert({
          user_id: clerk_id,       // CONFIRM column name & FK - OK based on schema
          // --- CORRECCIÓN AQUÍ ---
          mmc_coins: 0,         // Usar nombre correcto del schema: mmc_coins
          fuel_coins: 0,        // Usar nombre correcto del schema: fuel_coins
          // --- FIN CORRECCIÓN ---
        }, { onConflict: 'user_id', ignoreDuplicates: false }); // OK based on schema

       if (walletError) {
            // Log warning but don't necessarily fail the whole webhook for wallet init failure
            console.warn(`Clerk Webhook DB Warning (Wallet upsert ${clerk_id}):`, walletError.message);
       } else {
            console.log(`Wallet entry created/updated for user ${clerk_id}.`);
       }

      // 5. Trigger centralized email confirmation API
      console.log(`Triggering email confirmation API for ${email}...`);
      fetch(`${APP_URL}/api/send-numbers-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${INTERNAL_API_SECRET}` },
        body: JSON.stringify({ to: email, name: fullName, numbers: initialNumbers, context: 'registro' }),
      }).catch(fetchError => { console.error(`Non-blocking: Email API trigger failed for ${email}:`, fetchError); });

      console.log(`✅ Successfully processed user.created for ${clerk_id}`);
      return NextResponse.json({ success: true, message: `User ${clerk_id} processed.` });

    } catch (error) {
       console.error(`❌ Error processing user.created for Clerk ID ${clerk_id}:`, error);
       const message = error instanceof Error ? error.message : "Unknown processing error";
       return NextResponse.json({ error: "Failed to process user creation", details: message }, { status: 500 });
    }
  } // End user.created handler

  console.log(`Clerk event type ${eventType} received but no specific handler configured.`);
  return NextResponse.json({ success: true, message: `Event type ${eventType} received but no action needed.` });
}