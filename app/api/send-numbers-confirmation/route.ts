// 📁 /app/api/send-numbers-confirmation/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
    console.error("FATAL: RESEND_API_KEY environment variable is not set.");
    // Avoid running without API key
    // throw new Error("Resend API Key is missing.");
}
// Initialize only if key exists
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Optional security: Internal API secret
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || ''; // Define this in your .env

// Constants
const APP_NAME = "MotorManía";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://motormaniacolombia.com';
const FROM_EMAIL = "MotorMania <noreply@motormaniacolombia.com>"; // Use your verified Resend domain
const SUPPORT_EMAIL = "soporte@motormaniacolombia.com";

// --- POST Handler ---
export async function POST(req: Request) {
    console.log("Received request for /api/send-numbers-confirmation"); // Log entry

    // 1. Security Check
    const authorization = req.headers.get('Authorization');
    if (INTERNAL_API_SECRET && authorization !== `Bearer ${INTERNAL_API_SECRET}`) {
        console.warn("Unauthorized attempt to call send-numbers-confirmation API.");
        return new NextResponse('Unauthorized', { status: 401 });
    } else if (INTERNAL_API_SECRET) {
        console.log("Internal API Secret verified.");
    } else {
        console.warn("INTERNAL_API_SECRET not set, skipping verification.");
    }

    if (!resend) {
         console.error("Email API Error: Resend client not initialized (Missing API Key).");
         return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    try {
        const body = await req.json();
        console.log("Parsed request body:", body);

        // 2. Input Validation
        const { to, name, numbers, context, orderId, amount } = body;

        if (!to || !Array.isArray(numbers) || numbers.length === 0) {
            console.error("Validation Error: Missing 'to' or 'numbers'.", {to, numbers});
            return NextResponse.json({ error: 'Missing required fields: to, numbers' }, { status: 400 });
        }
        if (!/\S+@\S+\.\S+/.test(to)) {
             console.error(`Validation Error: Invalid email format for 'to': ${to}`);
             return NextResponse.json({ error: 'Invalid email format for "to" field' }, { status: 400 });
        }
        if (!numbers.every(num => typeof num === 'string' && /^\d{6}$/.test(num))) {
             console.error(`Validation Error: Invalid format in 'numbers' array.`, numbers);
             return NextResponse.json({ error: 'Invalid format in "numbers" array (should be array of 6-digit strings)' }, { status: 400 });
        }

        const userName = name || 'Usuario'; // Fallback name

        // 3. Prepare Email Content based on Context
        let subject = '';
        let htmlContent = '';
        const listItemsHtml = numbers.map((num) => `<li style="font-size: 18px; font-weight: bold; color: #1e293b; background-color: #e2e8f0; padding: 8px 12px; margin: 8px auto; border-radius: 4px; max-width: 100px; text-align: center; letter-spacing: 2px;">${num}</li>`).join("");
        // Ensure amount is treated as number if present, default to 0 if not for formatting
        const numericAmount = typeof amount === 'number' ? amount : 0;
        // Format only if amount > 0, assuming it's in lowest unit (e.g., cents for COP? CHECK THIS)
        // If price is 2000 COP, Bold sends 200000? Verify Bold payload amount format. Assuming it's base units here.
        const formattedAmount = numericAmount > 0 ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(numericAmount) : '';

        console.log(`Preparing email. Context: ${context}, To: ${to}, Name: ${userName}, Number Count: ${numbers.length}`);

        if (context === 'compra') {
            subject = `✅ Compra Confirmada - ${numbers.length} Números Extra ${APP_NAME}!`;
            // HTML for purchase... (kept same as before)
            htmlContent = `...`; // (Copy HTML from previous response)
        } else { // Default to 'registro'
            subject = `🏆 Tus Números Gratis ¡Bienvenido a ${APP_NAME}!`;
             // HTML for registration... (kept same as before)
             htmlContent = `...`; // (Copy HTML from previous response)
        }

        // --- 4. Send Email with Retry Logic ---
        let retries = 3;
        let lastError: Error | null = null;
        while (retries > 0) {
            try {
                console.log(`Attempting to send email to ${to} (Attempt ${4 - retries}/3)`);
                const { data, error } = await resend.emails.send({
                    from: FROM_EMAIL, to: [to], subject: subject, html: htmlContent,
                });

                if (error) throw error; // Throw Resend error

                console.log(`Email sent successfully via API to ${to}. Resend ID: ${data?.id}. Context: ${context || 'registro'}`);
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

        console.error(`Email API: Failed permanently to ${to} after retries. Last Error:`, lastError);
        // Respond 500 if email ultimately fails
        return NextResponse.json({ error: 'Failed to send confirmation email after multiple retries', details: lastError?.message }, { status: 500 });

    } catch (error: unknown) {
        console.error('Error processing send-numbers-confirmation request:', error);
        const message = error instanceof Error ? error.message : "Unknown internal server error";
        if (message.includes('JSON')) {
             return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
    }
}