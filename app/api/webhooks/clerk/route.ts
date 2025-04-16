import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface ClerkWebhookPayload {
  type: string;
  data: {
    id: string;
    username?: string;
    email_addresses: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
  };
}

export async function POST(req: Request) {
  const headerList = await headers();

  try {
    const payload = await req.json();
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
    const svix_id = headerList.get("svix-id");
    const svix_timestamp = headerList.get("svix-timestamp");
    const svix_signature = headerList.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: "Invalid headers" }, { status: 400 });
    }

    const verifiedPayload = wh.verify(JSON.stringify(payload), {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookPayload;

    if (verifiedPayload.type === "user.created") {
      const { id: clerk_id, username, email_addresses, first_name, last_name } = verifiedPayload.data;
      const email = email_addresses[0]?.email_address;
      if (!email) {
        throw new Error("No email address provided");
      }

      const fullName = `${first_name || ""} ${last_name || ""}`.trim() || email.split("@")[0];

      const { error: userError } = await supabaseServer()
        .from("clerk_users")
        .upsert({
          clerk_id,
          email,
          username: username || null,
          full_name: fullName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (userError) {
        throw new Error(`Failed to sync user: ${userError.message}`);
      }

      const numbers = Array.from({ length: 5 }, () =>
        Math.floor(100000 + Math.random() * 900000).toString()
      );

      const { error: entriesError, data: insertedEntries } = await supabaseServer()
        .from("entries")
        .insert({
          user_id: clerk_id,
          numbers,
          name: fullName,
          email,
          created_at: new Date().toISOString(),
          region: "CO",
        })
        .select();

      if (entriesError) {
        throw new Error(`Failed to insert entries: ${entriesError.message}`);
      }

      // Wallet creation with logic for initial bonus if required
      const bonusMMC = 5000;
      const bonusFuel = 2;
      const depositThreshold = 50000;
      const initialDeposit = 0; // Change if logic involves first deposit detection

      await supabaseServer()
        .from("wallet")
        .insert({
          user_id: clerk_id,
          mmc_balance: initialDeposit >= depositThreshold ? bonusMMC : 0,
          fuel_balance: initialDeposit >= depositThreshold ? bonusFuel : 0,
          created_at: new Date().toISOString(),
        });

      // Send welcome email
      let retries = 3;
      let emailError = null;
      while (retries > 0) {
        const { data: emailData, error } = await resend.emails.send({
          from: "MotorMania <noreply@motormaniacolombia.com>",
          to: [email],
          subject: "Tus Números, bienvenido a MotorMania!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
              <h1 style="color: #f59e0b; text-align: center;">🏆 ¡Hola ${fullName}!</h1>
              <p style="font-size: 16px; color: #555; text-align: center;">Tus números para el sorteo del LEGO McLaren P1 son:</p>
              <ul style="list-style: none; padding: 0; text-align: center; margin: 20px 0;">
                ${numbers.map((num) => `<li style="font-size: 18px; color: #333; margin: 10px 0;">${num}</li>`).join("")}
              </ul>
              <p style="font-size: 16px; color: #555; text-align: center;">🎯 ¿Quieres más oportunidades?</p>
              <p style="text-align: center; margin-bottom: 8px;"><a href="https://motormaniacolombia.com/dashboard?extra=true" style="color: #0ea5e9;">Agrega 5 números adicionales por solo $5.000 COP</a></p>
              <p style="font-size: 16px; color: #555; text-align: center;">🏎️ ¿Amas la F1?</p>
              <p style="text-align: center; margin-bottom: 8px;"><a href="https://motormaniacolombia.com/mmc-go" style="color: #0ea5e9;">Haz predicciones con MMC-GO y gana premios</a></p>
              <p style="text-align: center; margin-bottom: 8px;"><a href="https://motormaniacolombia.com/dashboard" style="color: #0ea5e9;">Ver tus números en el dashboard</a></p>
              <footer style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                MotorMania SAs | Bogotá D.C., Colombia | <a href="mailto:soporte@motormaniacolombia.com" style="color: #999;">soporte@motormaniacolombia.com</a>
              </footer>
            </div>
          `,
        });

        if (!error) {
          console.log("Email sent successfully:", emailData);
          break;
        }
        emailError = error;
        console.error(`Email failed, retrying... (${retries})`, error);
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (emailError) {
        console.error("Email failed after retries:", emailError);
      }

      return NextResponse.json({ success: true, insertedEntries });
    }

    return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
  } catch (error: any) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
