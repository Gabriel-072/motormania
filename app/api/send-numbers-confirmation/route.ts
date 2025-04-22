import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY!;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL!;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET!;
const appName = "MotorManía";
const fromEmail = `MotorMania <noreply@motormaniacolombia.com>`;
const supportEmail = "soporte@motormaniacolombia.com";

const resend = new Resend(resendApiKey);

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  // 🔐 Authorization
  if (!token || token !== INTERNAL_API_SECRET) {
    console.warn("Unauthorized attempt to trigger email.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { to, name, numbers, context = 'registro', orderId, amount } = body;

    if (
      !to || !/\S+@\S+\.\S+/.test(to) ||
      !Array.isArray(numbers) || numbers.length === 0 ||
      !numbers.every(num => typeof num === 'string' && /^\d{6}$/.test(num))
    ) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 });
    }

    const userName = name || 'Usuario';
    const formattedAmount = typeof amount === 'number'
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount)
      : '';

    const listItemsHtml = numbers.map(num => `
      <li style="font-size: 18px; font-weight: bold; color: #1e293b; background-color: #e2e8f0; padding: 8px 12px; margin: 8px auto; border-radius: 4px; max-width: 100px; text-align: center; letter-spacing: 2px;">
        ${num}
      </li>`).join("");

    const subject = context === 'compra'
      ? `✅ Compra Confirmada - ${numbers.length} Números Extra ${appName}`
      : `🏆 Tus Números Gratis ¡Bienvenido a ${appName}!`;

    const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
      <h1 style="text-align: center; color: ${context === 'compra' ? '#16a34a' : '#f59e0b'};">
        ${context === 'compra' ? '¡Gracias por tu compra, ' : '¡Hola '}${userName}${context === 'compra' ? '!' : ', Bienvenido a MotorManía!'}
      </h1>
      <p style="font-size: 16px; text-align: center;">
        ${context === 'compra'
          ? `Hemos agregado ${numbers.length} números extra a tu cuenta para nuestros sorteos:`
          : `Estos son tus ${numbers.length} números iniciales GRATIS para participar en nuestros sorteos:`}
      </p>
      <ul style="list-style: none; padding: 0; text-align: center; margin: 25px 0;">
        ${listItemsHtml}
      </ul>
      ${orderId ? `<p style="font-size: 14px; text-align: center; color: #555;">Referencia Orden: ${orderId}</p>` : ''}
      ${formattedAmount ? `<p style="font-size: 14px; text-align: center; color: #555;">Monto: ${formattedAmount}</p>` : ''}
      <p style="text-align: center; margin-top: 25px;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          ${context === 'compra' ? 'Ver Dashboard' : 'Comprar Números Extra'}
        </a>
      </p>
      ${context === 'registro' ? `
        <p style="font-size: 16px; color: #555; text-align: center; margin-top: 20px;">🏎️ ¿Amas la F1?</p>
        <p style="text-align: center;">
          <a href="${appUrl}/jugar-y-gana" style="color: #0ea5e9;">¡Juega F1 Fantasy y gana premios!</a><br>
          <a href="${appUrl}/mmc-go" style="color: #8b5cf6; margin-top: 5px; display: inline-block;">Prueba también MMC-GO</a>
        </p>
      ` : ''}
      <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
        ${appName} | Bogotá D.C., Colombia | <a href="mailto:${supportEmail}" style="color: #999;">${supportEmail}</a>
      </footer>
    </div>`;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Email send failed:", error);
      return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id, to });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}