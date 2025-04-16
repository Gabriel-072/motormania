// lib/email/sendPickConfirmation.ts

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendPickConfirmationParams {
  to: string;
  name: string;
  amount: number;
  mode: 'Full Throttle' | 'Safety Car';
  picks: {
    driver: string;
    line: number;
    betterOrWorse: 'mejor' | 'peor';
    session_type: 'qualy' | 'race';
  }[];
}

export async function sendPickConfirmationEmail({ to, name, amount, mode, picks }: SendPickConfirmationParams) {
  try {
    const pickRows = picks.map(
      (p) => `
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${p.driver}</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${p.session_type === 'qualy' ? 'Clasificación' : 'Carrera'}</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${p.line.toFixed(1)}</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${p.betterOrWorse === 'mejor' ? 'Mejor' : 'Peor'}</td>
        </tr>
      `
    ).join('');

    const { data, error } = await resend.emails.send({
      from: 'MotorManía <noreply@motormaniacolombia.com>',
      to: [to],
      subject: '✅ Confirmación de Picks - MotorManía',
      html: `
        <div style="font-family: sans-serif; color: #222;">
          <h2 style="color: #0ea5e9;">Tus Picks Han Sido Registrados</h2>
          <p>Hola <strong>${name}</strong>,</p>
          <p>Gracias por participar. Aquí tienes el resumen de tu jugada:</p>
          <ul>
            <li><strong>Modo:</strong> ${mode}</li>
            <li><strong>Depósito:</strong> $${amount.toLocaleString('es-CO')} COP</li>
            <li><strong>MMC Coins:</strong> ${Math.floor(amount / 1000)}</li>
            <li><strong>Fuel Coins:</strong> ${amount}</li>
          </ul>
          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 8px 12px; border: 1px solid #ccc;">Piloto</th>
                <th style="padding: 8px 12px; border: 1px solid #ccc;">Sesión</th>
                <th style="padding: 8px 12px; border: 1px solid #ccc;">Línea</th>
                <th style="padding: 8px 12px; border: 1px solid #ccc;">Pick</th>
              </tr>
            </thead>
            <tbody>
              ${pickRows}
            </tbody>
          </table>
          <p style="margin-top: 20px;">Puedes ver el resumen en tu <a href="https://motormaniacolombia.com/wallet" style="color: #0ea5e9;">billetera</a>.</p>
          <p>¡Buena suerte! 🏁</p>
        </div>
      `,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error('❌ Error enviando email de picks:', err);
    return null;
  }
}