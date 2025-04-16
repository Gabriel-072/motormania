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
      <div style="background-color: #111827; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1F2937; border-radius: 8px; padding: 20px;">
          <h1 style="color: #FFFFFF; font-size: 24px; text-align: center; margin-bottom: 20px;">
            🏁 ¡Predicciones confirmadas, ${userName}!
          </h1>
          <p style="color: #FFFFFF; font-size: 16px; text-align: center; margin-bottom: 20px;">
            Tus predicciones para el ${gpName} han sido recibidas:
          </p>
          <div style="margin-bottom: 20px;">
            <h3 style="color: #F59E0B; font-size: 18px; text-align: center; margin-bottom: 10px;">
              Qualifying (Pole)
            </h3>
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                1. ${predictions.pole1 || 'No seleccionado'}
              </div>
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                2. ${predictions.pole2 || 'No seleccionado'}
              </div>
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                3. ${predictions.pole3 || 'No seleccionado'}
              </div>
            </div>
            <h3 style="color: #F59E0B; font-size: 18px; text-align: center; margin: 20px 0 10px;">
              Race (GP)
            </h3>
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                1. ${predictions.gp1 || 'No seleccionado'}
              </div>
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                2. ${predictions.gp2 || 'No seleccionado'}
              </div>
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                3. ${predictions.gp3 || 'No seleccionado'}
              </div>
            </div>
            <h3 style="color: #F59E0B; font-size: 18px; text-align: center; margin: 20px 0 10px;">
              Predicciones Adicionales
            </h3>
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                Pit Stop Más Rápido: ${predictions.fastest_pit_stop_team || 'No seleccionado'}
              </div>
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                Vuelta Más Rápida: ${predictions.fastest_lap_driver || 'No seleccionado'}
              </div>
              <div style="background-color: #FF4500; color: #FFFFFF; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 16px; width: 250px; text-align: center; margin: 5px 0;">
                Piloto del Día: ${predictions.driver_of_the_day || 'No seleccionado'}
              </div>
            </div>
          </div>
          <p style="color: #FFFFFF; font-size: 16px; text-align: center; margin-bottom: 20px;">
            ¡Compite por premios! Los 3 mejores por carrera y los 3 mejores de la temporada ganan recompensas exclusivas.
          </p>
          <div style="text-align: center; margin-bottom: 40px;">
            <a
              href="https://motormania.co/jugar-y-gana"
              style="background-color: #F59E0B; color: #1F2937; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;"
            >
              Ver clasificación
            </a>
          </div>
          <div style="border-top: 1px solid #374151; padding-top: 20px; color: #D1D5DB; font-size: 12px; text-align: center;">
            <p style="margin: 0 0 8px;">
              MotorMania SAS - NIT 900.123.456-7<br />
              Carrera 15 #88-64, Bogotá D.C., Colombia
            </p>
            <p style="margin: 0 0 8px;">
              Certificado de existencia y representación legal 12345<br />
              Autorizado mediante resolución 1234 de 2023
            </p>
          </div>
        </div>
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
      from: 'MotorMania <onboarding@resend.dev>',
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