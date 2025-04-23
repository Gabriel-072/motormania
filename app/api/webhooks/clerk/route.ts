import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// ─── Environment Variables ───────────────────────────────────────────────
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const INITIAL_FREE_NUMBERS_COUNT = 5;
const SUPPORT_EMAIL = "soporte@motormaniacolombia.com";

// ─── Interfaces ───────────────────────────────────────────────────────────
interface EmailAddress { email_address: string; id: string; }
interface UserCreatedData {
  id: string;
  username?: string | null;
  email_addresses: EmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
}
interface ClerkWebhookPayload {
  type: string;
  data: UserCreatedData;
  object: 'event';
}

// ─── Webhook Handler ─────────────────────────────────────────────────────
export async function POST(req: Request) {
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse("Missing Svix headers", { status: 400 });
  }

  const rawBody = await req.text();
  let evt: ClerkWebhookPayload;
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  try {
    evt = wh.verify(rawBody, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookPayload;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const { type, data } = evt;

  if (type === "user.created") {
    const { id: clerk_id, email_addresses, username, first_name, last_name } = data;
    const email = email_addresses?.[0]?.email_address;
    if (!email) return new NextResponse("Email is required", { status: 400 });

    const supabase = supabaseServer();
    const fullName = `${first_name || ""} ${last_name || ""}`.trim() || email.split("@")[0];
    const now = new Date().toISOString();

    const initialNumbers = Array.from({ length: INITIAL_FREE_NUMBERS_COUNT }, () =>
      Math.floor(100000 + Math.random() * 900000).toString()
    );

    try {
      await supabase.from("clerk_users").upsert({
        clerk_id, email, username, full_name: fullName, updated_at: now,
      }, { onConflict: 'clerk_id' });

      await supabase.from("entries").upsert({
        user_id: clerk_id,
        numbers: initialNumbers,
        paid_numbers_count: 0,
        name: fullName,
        email: email,
        region: "CO",
      }, { onConflict: "user_id" });

      await supabase.from("wallet").upsert({
        user_id: clerk_id,
        mmc_coins: 0,
        fuel_coins: 0,
      }, { onConflict: "user_id" });

      // 🔐 Updated to use Referer instead of Authorization
      await fetch(`${APP_URL}/api/send-numbers-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': APP_URL,
        },
        body: JSON.stringify({
          to: email,
          name: fullName,
          numbers: initialNumbers,
          context: 'registro',
        }),
      });

      return NextResponse.json({ success: true, message: `User ${clerk_id} created and initialized.` });
    } catch (error) {
      console.error("Error processing user.created:", error);
      return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
    }
  }

  return NextResponse.json({ message: `Event type ${type} received but not handled.` });
}