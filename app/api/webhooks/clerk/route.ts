// 📁 /app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server"; // Ensure helper creates client with Service Role Key
import { Resend } from "resend"; // Re-import Resend

// --- Initialize Resend Client (needed again here) ---
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  console.error("FATAL: RESEND_API_KEY environment variable is not set.");
}
const resend = new Resend(resendApiKey);


// Define payload structure explicitly for type safety (with corrected syntax)
interface EmailAddress {
  email_address: string;
  id: string;
}
interface UserCreatedData {
  id: string; // Clerk User ID
  username?: string | null;
  email_addresses: EmailAddress[]; // Corrected Array Type Syntax
  first_name?: string | null;
  last_name?: string | null;
}
interface ClerkWebhookPayload {
  type: 'user.created' | 'user.updated' | 'user.deleted' | string;
  data: UserCreatedData | any;
  object: 'event';
}

// --- Constants ---
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
const INITIAL_FREE_NUMBERS_COUNT = 5;
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://motormaniacolombia.com'; // Use production URL fallback


if (!CLERK_WEBHOOK_SECRET) {
    console.error("FATAL: CLERK_WEBHOOK_SECRET environment variable is not set.");
}

export async function POST(req: Request) {
  if (!CLERK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Server configuration error: Webhook secret missing' }, { status: 500 });
  }

  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Missing Svix headers', { status: 400 });
  }

  const rawBody = await req.text();
  let evt: ClerkWebhookPayload;
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  try {
    // Verify using rawBody (keeping this improvement)
    evt = wh.verify(rawBody, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookPayload;
  } catch (err: any) {
    console.error('Error verifying Clerk webhook signature:', err.message);
    return NextResponse.json({ 'Error': 'Webhook signature verification failed', details: err.message }, { status: 400 });
  }

  const eventType = evt.type;
  console.log(`Received Clerk webhook event: ${eventType}`);

  if (eventType === "user.created") {
    const userData = evt.data as UserCreatedData;
    const { id: clerk_id, username, email_addresses, first_name, last_name } = userData;
    const email = email_addresses?.[0]?.email_address;

    if (!email || !clerk_id) {
      console.error(`Clerk Webhook Error (user.created): Missing required data. UserID: ${clerk_id}, Email Found: ${!!email}`);
      return NextResponse.json({ error: "Required user data missing from Clerk payload" }, { status: 400 });
    }

    try {
      const fullName = `${first_name || ""} ${last_name || ""}`.trim() || email.split("@")[0];
      const now = new Date().toISOString();
      const supabase = supabaseServer();

      // 1. Upsert user into clerk_users (Keeping upsert here is generally safe if PK constraint exists)
      const { error: userUpsertError } = await supabase
        .from("clerk_users")
        .upsert({
          clerk_id: clerk_id,
          email: email,
          username: username || null,
          full_name: fullName,
          created_at: now,
          updated_at: now,
        }, { onConflict: 'clerk_id' }); // Assumes clerk_id is PK

      if (userUpsertError) {
        throw new Error(`Failed to sync user (${clerk_id}): ${userUpsertError.message}`);
      }
      console.log(`User ${clerk_id} synced to clerk_users.`);

      // 2. Generate initial 5 free numbers
      const initialNumbers = Array.from({ length: INITIAL_FREE_NUMBERS_COUNT }, () =>
        Math.floor(100000 + Math.random() * 900000).toString()
      );

      // 3. Insert initial entry - REVERTED TO INSERT
      // This avoids dependency on UNIQUE constraint on entries.user_id for now
      // Potential risk: If webhook retries, could create duplicate entries if initial insert failed partially.
      const { error: entriesInsertError, data: insertedEntries } = await supabase
        .from("entries")
        .insert({ // Using INSERT again like original code
          user_id: clerk_id,
          numbers: initialNumbers,
          paid_numbers_count: 0,
          name: fullName, // Denormalized
          email: email,   // Denormalized
          region: "CO",   // Original value
          created_at: now,
        })
        .select(); // Select to confirm insertion

      if (entriesInsertError) {
        // Check if it's a duplicate user_id error IF you DID add the UNIQUE constraint
         if (entriesInsertError.code === '23505' && entriesInsertError.message.includes('entries_user_id_key')) {
             console.warn(`Clerk Webhook Warning (Insert Entry ${clerk_id}): Entry already exists (likely webhook retry). Skipping insert.`);
             // Allow execution to continue to potentially send email again if needed, or just return success? Let's continue.
         } else {
            // Other insert error
            console.error(`Clerk Webhook DB Error (Insert Entry ${clerk_id}):`, entriesInsertError);
            throw new Error(`Failed to insert initial entries: ${entriesInsertError.message}`);
         }
      } else {
           console.log(`Initial entries inserted for user ${clerk_id}. Data:`, insertedEntries);
      }


      // 4. Insert Wallet entry - REVERTED TO INSERT (with original bonus logic for safety)
      // Assumes 'wallet' table might not have UNIQUE on user_id OR schema might be different in prod
      // Keeping original potentially non-functional bonus logic to match previously "working" state
      const bonusMMC = 5000;
      const bonusFuel = 2;
      const depositThreshold = 50000;
      const initialDeposit = 0;

      const { error: walletInsertError } = await supabase
        .from("wallet") // CONFIRM table name
        .insert({ // Using INSERT again
          user_id: clerk_id,       // CONFIRM column name
          mmc_balance: initialDeposit >= depositThreshold ? bonusMMC : 0, // Original logic
          fuel_balance: initialDeposit >= depositThreshold ? bonusFuel : 0, // Original logic
          created_at: now,
        });

       if (walletInsertError) {
            // Check if it's a duplicate user_id error IF you DID add the UNIQUE constraint
            if (walletInsertError.code === '23505' && walletInsertError.message.includes('wallet_user_id_key')) {
                 console.warn(`Clerk Webhook Warning (Insert Wallet ${clerk_id}): Wallet already exists (likely webhook retry). Skipping insert.`);
            }
            // Check for missing column error from previous logs
            else if (walletInsertError.message.includes("column \"fuel_balance\" of relation \"wallet\" does not exist")) {
                console.error(`Clerk Webhook DB Error (Insert Wallet ${clerk_id}): Missing 'fuel_balance' column in PRODUCTION DB!`, walletInsertError);
                // Don't throw, maybe wallet isn't critical? Or throw if it is. Let's just log for now.
            } else if (walletInsertError.message.includes("column \"mmc_balance\" of relation \"wallet\" does not exist")) {
                console.error(`Clerk Webhook DB Error (Insert Wallet ${clerk_id}): Missing 'mmc_balance' column in PRODUCTION DB!`, walletInsertError);
            }
             else {
                // Other insert error
                console.error(`Clerk Webhook DB Error (Insert Wallet ${clerk_id}):`, walletInsertError);
                // Decide if this is critical enough to stop processing
                // Let's log and continue for now, prioritizing user/entry creation.
            }
       } else {
            console.log(`Wallet entry created for user ${clerk_id}.`);
       }

      // 5. Send Welcome Email DIRECTLY using Resend (Reverted Logic)
      let retries = 3;
      let emailError: Error | null = null; // Define type for lastError
      while (retries > 0) {
          try {
              if (!resend) throw new Error("Resend client not initialized (API Key missing?)");
              const { data: emailData, error: resendError } = await resend.emails.send({ // Use different error var name
                  from: `MotorMania <noreply@motormaniacolombia.com>`, // Use configured FROM
                  to: [email],
                  subject: "Tus Números, bienvenido a MotorMania!",
                  // Using original simple HTML structure for now
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
                      <h1 style="color: #f59e0b; text-align: center;">🏆 ¡Hola ${fullName}!</h1>
                      <p style="font-size: 16px; color: #555; text-align: center;">Tus números para el sorteo del LEGO McLaren P1 son:</p>
                      <ul style="list-style: none; padding: 0; text-align: center; margin: 20px 0;">
                        ${initialNumbers.map((num) => `<li style="font-size: 18px; color: #333; margin: 10px 0;">${num}</li>`).join("")}
                      </ul>
                      <p style="font-size: 16px; color: #555; text-align: center;">🎯 ¿Quieres más oportunidades?</p>
                      <p style="text-align: center; margin-bottom: 8px;"><a href="${APP_URL}/dashboard?extra=true" style="color: #0ea5e9;">Agrega 5 números adicionales por solo $5.000 COP</a></p>
                      <p style="font-size: 16px; color: #555; text-align: center;">🏎️ ¿Amas la F1?</p>
                      <p style="text-align: center; margin-bottom: 8px;"><a href="${APP_URL}/mmc-go" style="color: #0ea5e9;">Haz predicciones con MMC-GO y gana premios</a></p>
                      <p style="text-align: center; margin-bottom: 8px;"><a href="${APP_URL}/dashboard" style="color: #0ea5e9;">Ver tus números en el dashboard</a></p>
                      <footer style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                        MotorMania SAs | Bogotá D.C., Colombia | <a href="mailto:${SUPPORT_EMAIL}" style="color: #999;">${SUPPORT_EMAIL}</a>
                      </footer>
                    </div>
                  `,
              });

              if (resendError) throw resendError; // Throw error to be caught by outer try/catch

              console.log(`Welcome email sent successfully to ${email}. ID: ${emailData?.id}`);
              emailError = null; // Clear error on success
              break; // Exit retry loop on success

          } catch (error: unknown) {
              emailError = error instanceof Error ? error : new Error(String(error));
              console.error(`Email failed to ${email}, retrying... (${retries} left). Error: ${emailError.message}`);
              retries--;
              if (retries > 0) {
                   await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
              }
          }
      } // End while retries

      if (emailError) {
        // Log final email failure but don't necessarily fail the whole webhook response
        console.error(`Welcome email failed permanently to ${email} after retries:`, emailError);
        // Decide if this should return 500 or still 200. Let's return 200 but log the error.
      }

      // --- User Created processing finished ---
      // Return success even if email potentially failed but DB operations succeeded
      return NextResponse.json({ success: true, message: `User ${clerk_id} processed. Email status logged.` });

    } catch (error) {
       // Catch errors from DB operations or other processing steps
       console.error(`Error processing user.created for Clerk ID ${clerk_id || 'UNKNOWN'}:`, error);
       const message = error instanceof Error ? error.message : "Unknown processing error";
       return NextResponse.json({ error: "Failed to process user creation", details: message }, { status: 500 });
    }
  } // --- End Handle User Creation ---

  // Fallback for unhandled event types
  console.log(`Clerk webhook event type ${eventType} received but no processing configured.`);
  return NextResponse.json({ success: true, message: `Event type ${eventType} received but no action configured.` });
}