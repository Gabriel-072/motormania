// 📁 app/api/abandonment/detect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

// Run this via cron job every 30 minutes
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('🔍 Running cart abandonment detection...');

    // Find pending transactions older than 15 minutes
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

    const { data: abandonedTransactions } = await sb
      .from('pick_transactions')
      .select(`
        id, user_id, email, full_name, picks, wager_amount, 
        mode, created_at, multiplier, potential_win, gp_name,
        reminder_sent_at
      `)
      .eq('payment_status', 'pending')
      .lt('created_at', fifteenMinutesAgo.toISOString())
      .is('reminder_sent_at', null); // Haven't sent reminder yet

    if (!abandonedTransactions?.length) {
      console.log('✅ No abandoned carts found');
      return NextResponse.json({ processed: 0 });
    }

    console.log(`📧 Processing ${abandonedTransactions.length} abandoned carts`);

    // Send recovery emails
    const emailPromises = abandonedTransactions.map(async (tx) => {
      try {
        // Create recovery link with pre-filled data
        const recoveryLink = `${process.env.NEXT_PUBLIC_SITE_URL}/mmc-go?recover=${tx.id}`;
        
        // Calculate time left (assuming 24h limit)
        const timeLeft = getTimeLeft(tx.created_at);
        
        await resend.emails.send({
          from: 'MotorMania <noreply@motormania.app>',
          to: tx.email,
          subject: '🏎️ ¡Tus picks te están esperando!',
          html: generateAbandonmentEmail({
            name: tx.full_name || 'Piloto',
            picks: tx.picks || [],
            wager_amount: tx.wager_amount,
            potential_win: tx.potential_win,
            mode: tx.mode,
            gp_name: tx.gp_name,
            recoveryLink,
            timeLeft
          })
        });

        // Mark as reminder sent
        await sb
          .from('pick_transactions')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', tx.id);

        console.log(`📧 Sent abandonment email to ${tx.email}`);
        return { success: true, email: tx.email };
      } catch (error) {
        console.error(`❌ Failed to send email to ${tx.email}:`, error);
        return { success: false, email: tx.email, error };
      }
    });

    const results = await Promise.allSettled(emailPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`✅ Sent ${successful}/${abandonedTransactions.length} abandonment emails`);

    return NextResponse.json({ 
      processed: abandonedTransactions.length,
      successful,
      failed: abandonedTransactions.length - successful
    });

  } catch (error) {
    console.error('❌ Cart abandonment detection failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Helper functions
function getTimeLeft(createdAt: string): string {
  const created = new Date(createdAt);
  const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  const now = new Date();
  const hoursLeft = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60)));
  
  if (hoursLeft > 1) return `${hoursLeft} horas`;
  if (hoursLeft === 1) return '1 hora';
  return 'Menos de 1 hora';
}

function generateAbandonmentEmail({
  name,
  picks,
  wager_amount,
  potential_win,
  mode,
  gp_name,
  recoveryLink,
  timeLeft
}: {
  name: string;
  picks: any[];
  wager_amount: number;
  potential_win: number;
  mode: string;
  gp_name: string;
  recoveryLink: string;
  timeLeft: string;
}): string {
  const picksList = picks.map(pick => 
    `<li style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
      <strong>${pick.driver}</strong> (${pick.team}) - ${pick.betterOrWorse === 'mejor' ? '📈 Mejor' : '📉 Peor'} que línea ${pick.line}
    </li>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tus picks te esperan - MotorMania</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1f2937 0%, #111827 100%); color: white; padding: 30px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 24px 0; }
        .urgency { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
        .picks-summary { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px 24px; text-align: center; font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🏎️ ¡Tus picks te están esperando!</h1>
          <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9;">No pierdas la oportunidad de ganar en F1</p>
        </div>
        
        <div class="content">
          <p style="font-size: 18px; margin: 0 0 20px 0;">¡Hola <strong>${name}</strong>!</p>
          
          <p>Notamos que empezaste a crear tus picks para <strong>${gp_name}</strong> pero no completaste el pago. ¡No te preocupes! Guardamos tu selección y puedes completarla ahora.</p>
          
          <div class="urgency">
            <strong>⏰ Tiempo restante: ${timeLeft}</strong><br>
            <span style="font-size: 14px;">Después de este tiempo, tendrás que crear nuevos picks</span>
          </div>
          
          <div class="picks-summary">
            <h3 style="margin: 0 0 16px 0; color: #1f2937;">📋 Resumen de tus picks:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${picksList}
            </ul>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                <span><strong>Modo:</strong></span>
                <span>${mode === 'full' ? '🚀 Full Throttle' : '🛡️ Safety Car'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                <span><strong>Apuesta:</strong></span>
                <span>$${wager_amount?.toLocaleString('es-CO')} COP</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 8px 0; color: #16a34a; font-weight: bold;">
                <span><strong>Ganancia potencial:</strong></span>
                <span>$${potential_win?.toLocaleString('es-CO')} COP</span>
              </div>
            </div>
          </div>
          
          <div style="text-align: center;">
            <a href="${recoveryLink}" class="cta-button">
              💳 Completar Pago Ahora
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; text-align: center;">
            Si tienes problemas, puedes responder a este email o contactarnos en 
            <a href="mailto:soporte@motormania.app" style="color: #f59e0b;">soporte@motormania.app</a>
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">MotorMania GO - La experiencia definitiva de apuestas F1</p>
          <p style="margin: 8px 0 0 0; font-size: 12px;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe" style="color: #6b7280;">Desuscribirse</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}