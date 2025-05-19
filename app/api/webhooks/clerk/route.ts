// 📄 /api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { Resend } from 'resend';  // ← Añadido

// ─── Env Vars & Constants ────────────────────────────────────────────────
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const INTERNAL_KEY = process.env.INTERNAL_API_KEY!;
const INITIAL_FREE_NUMBERS_COUNT = 5;
const SUPPORT_EMAIL = "soporte@motormaniacolombia.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY!;           // ← Añadido

// Instancia Resend
const resend = new Resend(RESEND_API_KEY);  // ← Añadido

// --- Startup Checks ---
if (!CLERK_WEBHOOK_SECRET) {
    console.error("FATAL ERROR: CLERK_WEBHOOK_SECRET env var is not set.");
}
if (!APP_URL) {
    console.error("FATAL ERROR: NEXT_PUBLIC_SITE_URL env var is not set.");
}
if (!INTERNAL_KEY) {
    console.error("FATAL ERROR: INTERNAL_API_KEY env var is not set.");
}
if (!RESEND_API_KEY) {
    console.error("FATAL ERROR: RESEND_API_KEY env var is not set.");
}

// ─── Types ───────────────────────────────────────────────────────────────
interface EmailAddress {
    email_address: string;
    id: string;
}
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

// ─── Main Handler ────────────────────────────────────────────────────────
export async function POST(req: Request) {
    const headerPayload = headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new NextResponse("Missing Svix headers", { status: 400 });
    }

    const rawBody = await req.text();
    const webhook = new Webhook(CLERK_WEBHOOK_SECRET);
    let event: ClerkWebhookPayload;

    try {
        event = webhook.verify(rawBody, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as ClerkWebhookPayload;
    } catch (err) {
        console.error("❌ Clerk webhook verification failed:", err);
        return new NextResponse("Invalid signature", { status: 400 });
    }

    const { type, data } = event;

    if (type === "user.created") {
        const { id: clerk_id, email_addresses, username, first_name, last_name } = data;
        const email = email_addresses?.[0]?.email_address;

        if (!email) {
            console.warn("⚠️ Email address missing for new Clerk user:", clerk_id);
            return new NextResponse("Email is required", { status: 400 });
        }

        const supabase = supabaseServer();
        const fullName = `${first_name || ""} ${last_name || ""}`.trim() || email.split("@")[0];
        const now = new Date().toISOString();

        const initialNumbers = Array.from({ length: INITIAL_FREE_NUMBERS_COUNT }, () =>
            Math.floor(100000 + Math.random() * 900000).toString()
        );

        try {
            // 1. Upsert to clerk_users
            await supabase.from("clerk_users").upsert({
                clerk_id,
                email,
                username,
                full_name: fullName,
                updated_at: now,
            }, { onConflict: 'clerk_id' });

            // 2. Upsert to entries table (initial free numbers)
            await supabase.from("entries").upsert({
                user_id: clerk_id,
                numbers: initialNumbers,
                paid_numbers_count: 0,
                name: fullName,
                email: email,
                region: "CO",
            }, { onConflict: "user_id" });

            // 3. Upsert to wallet table
            await supabase.from("wallet").upsert({
                user_id: clerk_id,
                mmc_coins: 0,
                fuel_coins: 0,
            }, { onConflict: "user_id" });

            // ─────────────────────────────────────────────────────────────────
            // 4. Suscribir el usuario en tu audiencia de Resend
            try {
                await resend.contacts.create({
                    email,
                    first_name: first_name || fullName,    // ← antes: firstName
                    last_name:  last_name  || "",          // ← antes: lastName
                    unsubscribed: false,
                    audience_id: "3381cef5-0859-46d8-bea7-9eda45804aba", 
                    });
            } catch (err) {
                console.error("⚠️ Error suscribiendo a Resend:", err);
                // No abortamos el flujo principal por un fallo en Resend
            }

            // 5. Send confirmation email
            const res = await fetch(`${APP_URL}/api/send-numbers-confirmation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-key': INTERNAL_KEY,
                },
                body: JSON.stringify({
                    to: email,
                    name: fullName,
                    numbers: initialNumbers,
                    context: 'registro',
                }),
            });

            if (!res.ok) {
                console.error("📧 Failed to send confirmation email:", await res.text());
            }

            return NextResponse.json({
                success: true,
                message: `✅ User ${clerk_id} initialized with ${INITIAL_FREE_NUMBERS_COUNT} numbers.`,
            });
        } catch (error) {
            console.error("🚨 Error processing Clerk user.created:", error);
            return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
        }
    }

    return NextResponse.json({ message: `🔔 Event ${type} received but not handled.` });
}