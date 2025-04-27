// 📁 /app/api/send-pick-confirmation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { checkInternalKey } from '@/lib/checkInternalKey'; // Reutiliza el helper
import { PickSelection } from '@/app/types/picks'; // Ajusta ruta si es necesario

// --- Environment Variables & Constants ---
const resendApiKey = process.env.RESEND_API_KEY;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL;
const appName = "MotorManía";
const fromEmail = `MotorMania <noreply@motormaniacolombia.com>`;
const supportEmail = "soporte@motormaniacolombia.com";

// --- Startup Checks ---
if (!resendApiKey) { console.error("FATAL ERROR: RESEND_API_KEY not set."); }
if (!appUrl) { console.error("FATAL ERROR: NEXT_PUBLIC_SITE_URL not set."); }

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// --- POST Handler ---
export async function POST(req: NextRequest) {
    console.log("API Route: /api/send-pick-confirmation invoked.");

    // 1. ✅ Verificación con Clave Interna
    if (!checkInternalKey(req)) {
        console.warn("Unauthorized attempt to call send-pick-confirmation API (Invalid Key).");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log("Internal API Key verified for send-pick-confirmation.");

    if (!resend) { return NextResponse.json({ error: 'Email service config error' }, { status: 500 }); }
    if (!appUrl) { return NextResponse.json({ error: 'App URL config error' }, { status: 500 }); }

    try {
        const body = await req.json();
        console.log("Pick Email API Body:", JSON.stringify(body));

        // 2. Input Validation
        const { to, name, amount, mode, picks, orderId } = body;
        if (!to || !Array.isArray(picks) || picks.length === 0 || !/\S+@\S+\.\S+/.test(to)) {
            console.error("Pick Email API Validation Error: Invalid input.", { to, picks });
            return NextResponse.json({ error: 'Invalid input data for pick confirmation' }, { status: 400 });
        }
        const userName = name || 'Jugador';
        const wagerAmount = typeof amount === 'number' ? amount : 0;
        const formattedWager = wagerAmount > 0 ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(wagerAmount) : 'N/A';
        const gameMode = mode === 'full' ? 'Full Throttle' : 'Safety Car';

        // 3. Prepare Email Content
        const subject = `✅ Tus Picks de MMC GO (${orderId?.slice(-6)}) ¡Confirmados!`;
        const picksHtml = (picks as PickSelection[]).map(p => `
            <li style="margin-bottom: 8px; padding: 6px 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-weight: bold; display: block;">${p.driver}</span>
                    <span style="font-size: 0.8em; color: #666;">(${p.session_type === 'qualy' ? 'Q' : 'R'} ${p.line.toFixed(1)})</span>
                </div>
                <strong style="color: ${p.betterOrWorse === 'mejor' ? '#16a34a' : '#dc2626'}; font-size: 0.9em;">
                    ${p.betterOrWorse === 'mejor' ? 'MEJOR' : 'PEOR'}
                </strong>
            </li>
        `).join("");

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
              <h1 style="color: #8b5cf6; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">¡Jugada Confirmada, ${userName}!</h1>
              <p style="font-size: 16px; text-align: center;">Tus picks para MMC GO han sido registrados con éxito:</p>
              <p style="font-size: 14px; text-align: center; color: #555;">Referencia: ${orderId || 'N/A'}</p>
              <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 5px;">
                  <h2 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #4b5563; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Resumen de tu Jugada</h2>
                  <p style="margin: 5px 0; font-size: 14px;"><span style="color: #6b7280;">Monto Apostado:</span> <strong style="float: right;">${formattedWager}</strong></p>
                  <p style="margin: 5px 0; font-size: 14px;"><span style="color: #6b7280;">Modo de Juego:</span> <strong style="float: right;">${gameMode}</strong></p>
                  <h3 style="margin-top: 15px; margin-bottom: 5px; font-size: 15px; color: #4b5563;">Picks Seleccionados (${picks.length}):</h3>
                  <ul style="list-style: none; padding: 0; margin: 0;">
                      ${picksHtml}
                  </ul>
              </div>
              <p style="text-align: center; margin-top: 25px;">
                <a href="${appUrl}/mmc-go" style="display: inline-block; background-color: #8b5cf6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver MMC GO</a>
              </p>
              <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
                ${appName} | Bogotá D.C., Colombia | <a href="mailto:${supportEmail}" style="color: #999;">${supportEmail}</a>
              </footer>
            </div>`;

        // 4. Send Email with Retry Logic
        let retries = 3; let lastError: Error | null = null;
        while (retries > 0) { /* ... (Pega la misma lógica while con resend.emails.send que en send-numbers-confirmation) ... */
             try { console.log(`Pick Email API: Attempt send to ${to} (Attempt ${4-retries}/3)`); const { data, error } = await resend.emails.send({ from: fromEmail, to: [to], subject: subject, html: htmlContent, }); if (error) throw error; console.log(`Pick Email API: Sent successfully to ${to}. ID: ${data?.id}`); return NextResponse.json({ success: true, id: data?.id }); } catch (error: unknown) { lastError = error instanceof Error ? error : new Error(String(error)); console.error(`Pick Email API: Send failed to ${to} (Retry ${4-retries}/3). Error: ${lastError.message}`); retries--; if (retries > 0) { await new Promise(r => setTimeout(r, 1000*(4-retries))); } }
        }
        console.error(`Pick Email API: Failed permanently to ${to}. Last Error:`, lastError); return NextResponse.json({ error: 'Failed to send pick confirmation email', details: lastError?.message }, { status: 500 });

    } catch (error: unknown) { /* ... (Manejo de errores general igual que en send-numbers-confirmation) ... */ console.error('Pick Email API: Error processing request:', error); const message=error instanceof Error?error.message:"Unknown error"; if(message.includes('JSON')){return NextResponse.json({error:'Invalid body'},{status:400});} return NextResponse.json({error:'Internal Server Error',details:message},{status:500}); }
}