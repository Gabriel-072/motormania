// 📁 app/api/webhooks/bold/route.ts - Complete Version with Anonymous Support
'use server';

import { NextRequest, NextResponse }      from 'next/server';
import { createClient, SupabaseClient }   from '@supabase/supabase-js';
import crypto                             from 'crypto';
import { Resend }                         from 'resend';

/* ──────────────────────────── ENV ───────────────────────────── */
const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BOLD_WEBHOOK_SECRET = process.env.BOLD_WEBHOOK_SECRET_KEY!;
const SITE_URL            = process.env.NEXT_PUBLIC_SITE_URL!;
const INTERNAL_KEY        = process.env.INTERNAL_API_KEY!;
const RESEND_API_KEY      = process.env.RESEND_API_KEY!;

/* ──────────────────────── CLIENTES ───────────────────────────── */
const sb     = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
const resend = new Resend(RESEND_API_KEY);

/* ─────────────────────── CONSTANTES ─────────────────────────── */
const EXTRA_COUNT   = 5;
const SUPPORT_EMAIL = 'soporte@motormania.app';
const FROM_EMAIL    = 'MotorMania <noreply@motormania.app>';

/* ─────────────────────── UTILIDADES ─────────────────────────── */
function verify(sig: string, raw: string): boolean {
  const bodyB64  = Buffer.from(raw).toString('base64');
  const expected = crypto
    .createHmac('sha256', BOLD_WEBHOOK_SECRET)
    .update(bodyB64)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

async function uniqueSix(existing: string[], n: number): Promise<string[]> {
  const pool = new Set(existing);
  const out: string[] = [];
  while (out.length < n) {
    const num = Math.floor(100_000 + Math.random() * 900_000).toString();
    if (!pool.has(num)) {
      pool.add(num);
      out.push(num);
    }
  }
  return out;
}

/* ──────────────────── FACEBOOK TRACKING UTILITY ────────────────── */
async function trackPurchaseEvent(orderData: {
  orderId: string;
  amount: number;
  currency: string;
  email?: string;
  userId?: string;
  picks?: any[];
  mode?: string;
  utmData?: any;
}) {
  const eventId = `purchase_${orderData.orderId}_${Date.now()}`;
  
  try {
    console.log(`🎯 Tracking Purchase event for order: ${orderData.orderId}`);
    
    // ✅ FIXED: Use SHA256 hashing for email consistency
    const hashedEmail = orderData.email 
      ? crypto.createHash('sha256').update(orderData.email.toLowerCase().trim()).digest('hex')
      : undefined;
    
    // Prepare Facebook Purchase event data
    const purchaseData = {
      value: (orderData.amount / 1000), // Convert COP to thousands for better tracking
      currency: orderData.currency,
      content_type: 'product',
      content_category: 'sports_betting',
      content_ids: [`mmc_picks_${orderData.picks?.length || 0}`],
      content_name: `MMC GO ${orderData.mode === 'full' ? 'Full Throttle' : 'Safety Car'} (${orderData.picks?.length || 0} picks)`,
      num_items: orderData.picks?.length || 1,
      order_id: orderData.orderId,
      predicted_ltv: (orderData.amount / 1000) * 2, // Estimated lifetime value
      // 🎯 NEW: Include UTM data in tracking
      utm_source: orderData.utmData?.utm_source,
      utm_medium: orderData.utmData?.utm_medium,
      utm_campaign: orderData.utmData?.utm_campaign,
    };

    // Send to Facebook Conversions API
    const response = await fetch(`${SITE_URL}/api/fb-track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': INTERNAL_KEY
      },
      body: JSON.stringify({
        event_name: 'Purchase',
        event_id: eventId,
        event_source_url: `${SITE_URL}/mmc-go`,
        user_data: {
          em: hashedEmail,
          external_id: orderData.userId,
        },
        custom_data: purchaseData, // ✅ FIXED: Changed from params to custom_data
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Facebook API response:`, errorText);
      throw new Error(`Facebook tracking failed: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log(`✅ Purchase event tracked successfully:`, responseData);
    
    // Also track custom VIP event for high-value purchases
    if (orderData.amount >= 100000) { // 100k COP or more
      await fetch(`${SITE_URL}/api/fb-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': INTERNAL_KEY
        },
        body: JSON.stringify({
          event_name: 'VIP_HighValuePurchase',
          event_id: `vip_${eventId}`,
          event_source_url: `${SITE_URL}/mmc-go`,
          user_data: {
            em: hashedEmail,
            external_id: orderData.userId,
          },
          custom_data: {
            ...purchaseData,
            vip_tier: orderData.amount >= 200000 ? 'platinum' : 'gold',
          }, // ✅ FIXED: Changed from params to custom_data
        }),
      });
      console.log(`🏆 VIP event tracked for high-value purchase: ${orderData.orderId}`);
    }

  } catch (error) {
    console.error(`❌ Failed to track Purchase event for ${orderData.orderId}:`, error);
    // Don't throw - tracking failure shouldn't break the webhook
  }
}

/* 🔥 FIXED: Simplified deposit handler (cash only) */
async function handleWalletDeposit(db: SupabaseClient, data: any) {
  console.log('[Bold WH] Wallet deposit flow - CASH ONLY');

  const ref   = data.metadata?.reference as string;
  const total = data.amount?.total       as number;
  const payId = data.payment_id          as string;

  if (!ref || total === undefined || !payId)
    throw new Error('Referencia, monto o payment_id faltante');

  const parts = ref.split('-');
  if (parts.length < 4 || parts[0] !== 'MM' || parts[1] !== 'DEP')
    throw new Error('Referencia de depósito mal formada');

  const userId = parts[2];
  console.log(`[WH Dep] user=${userId} COP=${total}`);

  /* 1. Idempotencia */
  const desc = `Depósito wallet Bold (Ref:${ref}, BoldID:${payId})`;
  const { data: already } = await db.from('transactions')
    .select('id')
    .eq('description', desc)
    .maybeSingle();
  if (already) {
    console.info('↩️ Depósito ya procesado');
    return;
  }

  // 2. 🔥 FIXED: Use simple cash-only wallet update
  const { error: walletErr } = await db.rpc('update_wallet_balance', {
    p_user_id: userId,
    p_amount_cop: total,
    p_description: desc
  });
  if (walletErr) throw walletErr;

  // 3. Get user data for email  
  const { data: userRow } = await db
    .from('clerk_users')
    .select('email, full_name')
    .eq('clerk_id', userId)
    .maybeSingle();

  // 4. Get updated wallet balance
  const { data: walletRow } = await db
    .from('wallet')
    .select('balance_cop')
    .eq('user_id', userId)
    .single();

  // 5. Send confirmation email
  if (userRow?.email && walletRow) {
    const htmlBody = `
      <p>¡Hola ${userRow.full_name || 'Jugador'}!</p>
      <p>Tu depósito por <strong>$${total.toLocaleString('es-CO')}</strong> COP fue confirmado ✅.</p>
      <p>Tu nuevo saldo es: <strong>$${walletRow.balance_cop.toLocaleString('es-CO')}</strong> COP</p>
      <p>¡Gracias por jugar en MMC GO!</p>
      <hr/>
      <p style="font-size:12px;color:#666;">¿Necesitas ayuda? Escríbenos a support@mmcgo.com</p>
    `;

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: userRow.email,
        subject: 'Depósito confirmado',
        html: htmlBody
      });
      console.log('📧 Deposit confirmation sent to', userRow.email);
    } catch (err) {
      console.error('✉️ Error sending deposit email:', err);
    }
  }

  console.log(`✅ Cash-only deposit processed: ${total} COP for user ${userId}`);
}

/* ────────────── HANDLER: COMPRA DE NÚMEROS EXTRA ────────────── */
async function handleNumberPurchase(db: SupabaseClient, data: any) {
  console.log('[Bold WH] Number purchase flow');

  const ref   = data.metadata?.reference as string;
  const total = data.amount?.total       as number;
  const payId = data.payment_id          as string;

  if (!ref || total === undefined || !payId) throw new Error('Datos incompletos');

  const parts = ref.split('-');
  if (parts.length !== 4 || parts[0] !== 'MM' || parts[1] !== 'EXTRA')
    throw new Error('Referencia inesperada');

  const userId = parts[2];

  /* Idempotencia */
  const desc = `Compra de ${EXTRA_COUNT} números extra via Bold (Ref:${ref}, BoldID:${payId})`;
  const { data: already } = await db.from('transactions')
    .select('id')
    .eq('description', desc)
    .maybeSingle();
  if (already) { console.info('↩️ ya procesado'); return; }

  /* 1. Transacción */
  await db.from('transactions').insert({
    user_id: userId, type: 'recarga', amount: total, description: desc
  });

  /* 2. Números extra */
  const { data: entry } = await db.from('entries')
    .select('numbers, paid_numbers_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (!entry) throw new Error('Entry no encontrado');

  const newNums = await uniqueSix(entry.numbers ?? [], EXTRA_COUNT);
  await db.from('entries').upsert({
    user_id           : userId,
    numbers           : [ ...(entry.numbers ?? []), ...newNums ],
    paid_numbers_count: (entry.paid_numbers_count ?? 0) + EXTRA_COUNT
  }, { onConflict: 'user_id' });

  /* 3. E-mail confirmación números extra */
  const { data: userRow } = await db.from('clerk_users')
    .select('email, full_name')
    .eq('clerk_id', userId)
    .maybeSingle();

  if (userRow?.email) {
    try {
      const resp = await fetch(`${SITE_URL}/api/send-numbers-confirmation`, {
        method : 'POST',
        headers: {
          'Content-Type'  : 'application/json',
          'x-internal-key': INTERNAL_KEY
        },
        body: JSON.stringify({
          to      : userRow.email,
          name    : userRow.full_name || 'Usuario',
          numbers : newNums,
          context : 'compra',
          orderId : ref,
          amount  : total
        })
      });
      if (!resp.ok) {
        console.error(`✉️ email API error (${resp.status})`);
      } else {
        console.log('📧 Extra numbers email sent to', userRow.email);
      }
    } catch (err) {
      console.error('✉️ email fetch failed:', err);
    }
  }

  console.log('✅ Números extra procesados');
}

/* 🆕 ANONYMOUS PAYMENT NOTIFICATION */
async function notifyAnonymousPayment(tx: any) {
  console.log(`📧 Anonymous payment notification: ${tx.email} - ${tx.order_id}`);
  
  // Send email to user about completing registration
  if (tx.email) {
    try {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">¡Pago Exitoso! 🎉</h2>
          <p>¡Hola ${tx.full_name || 'Jugador'}!</p>
          <p>Tu pago por <strong>$${Number(tx.wager_amount || 0).toLocaleString('es-CO')}</strong> COP ha sido procesado exitosamente.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Detalles de tu apuesta:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Orden:</strong> ${tx.order_id}</li>
              <li><strong>Picks:</strong> ${tx.picks?.length || 0} selecciones</li>
              <li><strong>Modo:</strong> ${tx.mode === 'full' ? 'Full Throttle' : 'Safety Car'}</li>
              <li><strong>Ganancia potencial:</strong> $${Number(tx.potential_win || 0).toLocaleString('es-CO')} COP</li>
            </ul>
          </div>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>¡Un paso más!</strong></p>
            <p style="margin: 5px 0 0 0;">Para gestionar tus apuestas y ver los resultados, completa tu registro haciendo clic en el enlace que te enviamos por separado.</p>
          </div>

          <p>¡Gracias por apostar en MMC GO!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;"/>
          <p style="font-size: 12px; color: #6b7280;">¿Necesitas ayuda? Escríbenos a ${SUPPORT_EMAIL}</p>
        </div>
      `;

      await resend.emails.send({
        from: FROM_EMAIL,
        to: tx.email,
        subject: '🎉 Pago confirmado - Completa tu registro',
        html: htmlBody
      });
      console.log('📧 Anonymous payment notification sent to', tx.email);
    } catch (error) {
      console.error('Failed to send anonymous payment notification:', error);
    }
  }
}

/* 🆕 PROCESS AUTHENTICATED ORDER */
async function processAuthenticatedOrder(db: SupabaseClient, tx: any) {
  console.log(`🔐 Processing authenticated order: ${tx.order_id}`);

  // Get recent UTM data for this user
  let utmData = null;
  if (tx.user_id) {
    const { data: recentTraffic } = await db
      .from('traffic_sources')
      .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer')
      .eq('user_id', tx.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    utmData = recentTraffic;
    
    // Log attribution if found
    if (utmData?.utm_source || utmData?.utm_campaign) {
      console.log(`🎯 Purchase attributed to UTM:`, {
        orderId: tx.order_id,
        utm_source: utmData.utm_source,
        utm_campaign: utmData.utm_campaign,
        amount: tx.wager_amount
      });
    }
  }

  // Move to picks table
  await db.from('picks').insert({
    user_id            : tx.user_id,
    gp_name            : tx.gp_name,
    session_type       : 'combined',
    picks              : tx.picks ?? [],
    multiplier         : Number(tx.multiplier ?? 0),
    wager_amount       : tx.wager_amount ?? 0,
    potential_win      : tx.potential_win ?? 0,
    name               : tx.full_name,
    mode               : tx.mode,
    order_id           : tx.order_id,
    pick_transaction_id: tx.id,
    // Include UTM attribution from recent traffic
    utm_source: utmData?.utm_source,
    utm_medium: utmData?.utm_medium,
    utm_campaign: utmData?.utm_campaign,
    utm_term: utmData?.utm_term,
    utm_content: utmData?.utm_content,
    referrer: utmData?.referrer,
    payment_method: 'bold'
  });

  console.log(`✅ Authenticated order processed: ${tx.order_id}`);
}

/* ───────────── HANDLER: COMPRA DE PICKS MMC-GO (UPDATED for Anonymous) ─────────────── */
async function handlePickPurchase(db: SupabaseClient, data: any) {
  console.log('[Bold WH] Pick purchase flow - ANONYMOUS SUPPORT + UTM TRACKING');

  const ref   = data.metadata?.reference as string;
  const payId = data.payment_id          as string;
  const total = data.amount?.total       as number;

  if (!ref || !payId) throw new Error('Referencia o payId faltante');

  /* 1. Find pending transaction */
  const { data: tx } = await db
    .from('pick_transactions')
    .select('*')
    .eq('order_id', ref)
    .maybeSingle();
    
  if (!tx) { 
    console.warn('pick_transactions no encontrada para order_id:', ref); 
    return; 
  }
  
  if (tx.payment_status === 'paid') { 
    console.info('pick ya pagada para order_id:', ref); 
    return; 
  }

  /* 2. Mark as paid */
  await db.from('pick_transactions')
    .update({ payment_status: 'paid', bold_payment_id: payId })
    .eq('id', tx.id);

  /* 🆕 3. Handle based on user status */
  if (tx.user_id) {
    // Authenticated user - process immediately
    console.log(`👤 Authenticated user payment: ${tx.user_id}`);
    await processAuthenticatedOrder(db, tx);
  } else {
    // Anonymous user - wait for registration
    console.log(`🕶️ Anonymous payment completed: ${ref}. Awaiting registration.`);
    await notifyAnonymousPayment(tx);
  }

  /* 4. Track purchase event with enhanced data */
  try {
    await trackPurchaseEvent({
      orderId: ref,
      amount: tx.wager_amount || total || 0,
      currency: 'COP',
      email: tx.email,
      userId: tx.user_id,
      picks: tx.picks || [],
      mode: tx.mode,
      utmData: null // Will be enriched later if user registers
    });
  } catch (trackingError) {
    console.error('❌ Purchase tracking failed (non-blocking):', trackingError);
    // Continue processing even if tracking fails
  }

  console.log('✅ Pick purchase processed for', ref);
}

/* ──────────────────── ENTRYPOINT WEBHOOK ───────────────────── */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`🔔 Bold webhook received at ${new Date().toISOString()}`);
  
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  if (!verify(sig, raw)) {
    console.error('❌ Invalid webhook signature');
    return new NextResponse('Bad signature', { status: 401 });
  }

  const evt = JSON.parse(raw);
  console.log(`📦 Event type: ${evt.type}, ref: ${evt.data?.metadata?.reference}`);
  
  if (evt.type !== 'SALE_APPROVED') {
    console.log(`ℹ️  Event ${evt.type} ignored`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const ref: string = evt.data?.metadata?.reference ?? '';

  try {
    if      (ref.startsWith('MM-EXTRA-')) await handleNumberPurchase(sb, evt.data);
    else if (ref.startsWith('MMC-'))      await handlePickPurchase(sb, evt.data);
    else if (ref.startsWith('MM-DEP-'))   await handleWalletDeposit(sb, evt.data);
    else   console.warn('⚠️  Referencia desconocida:', ref);

    const duration = Date.now() - startTime;
    console.log(`✅ Webhook processed successfully in ${duration}ms`);
    
    return NextResponse.json({ 
      ok: true, 
      processed: true,
      reference: ref,
      duration_ms: duration
    });
    
  } catch (e: any) {
    const duration = Date.now() - startTime;
    console.error(`🔥 Webhook error after ${duration}ms:`, e);
    
    // Send error notification (optional)
    try {
      await fetch(`${SITE_URL}/api/admin/webhook-error`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-internal-key': INTERNAL_KEY 
        },
        body: JSON.stringify({
          error: e.message,
          reference: ref,
          timestamp: new Date().toISOString(),
          duration_ms: duration
        }),
      }).catch(() => {}); // Silent fail for error reporting
    } catch {}
    
    return new NextResponse('Internal error', { status: 500 });
  }
}