// 📁 /app/api/send-numbers-confirmation/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
    console.error("FATAL: RESEND_API_KEY environment variable is not set.");
    // Consider throwing an error during server startup in a real scenario
}
const resend = new Resend(resendApiKey);

// Optional security: Internal API secret
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || ''; // Define this in your .env

// Constants
const APP_NAME = "MotorManía";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://motormaniacolombia.com'; // Ensure this is correct
const FROM_EMAIL = "MotorMania <noreply@motormaniacolombia.com>"; // Use your verified Resend domain
const SUPPORT_EMAIL = "soporte@motormaniacolombia.com";

// --- POST Handler ---
export async function POST(req: Request) {
    // 1. Security Check (Optional but Recommended)
    const authorization = req.headers.get('Authorization');
    if (INTERNAL_API_SECRET && authorization !== `Bearer ${INTERNAL_API_SECRET}`) {
        console.warn("Unauthorized attempt to call send-numbers-confirmation API.");
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await req.json();

        // 2. Input Validation
        const { to, name, numbers, context, orderId, amount } = body;

        if (!to || !Array.isArray(numbers) || numbers.length === 0) {
            return NextResponse.json({ error: 'Missing required fields: to, numbers' }, { status: 400 });
        }
        if (!/\S+@\S+\.\S+/.test(to)) {
             return NextResponse.json({ error: 'Invalid email format for "to" field' }, { status: 400 });
        }
        // Ensure numbers are 6-digit strings
        if (!numbers.every(num => typeof num === 'string' && /^\d{6}$/.test(num))) {
             return NextResponse.json({ error: 'Invalid format in "numbers" array (should be array of 6-digit strings)' }, { status: 400 });
        }

        const userName = name || 'Usuario'; // Fallback name

        // 3. Prepare Email Content based on Context
        let subject = '';
        let htmlContent = '';
        const listItemsHtml = numbers.map((num) => `<li style="font-size: 18px; font-weight: bold; color: #1e293b; background-color: #e2e8f0; padding: 8px 12px; margin: 8px auto; border-radius: 4px; max-width: 100px; text-align: center; letter-spacing: 2px;">${num}</li>`).join("");
        const formattedAmount = amount ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount / 100) : ''; // Assuming amount is in cents if present

        if (context === 'compra') {
            subject = `✅ Compra Confirmada - ${numbers.length} Números Extra ${APP_NAME}!`;
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
                <a href="${APP_URL}/dashboard" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Dashboard</a>
              </p>
              <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
                ${APP_NAME} | Bogotá D.C., Colombia | <a href="mailto:${SUPPORT_EMAIL}" style="color: #999;">${SUPPORT_EMAIL}</a>
              </footer>
            </div>`;
        } else { // Default to 'registro'
            subject = `🏆 Tus Números Gratis ¡Bienvenido a ${APP_NAME}!`;
             htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
              <h1 style="color: #f59e0b; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">¡Hola ${userName}, Bienvenido a ${APP_NAME}!</h1>
              <p style="font-size: 16px; text-align: center;">Estos son tus ${numbers.length} números iniciales GRATIS para participar en nuestros sorteos:</p>
              <ul style="list-style: none; padding: 0; text-align: center; margin: 25px 0;">
                 ${listItemsHtml}
              </ul>
              <p style="font-size: 16px; text-align: center;">🎯 ¿Quieres más oportunidades?</p>
              <p style="text-align: center;">
                <a href="${APP_URL}/dashboard" style="display: inline-block; background-color: #eab308; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 5px;">Comprar Números Extra</a>
              </p>
               <p style="font-size: 16px; color: #555; text-align: center; margin-top: 20px;">🏎️ ¿Amas la F1?</p>
               <p style="text-align: center;">
                 <a href="${APP_URL}/jugar-y-gana" style="color: #0ea5e9;">¡Juega F1 Fantasy y gana premios!</a><br>
                 <a href="${APP_URL}/mmc-go" style="color: #8b5cf6; margin-top: 5px; display: inline-block;">Prueba también MMC-GO</a>
               </p>
              <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
                ${APP_NAME} | Bogotá D.C., Colombia | <a href="mailto:${SUPPORT_EMAIL}" style="color: #999;">${SUPPORT_EMAIL}</a>
              </footer>
            </div>`;
        }

        // --- 4. Send Email with Retry Logic ---
        let retries = 3;
        let lastError: Error | null = null;
        while (retries > 0) {
            try {
                 if (!resend) throw new Error("Resend client not initialized due to missing API key.");
                const { data, error } = await resend.emails.send({
                    from: FROM_EMAIL,
                    to: [to],
                    subject: subject,
                    html: htmlContent,
                });

                if (error) throw error; // Throw Resend error to be caught below

                console.log(`Email sent successfully via API to ${to}. ID: ${data?.id}. Context: ${context || 'registro'}`);
                return NextResponse.json({ success: true, message: `Email sent to ${to}`, id: data?.id });

            } catch (error: unknown) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`Email API: Send failed to ${to} (Retry ${4 - retries}/3). Error: ${lastError.message}`);
                retries--;
                if (retries > 0) {
                     await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries))); // Wait 1s, 2s, 3s
                }
            }
        }

        // If all retries failed
        console.error(`Email API: Failed permanently to ${to} after retries. Last Error:`, lastError);
        // Still return 500, but log that it's an email issue
        return NextResponse.json({ error: 'Failed to send confirmation email after multiple retries', details: lastError?.message }, { status: 500 });

    } catch (error: unknown) {
        console.error('Error processing send-numbers-confirmation request:', error);
        const message = error instanceof Error ? error.message : "Unknown internal server error";
        // Handle JSON parsing errors or other top-level errors
        if (message.includes('JSON')) {
             return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
    }
}