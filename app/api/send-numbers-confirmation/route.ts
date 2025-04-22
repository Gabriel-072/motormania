// 📁 /app/api/send-numbers-confirmation/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// --- Environment Variables & Constants ---
const resendApiKey = process.env.RESEND_API_KEY;
const internalApiSecret = process.env.INTERNAL_API_SECRET || ''; // Optional but recommended
const appUrl = process.env.NEXT_PUBLIC_SITE_URL; // Production URL - CRITICAL
const appName = "MotorManía";
const fromEmail = `MotorMania <noreply@motormaniacolombia.com>`; // Use your verified Resend domain
const supportEmail = "soporte@motormaniacolombia.com";

// --- Startup Checks ---
if (!resendApiKey) {
    console.error("FATAL ERROR: RESEND_API_KEY environment variable is not set.");
}
if (!appUrl) {
    console.error("FATAL ERROR: NEXT_PUBLIC_SITE_URL environment variable is not set.");
}
if (!internalApiSecret) {
    console.warn("WARN: INTERNAL_API_SECRET is not set. Internal API calls will not be secured.");
}

// Initialize Resend client (only if API key exists)
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// --- POST Handler ---
export async function POST(req: Request) {
    console.log("API Route: /api/send-numbers-confirmation invoked.");

    // 1. Security Check (Optional but Recommended)
    const authorization = req.headers.get('Authorization');
    if (internalApiSecret && authorization !== `Bearer ${internalApiSecret}`) {
        console.warn("API Route send-numbers-confirmation: Unauthorized attempt.");
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if Resend client is initialized
    if (!resend) {
         console.error("Email API Error: Resend client not initialized (Missing API Key).");
         return NextResponse.json({ error: 'Email service configuration error' }, { status: 500 });
    }
     // Check if APP_URL is configured (needed for links in email)
     if (!appUrl) {
        console.error("Email API Error: NEXT_PUBLIC_SITE_URL is not configured.");
        return NextResponse.json({ error: 'Application URL configuration error' }, { status: 500 });
    }

    try {
        const body = await req.json();
        console.log("Email API Body:", JSON.stringify(body)); // Log received body

        // 2. Input Validation
        const { to, name, numbers, context, orderId, amount } = body;
        if (!to || !Array.isArray(numbers) || numbers.length === 0 || !/\S+@\S+\.\S+/.test(to) || !numbers.every(num => typeof num === 'string' && /^\d{6}$/.test(num)) ) {
            console.error("Email API Validation Error: Invalid input.", { to, numbers });
            return NextResponse.json({ error: 'Invalid input: Requires valid "to" email and "numbers" array (6-digit strings).' }, { status: 400 });
        }
        const userName = name || 'Usuario';

        // 3. Prepare Email Content
        let subject = '';
        let htmlContent = '';
        const listItemsHtml = numbers.map((num) => `<li style="font-size: 18px; font-weight: bold; color: #1e293b; background-color: #e2e8f0; padding: 8px 12px; margin: 8px auto; border-radius: 4px; max-width: 100px; text-align: center; letter-spacing: 2px;">${num}</li>`).join("");
        const numericAmount = typeof amount === 'number' ? amount : 0;
        // VERIFY if amount from Bold is base unit (2000) or cents (200000) for $2000 COP
        const formattedAmount = numericAmount > 0 ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(numericAmount) : ''; // Assuming base unit for now

        if (context === 'compra') {
            subject = `✅ Compra Confirmada - ${numbers.length} Números Extra ${appName}!`;
            htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
              <h1 style="color: #16a34a; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">¡Gracias por tu compra, ${userName}!</h1>
              <p style="font-size: 16px; text-align: center;">Hemos agregado ${numbers.length} números extra a tu cuenta para nuestros sorteos:</p>
              <ul style="list-style: none; padding: 0; text-align: center; margin: 25px 0;">
                ${listItemsHtml}
              </ul>
              ${orderId ? `<p style="font-size: 14px; color: #555; text-align: center;">Referencia Orden: ${orderId}</p>` : ''}
              ${formattedAmount ? `<p style="font-size: 14px; color: #555; text-align: center;">Monto: ${formattedAmount}</p>` : ''}
              <p style="text-align: center; margin-top: 25px;">
                <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Dashboard</a>
              </p>
              <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
                ${appName} | Bogotá D.C., Colombia | <a href="mailto:${supportEmail}" style="color: #999;">${supportEmail}</a>
              </footer>
            </div>`;
        } else { // Default to 'registro'
            subject = `🏆 Tus Números Gratis ¡Bienvenido a ${appName}!`;
             htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
              <h1 style="color: #f59e0b; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">¡Hola ${userName}, Bienvenido a ${appName}!</h1>
              <p style="font-size: 16px; text-align: center;">Estos son tus ${numbers.length} números iniciales GRATIS para participar en nuestros sorteos:</p>
              <ul style="list-style: none; padding: 0; text-align: center; margin: 25px 0;">
                 ${listItemsHtml}
              </ul>
              <p style="font-size: 16px; text-align: center;">🎯 ¿Quieres más oportunidades?</p>
              <p style="text-align: center;">
                <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #eab308; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 5px;">Comprar Números Extra</a>
              </p>
               <p style="font-size: 16px; color: #555; text-align: center; margin-top: 20px;">🏎️ ¿Amas la F1?</p>
               <p style="text-align: center;">
                 <a href="${appUrl}/jugar-y-gana" style="color: #0ea5e9;">¡Juega F1 Fantasy y gana premios!</a><br>
                 <a href="${appUrl}/mmc-go" style="color: #8b5cf6; margin-top: 5px; display: inline-block;">Prueba también MMC-GO</a>
               </p>
              <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
                ${appName} | Bogotá D.C., Colombia | <a href="mailto:${supportEmail}" style="color: #999;">${supportEmail}</a>
              </footer>
            </div>`;
        }

        // --- 4. Send Email with Retry Logic ---
        let retries = 3;
        let lastError: Error | null = null;
        while (retries > 0) {
            try {
                console.log(`Email API: Attempting send to ${to} (Attempt ${4 - retries}/3) Context: ${context}`);
                const { data, error } = await resend.emails.send({
                    from: fromEmail, to: [to], subject: subject, html: htmlContent,
                });
                if (error) throw error; // Throw Resend error
                console.log(`Email API: Sent successfully to ${to}. Resend ID: ${data?.id}`);
                return NextResponse.json({ success: true, message: `Email sent to ${to}`, id: data?.id });
            } catch (error: unknown) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`Email API: Send failed to ${to} (Retry ${4 - retries}/3). Error: ${lastError.message}`);
                retries--;
                if (retries > 0) { await new Promise(r => setTimeout(r, 1000*(4-retries))); }
            }
        }
        console.error(`Email API: Failed permanently to ${to} after retries. Last Error:`, lastError);
        return NextResponse.json({ error: 'Failed to send email after multiple retries', details: lastError?.message }, { status: 500 });

    } catch (error: unknown) {
        console.error('Email API: Error processing request:', error);
        const message = error instanceof Error ? error.message : "Unknown internal server error";
        if (message.includes('JSON')) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
        return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
    }
}