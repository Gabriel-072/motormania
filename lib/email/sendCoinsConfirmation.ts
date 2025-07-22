// /lib/email/sendCoinsConfirmation.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendConfirmationEmailParams {
  to: string;
  amount: number;
  mmc: number;
  fc: number;
}

export async function sendCoinsConfirmationEmail({ to, amount, mmc, fc }: SendConfirmationEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'MotorManía <noreply@motormania.app>',
      to: [to],
      subject: '✅ Confirmación de Recarga - MotorManía',
      html: `
        <div style="font-family: sans-serif; color: #222;">
          <h2 style="color: #0ea5e9;">Recarga Exitosa</h2>
          <p>Has recibido <strong>${mmc} MMC Coins</strong> y <strong>${fc.toLocaleString('es-CO')} Fuel Coins</strong> por tu depósito de <strong>$${amount.toLocaleString('es-CO')} COP</strong>.</p>
          <p>Revisa el detalle completo en tu <a href="https://motormania.app/wallet" style="color: #0ea5e9;">billetera</a>.</p>
          <p>Gracias por divertirte con MotorManía. 🏎️</p>
        </div>
      `,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error('❌ Error enviando email de recarga:', err);
    return null;
  }
}
