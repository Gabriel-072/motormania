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
      🏁 ¡Tus Predicciones para el ${gpName}!
    </h1>
    <p style="text-align:center; color:#555; font-size:16px; margin-bottom:25px;">
      Gracias por jugar con MotorManía, <strong>${userName}</strong>. Así quedaron tus selecciones:
    </p>

    <!-- Qualifying -->
    <h2 style="color:#1e293b; font-size:18px; margin-bottom:8px;">🏆 Qualifying (Pole)</h2>
    <ul style="list-style:none; padding:0 0 20px 0; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px; text-align:center;">
        1. ${predictions.pole1 || 'No seleccionado'}
      </li>
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px; text-align:center;">
        2. ${predictions.pole2 || 'No seleccionado'}
      </li>
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px; text-align:center;">
        3. ${predictions.pole3 || 'No seleccionado'}
      </li>
    </ul>

    <!-- Race -->
    <h2 style="color:#1e293b; font-size:18px; margin-bottom:8px;">🏁 Race (GP)</h2>
    <ul style="list-style:none; padding:0 0 20px 0; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px; text-align:center;">
        1. ${predictions.gp1 || 'No seleccionado'}
      </li>
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px; text-align:center;">
        2. ${predictions.gp2 || 'No seleccionado'}
      </li>
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px; text-align:center;">
        3. ${predictions.gp3 || 'No seleccionado'}
      </li>
    </ul>

    <!-- Extras -->
    <h2 style="color:#1e293b; font-size:18px; margin-bottom:8px;">⭐ Predicciones Adicionales</h2>
    <ul style="list-style:none; padding:0 0 20px 0; display:grid; grid-template-columns:1fr; gap:10px;">
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px;">
        Pit Stop Más Rápido: ${predictions.fastest_pit_stop_team || 'No seleccionado'}
      </li>
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px;">
        Vuelta Más Rápida: ${predictions.fastest_lap_driver || 'No seleccionado'}
      </li>
      <li style="background:#e2e8f0; color:#1e293b; font-weight:bold; padding:10px; border-radius:4px;">
        Piloto del Día: ${predictions.driver_of_the_day || 'No seleccionado'}
      </li>
    </ul>

    <p style="text-align:center; margin-top:30px;">
      <a href="https://motormaniacolombia.com/fantasy" 
         style="display:inline-block; background:#0ea5e9; color:#fff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
        Ver clasificación
      </a>
    </p>

    <footer style="margin-top:30px; font-size:12px; color:#999; text-align:center; border-top:1px solid #eee; padding-top:15px;">
      MotorManía Colombia | Bogotá D.C. | <a href="mailto:soporte@motormaniacolombia.com" style="color:#999;">soporte@motormaniacolombia.com</a>
    </footer>
  </div>
`;

    const text = `
¡Hola ${userName}!

¡Predicciones confirmadas! Tus selecciones para el ${gpName} son:

Qualifying (Pole):
1. ${predictions.pole1 || 'No seleccionado'}
2. ${predictions.pole2 || 'No seleccionado'}
3. ${predictions.pole3 || 'No seleccionado'}

Race (GP):
1. ${predictions.gp1 || 'No seleccionado'}
2. ${predictions.gp2 || 'No seleccionado'}
3. ${predictions.gp3 || 'No seleccionado'}

Predicciones Adicionales:
- Pit Stop Más Rápido: ${predictions.fastest_pit_stop_team || 'No seleccionado'}
- Vuelta Más Rápida: ${predictions.fastest_lap_driver || 'No seleccionado'}
- Piloto del Día: ${predictions.driver_of_the_day || 'No seleccionado'}

¡Compite por premios! Los 3 mejores por carrera y los 3 mejores de la temporada ganan recompensas exclusivas.
Ver clasificación: https://motormania.co/jugar-y-gana

Información legal:
MotorMania SAS - NIT 900.123.456-7
Carrera 15 #88-64, Bogotá D.C., Colombia
Certificado de existencia y representación legal 12345
Autorizado mediante resolución 1234 de 2023
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