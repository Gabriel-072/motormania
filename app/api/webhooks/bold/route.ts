// 📁 app/api/webhooks/bold/route.ts - Updated with Fixed Pick Processing
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
  promotionApplied?: boolean;
  bonusAmount?: number;
  campaignName?: string;
}) {
  const eventId = `purchase_${orderData.orderId}_${Date.now()}`;
  
  try {
    console.log(`🎯 Tracking Purchase event for order: ${orderData.orderId}`);
    
    const hashedEmail = orderData.email 
      ? crypto.createHash('sha256').update(orderData.email.toLowerCase().trim()).digest('hex')
      : undefined;
    
    const purchaseData = {
      value: (orderData.amount / 1000),
      currency: orderData.currency,
      content_type: 'product',
      content_category: 'sports_betting',
      content_ids: [`mmc_picks_${orderData.picks?.length || 0}`],
      content_name: `MMC GO ${orderData.mode === 'full' ? 'Full Throttle' : 'Safety Car'} (${orderData.picks?.length || 0} picks)${
        orderData.promotionApplied ? ` + ${orderData.campaignName}` : ''
      }`,
      num_items: orderData.picks?.length || 1,
      order_id: orderData.orderId,
      predicted_ltv: (orderData.amount / 1000) * 2,
      utm_source: orderData.utmData?.utm_source,
      utm_medium: orderData.utmData?.utm_medium,
      utm_campaign: orderData.utmData?.utm_campaign,
      promotion_applied: orderData.promotionApplied || false,
      bonus_amount: orderData.bonusAmount || 0,
      campaign_name: orderData.campaignName || ''
    };

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
        custom_data: purchaseData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Facebook API response:`, errorText);
      throw new Error(`Facebook tracking failed: ${response.status} - ${errorText}`);
    }

    console.log(`✅ Purchase event tracked successfully`);
  } catch (error) {
    console.error(`❌ Failed to track Purchase event for ${orderData.orderId}:`, error);
  }
}

/* ────────────────── HANDLER: DEPÓSITO WALLET ────────────────── */
async function handleWalletDeposit(db: SupabaseClient, data: any) {
  console.log('[Bold WH] Wallet deposit flow');

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

  const desc = `Depósito wallet Bold (Ref:${ref}, BoldID:${payId})`;
  const { data: already } = await db.from('transactions')
    .select('id')
    .eq('description', desc)
    .maybeSingle();
  if (already) {
    console.info('↩️ Depósito ya procesado');
    return;
  }

  const { error: rpcErr } = await db.rpc('apply_deposit_promo', {
    p_user_id    : userId,
    p_amount_cop : total
  });
  if (rpcErr) throw rpcErr;

  await db.from('transactions').insert({
    user_id   : userId,
    type      : 'recarga',
    amount    : total,
    description: desc
  });

  const [{ data: walletRow, error: walletErr }, { data: userRow }] = await Promise.all([
    db.from('wallet')
      .select('balance_cop,fuel_coins')
      .eq('user_id', userId)
      .single(),
    db.from('clerk_users')
      .select('email, full_name')
      .eq('clerk_id', userId)
      .maybeSingle()
  ]);

  if (walletErr) console.warn('Wallet fetch error', walletErr.message);

  if (userRow?.email && walletRow) {
    const htmlBody = `
      <p>¡Hola ${userRow.full_name || 'Jugador'}!</p>
      <p>Tu depósito por <strong>$${total.toLocaleString('es-CO')}</strong> COP fue confirmado ✅.</p>
      <p>Ahora tu saldo es:</p>
      <ul>
        <li><strong>$${walletRow.balance_cop.toLocaleString('es-CO')}</strong> COP disponibles</li>
        <li><strong>${walletRow.fuel_coins.toLocaleString('es-CO')}</strong> Fuel Coins (FC)</li>
      </ul>
      <p>¡Gracias por jugar en MMC&nbsp;GO!</p>
      <hr/>
      <p style="font-size:12px;color:#666;">¿Necesitas ayuda? Escríbenos a ${SUPPORT_EMAIL}</p>
    `;

    try {
      await resend.emails.send({
        from   : FROM_EMAIL,
        to     : userRow.email,
        subject: 'Depósito confirmado',
        html   : htmlBody
      });
      console.log('📧 Depósito email sent to', userRow.email);
    } catch (err) {
      console.error('✉️  Error enviando e-mail de depósito:', err);
    }
  }

  console.log('✅ Depósito aplicado + promo registrada + email');
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

  const desc = `Compra de ${EXTRA_COUNT} números extra via Bold (Ref:${ref}, BoldID:${payId})`;
  const { data: already } = await db.from('transactions')
    .select('id')
    .eq('description', desc)
    .maybeSingle();
  if (already) { console.info('↩️ ya procesado'); return; }

  await db.from('transactions').insert({
    user_id: userId, type: 'recarga', amount: total, description: desc
  });

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

/* 🔥 FIXED: Process Authenticated Order - Clean & Consistent */
async function processAuthenticatedOrder(db: SupabaseClient, tx: any) {
  console.log(`🔐 Processing authenticated order: ${tx.order_id}`);
  
  let promoApplicationId = null;
  let effectiveAmount = tx.wager_amount; // Default to original amount

  if (tx.promotion_applied && tx.user_id) {
    try {
      const { data: bonusResult, error: bonusError } = await db.rpc('apply_picks_promotion', {
        p_user_id: tx.user_id,
        p_transaction_id: tx.order_id,
        p_original_amount: tx.wager_amount
      });

      if (!bonusError && bonusResult && bonusResult.length > 0) {
        const result = bonusResult[0];
        if (result.success) {
          effectiveAmount = result.total_effective_amount;
          
          const { data: promoApp } = await db
            .from('user_promo_applications')
            .select('id')
            .eq('user_id', tx.user_id)
            .eq('transaction_id', tx.order_id)
            .single();
          
          if (promoApp) {
            promoApplicationId = promoApp.id;
          }
          
          console.log(`🎁 Promotion applied:`, {
            campaignName: result.campaign_name,
            bonusAmount: result.bonus_amount,
            effectiveAmount: effectiveAmount
          });
        } else {
          console.warn(`❌ Promotion application failed: ${result.error_message}`);
        }
      }
    } catch (error) {
      console.error('Error applying promotion (continuing without):', error);
    }
  }

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
  }

  const pickData = {
    user_id: tx.user_id,
    gp_name: tx.gp_name,
    session_type: 'combined',
    picks: Array.isArray(tx.picks) ? tx.picks : [],
    multiplier: Number(tx.multiplier ?? 0),
    potential_win: tx.potential_win ?? 0,
    mode: tx.mode ?? 'full',
    wager_amount: effectiveAmount,
    ...(promoApplicationId && { promo_application_id: promoApplicationId }),
    ...(utmData && {
      utm_source: utmData.utm_source,
      utm_medium: utmData.utm_medium,
      utm_campaign: utmData.utm_campaign,
      utm_term: utmData.utm_term,
      utm_content: utmData.utm_content,
      referrer: utmData.referrer
    })
  };

  const { error: insertError } = await db.from('picks').insert(pickData);
  
  if (insertError) {
    console.error('Failed to insert pick:', insertError);
    throw insertError;
  }
  
  if (promoApplicationId) {
    await db
      .from('user_promo_applications')
      .update({ 
        status: 'used',
        used_at: new Date().toISOString()
      })
      .eq('id', promoApplicationId);
  }
  
  await db.from('pick_transactions').delete().eq('id', tx.id);
  
  console.log(`✅ Pick moved to picks table: ${tx.order_id} (effective amount: ${effectiveAmount})`);
}

/* 🔥 FIXED: Process Anonymous Order - Simplified */
async function processAnonymousOrder(db: SupabaseClient, tx: any) {
  console.log(`👤 Processing anonymous order: ${tx.order_id}`);
  
  await db.from('pick_transactions')
    .update({ 
      payment_status: 'paid',
      processed_at: new Date().toISOString(),
      bold_webhook_received_at: new Date().toISOString()
    })
    .eq('id', tx.id);

  console.log(`✅ Anonymous pick marked as paid: ${tx.order_id}`);
  
  if (tx.email) {
    try {
      const promoText = tx.promotion_applied ? 
        `<div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #059669;"><strong>🎁 ¡Promoción Aplicada!</strong></p>
          <p style="margin: 5px 0 0 0; color: #059669;">
            Tu jugada se procesó con el bono incluido.<br/>
            <strong>Monto efectivo: $${Number(tx.promotion_total_effective || tx.wager_amount).toLocaleString('es-CO')} COP</strong>
          </p>
        </div>` : '';

      const picksArray = Array.isArray(tx.picks) ? tx.picks : [];
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">🏁 ¡Jugada confirmada en MMC GO!</h2>
          
          <p>¡Hola ${tx.full_name || 'Piloto'}!</p>
          <p>Tu pago por <strong>$${Number(tx.wager_amount || 0).toLocaleString('es-CO')}</strong> COP fue confirmado exitosamente.</p>
          
          ${promoText}
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">📋 Resumen de tu jugada:</h3>
            <ul style="margin: 10px 0;">
              <li><strong>Orden:</strong> ${tx.order_id}</li>
              <li><strong>GP:</strong> ${tx.gp_name}</li>
              <li><strong>Picks:</strong> ${picksArray.length} selecciones</li>
              <li><strong>Modo:</strong> ${tx.mode === 'full' ? 'Full Throttle' : 'Safety Car'}</li>
              <li><strong>Ganancia potencial:</strong> $${Number(tx.potential_win || 0).toLocaleString('es-CO')} COP</li>
            </ul>
          </div>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>¡Un paso más!</strong></p>
            <p style="margin: 5px 0 0 0;">Para gestionar tus jugadas y ver resultados, completa tu registro haciendo clic en el enlace que te enviamos por separado.</p>
          </div>

          <p>¡Gracias por apostar en MMC GO!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;"/>
          <p style="font-size: 12px; color: #6b7280;">¿Necesitas ayuda? Escríbenos a ${SUPPORT_EMAIL}</p>
        </div>
      `;

      await resend.emails.send({
        from   : FROM_EMAIL,
        to     : tx.email,
        subject: '🎉 Pago confirmado - Completa tu registro',
        html   : htmlBody
      });
      console.log('📧 Anonymous payment notification sent to', tx.email);
    } catch (error) {
      console.error('Failed to send anonymous payment notification:', error);
    }
  }
}

/* 🔥 UPDATED: HANDLER COMPRA DE PICKS CON SISTEMA PROMOCIONAL */
async function handlePickPurchase(db: SupabaseClient, data: any) {
  console.log('[Bold WH] Pick purchase flow - WITH FIXED PROCESSING');

  const ref   = data.metadata?.reference as string;
  const payId = data.payment_id          as string;
  const total = data.amount?.total       as number;

  if (!ref || !payId) throw new Error('Referencia o payId faltante');

  const { data: tx } = await db
    .from('pick_transactions')
    .select('*')
    .eq('order_id', ref)
    .maybeSingle();
  if (!tx) { 
    console.warn('❌ pick_transactions no encontrada para', ref); 
    return; 
  }
  if (tx.payment_status === 'paid') { 
    console.info('↩️ pick ya pagada:', ref); 
    return; 
  }

  console.log('🔍 Transaction found:', {
    orderId: tx.order_id,
    userId: tx.user_id,
    amount: tx.wager_amount,
    promotionApplied: tx.promotion_applied
  });

  await db.from('pick_transactions')
    .update({ 
      payment_status: 'paid', 
      bold_payment_id: payId,
      bold_webhook_received_at: new Date().toISOString()
    })
    .eq('id', tx.id);

  if (tx.user_id) {
    await processAuthenticatedOrder(db, tx);
  } else {
    await processAnonymousOrder(db, tx);
  }

  await trackPurchaseEvent({
    orderId: ref,
    amount: tx.wager_amount || total || 0,
    currency: 'COP',
    email: tx.email,
    userId: tx.user_id,
    picks: tx.picks || [],
    mode: tx.mode,
    utmData: null,
    promotionApplied: tx.promotion_applied || false,
    bonusAmount: tx.promotion_bonus_amount || 0,
    campaignName: tx.promotion_campaign_name || ''
  });

  console.log('✅ Pick flow finished for', ref);
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
      }).catch(() => {});
    } catch {}

    return new NextResponse('Internal error', { status: 500 });
  }
}