//app/api/vip/send-confirmation-email/route.ts - FIXED

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 🔥 FIXED: Move function to top to avoid scoping issues
function createEmailContent(customerName: string, planType: string, racePassGp: string | null, amount: number, orderId: string) {
  const planName = planType === 'race-pass' ? 'Race Pass' : 'Season Pass';
  const formattedAmount = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);

  const text = `
¡Hola ${customerName}!

🎉 ¡Bienvenido a MotorManía VIP!

Tu pago ha sido procesado exitosamente:

📝 Detalles de tu compra:
• Plan: ${planName}
${racePassGp ? `• Gran Premio: ${racePassGp}` : ''}
• Monto: ${formattedAmount}
• ID de Orden: ${orderId}

🏁 ¿Qué sigue?
1. Inicia sesión en motormania.app
2. Ve a la sección VIP Fantasy
3. ¡Comienza a hacer tus predicciones!

🎯 Tu acceso VIP incluye:
${planType === 'season-pass' 
  ? '• Acceso a TODA la temporada 2025\n• Predicciones para todos los Grandes Premios\n• Válido hasta diciembre 2026'
  : `• Acceso al ${racePassGp || 'próximo Gran Premio'}\n• Predicciones exclusivas\n• Válido por 30 días`
}

Si tienes alguna pregunta, contáctanos en soporte@motormania.com

¡Que disfrutes tu experiencia VIP!

El equipo de MotorManía
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Bienvenido a MotorManía VIP</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; border-radius: 15px; color: white;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ff4444; margin: 0; font-size: 28px;">Motor<span style="color: #ffa500;">Manía</span></h1>
          <h2 style="color: #ffa500; margin: 10px 0 0 0;">🏎️ ¡Bienvenido a VIP!</h2>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #ffa500; margin-top: 0;">¡Hola ${customerName}!</h3>
          <p style="color: #ffffff; line-height: 1.6;">
            🎉 <strong>¡Tu pago ha sido procesado exitosamente!</strong>
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #ffa500; margin-top: 0;">📝 Detalles de tu compra</h3>
          <ul style="color: #ffffff; line-height: 1.8;">
            <li><strong>Plan:</strong> ${planName}</li>
            ${racePassGp ? `<li><strong>Gran Premio:</strong> ${racePassGp}</li>` : ''}
            <li><strong>Monto:</strong> ${formattedAmount}</li>
            <li><strong>ID de Orden:</strong> ${orderId}</li>
          </ul>
        </div>

        <div style="background: rgba(255, 165, 0, 0.2); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #ffa500; margin-top: 0;">🏁 ¿Qué sigue?</h3>
          <ol style="color: #ffffff; line-height: 1.8;">
            <li>Inicia sesión en <a href="https://motormania.app" style="color: #ffa500;">motormania.app</a></li>
            <li>Ve a la sección <strong>VIP Fantasy</strong></li>
            <li>¡Comienza a hacer tus predicciones!</li>
          </ol>
        </div>

        <div style="background: rgba(68, 255, 68, 0.2); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #44ff44; margin-top: 0;">🎯 Tu acceso VIP incluye</h3>
          <ul style="color: #ffffff; line-height: 1.8;">
            ${planType === 'season-pass' 
              ? '<li>Acceso a <strong>TODA la temporada 2025</strong></li><li>Predicciones para todos los Grandes Premios</li><li>Válido hasta diciembre 2026</li>'
              : `<li>Acceso al <strong>${racePassGp || 'próximo Gran Premio'}</strong></li><li>Predicciones exclusivas</li><li>Válido por 30 días</li>`
            }
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://motormania.app/fantasy-vip" 
             style="background: linear-gradient(90deg, #ffa500, #ff6600); 
                    color: black; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    font-weight: bold; 
                    display: inline-block;">
            🚀 Acceder a VIP Fantasy
          </a>
        </div>

        <div style="text-align: center; color: #cccccc; font-size: 14px; margin-top: 30px;">
          <p>Si tienes alguna pregunta, contáctanos en <a href="mailto:soporte@motormania.com" style="color: #ffa500;">soporte@motormania.com</a></p>
          <p style="margin-top: 20px;">¡Que disfrutes tu experiencia VIP!</p>
          <p><strong>El equipo de MotorManía</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { text, html };
}

export async function POST(req: NextRequest) {
  try {
    const { email, customerName, planType, racePassGp, amount, orderId } = await req.json();

    if (!email || !customerName || !planType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    console.log('📧 Sending confirmation email to:', email);

    // 🔥 FIXED: Using Resend
    if (process.env.RESEND_API_KEY) {
      const emailContent = createEmailContent(customerName, planType, racePassGp, amount, orderId);
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MotorManía <no-reply@motormania.app>',
          to: [email],
          subject: `🏎️ ¡Bienvenido a MotorManía VIP! - ${planType === 'race-pass' ? 'Race Pass' : 'Season Pass'}`,
          html: emailContent.html,
          text: emailContent.text
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Resend API error:', errorData);
        throw new Error('Failed to send email via Resend');
      }

      const result = await response.json();
      console.log('✅ Email sent via Resend:', result.id);
      
      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        email_id: result.id
      });
    }

    // Fallback: Log only (for testing)
    console.log('📧 Email would be sent to:', email);
    console.log('📄 Email content preview:', {
      subject: `🏎️ ¡Bienvenido a MotorManía VIP! - ${planType === 'race-pass' ? 'Race Pass' : 'Season Pass'}`,
      to: email,
      planType,
      amount
    });
    
    return NextResponse.json({
      success: true,
      message: 'Email logged (RESEND_API_KEY not configured)'
    });

  } catch (error) {
    console.error('❌ Error sending confirmation email:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to send email'
    }, { status: 500 });
  }
}