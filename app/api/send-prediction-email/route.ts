// app/api/send-prediction-email/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { userEmail, userName, predictions, gpName } = await request.json();
    console.log('Prediction Email Request Payload:', { userEmail, userName, predictions, gpName });

    if (!userEmail || !userName || !predictions || !gpName) {
      console.error('Missing required fields:', { userEmail, userName, predictions, gpName });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment');
      return NextResponse.json({ error: 'Email service configuration missing' }, { status: 500 });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width:600px; margin:20px auto; padding:20px; background:#fff; border:1px solid #ddd; border-radius:8px;">
        <h1 style="text-align:center; color:#f59e0b; margin-bottom:10px;">
          🏁 ¡Predicciones enviadas para ${gpName}!
        </h1>
        <p style="color:#555; font-size:16px; margin-bottom:20px;">
          ¡Gracias por jugar, <strong>${userName}</strong>! Aquí tu resumen:
        </p>

        <div style="font-size:15px; line-height:1.4; color:#1e293b; margin-bottom:20px;">
          <p><strong>🏆 Qualifying:</strong> ${predictions.pole1 || '–'}, ${predictions.pole2 || '–'}, ${predictions.pole3 || '–'}</p>
          <p><strong>🏁 Race:</strong> ${predictions.gp1 || '–'}, ${predictions.gp2 || '–'}, ${predictions.gp3 || '–'}</p>
          <p><strong>⭐ Extras:</strong>
            Pit Stop: ${predictions.fastest_pit_stop_team || '–'} ·
            Vuelta Rápida: ${predictions.fastest_lap_driver || '–'} ·
            Piloto del Día: ${predictions.driver_of_the_day || '–'}
          </p>
        </div>

        <a href="https://www.instagram.com/motormaniacolombia/"
           style="display:block; text-align:center; background:#E1306C; color:#fff; padding:14px; text-decoration:none; border-radius:5px; font-size:16px; font-weight:bold;">
          🌟 Síguenos en Instagram
        </a>

        <footer style="margin-top:30px; font-size:12px; color:#999; text-align:center; border-top:1px solid #eee; padding-top:15px;">
          MotorManía Colombia | Bogotá D.C. | <a href="mailto:soporte@motormaniacolombia.com" style="color:#999;">soporte@motormaniacolombia.com</a>
        </footer>
      </div>
    `;

    const text = `
¡Hola ${userName}!

¡Tus predicciones para el ${gpName} han sido enviadas!

Qualifying: ${predictions.pole1 || '–'}, ${predictions.pole2 || '–'}, ${predictions.pole3 || '–'}
Race: ${predictions.gp1 || '–'}, ${predictions.gp2 || '–'}, ${predictions.gp3 || '–'}
Extras: Pit Stop: ${predictions.fastest_pit_stop_team || '–'} · Vuelta Rápida: ${predictions.fastest_lap_driver || '–'} · Piloto del Día: ${predictions.driver_of_the_day || '–'}

🌟 Síguenos en Instagram: https://www.instagram.com/motormaniacolombia/
    `;

    const { data, error } = await resend.emails.send({
      from: 'MotorMania <noreply@motormaniacolombia.com>',
      to: [userEmail],
      subject: `¡Tus Predicciones para el ${gpName} han sido enviadas!`,
      html,
      text,
    });

    if (error) {
      console.error('Error sending prediction confirmation email:', error);
      return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
    }

    console.log('Prediction confirmation email sent successfully:', data);
    return NextResponse.json({ success: true, emailId: data?.id }, { status: 200 });
  } catch (err) {
    console.error('Unexpected error in send-prediction-email route:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}