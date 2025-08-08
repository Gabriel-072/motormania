// 📁 app/api/webhooks/bold/route.ts - Enhanced with Fixed Pick Processing & Tracking
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

/* 🔥 ENHANCED FACEBOOK TRACKING UTILITY ────────────────── */
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
    console.log(`🎯 [TRACKING] Starting Purchase event for: ${orderData.orderId}`);
    
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
      campaign_name: orderData.campaignName || '',
      tracking_source: 'bold_webhook'
    };

    // 🔥 FIX: Add timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [TRACKING] Facebook API failed:`, {
        status: response.status,
        error: errorText,
        orderId: orderData.orderId
      });
      
      // 🔥 FIX: Log to database for manual retry
      const { error: logError } = await sb.from('tracking_failures').insert({
        order_id: orderData.orderId,
        event_type: 'Purchase',
        error_message: errorText,
        payload: purchaseData,
        created_at: new Date().toISOString()
      });
      if (logError) console.error('Failed to log tracking failure:', logError);
      
      throw new Error(`Facebook tracking failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ [TRACKING] Purchase event tracked:`, {
      orderId: orderData.orderId,
      eventId,
      value: purchaseData.value,
      fb_trace_id: result.fbtrace_id
    });
    
    // 🔥 FIX: Mark as tracked in database
    const { error: updateError } = await sb.from('pick_transactions')
      .update({ 
        tracking_completed: true,
        tracking_event_id: eventId,
        tracking_completed_at: new Date().toISOString()
      })
      .eq('order_id', orderData.orderId);
    if (updateError) console.error('Failed to mark tracking complete:', updateError);

  } catch (error) {
    console.error(`❌ [TRACKING] Failed for ${orderData.orderId}:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // 🔥 FIX: Don't fail the webhook for tracking errors - Log for manual processing
    const { error: logError } = await sb.from('tracking_failures').insert({
      order_id: orderData.orderId,
      event_type: 'Purchase',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      created_at: new Date().toISOString()
    });
    if (logError) {
      console.error(`❌ [TRACKING] Failed to log tracking failure for ${orderData.orderId}:`, logError);
    }
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
  console.log(`🔐 [WH] Processing authenticated order: ${tx.order_id}`);
  
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
          
          console.log(`🎁 [WH] Promotion applied:`, {
            campaignName: result.campaign_name,
            bonusAmount: result.bonus_amount,
            effectiveAmount: effectiveAmount
          });
        } else {
          console.warn(`❌ [WH] Promotion application failed: ${result.error_message}`);
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
    order_id: tx.order_id,
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
  
  console.log(`✅ [WH] Pick moved to picks table: ${tx.order_id} (effective amount: ${effectiveAmount})`);
}

/* 🔥 FIXED: Process Anonymous Order - Now inserts into picks table */
async function processAnonymousOrder(db: SupabaseClient, tx: any) {
  console.log(`👤 [WH] Processing anonymous order: ${tx.order_id}`);
  
  // Check if already processed (moved to picks)
  const { data: existingPick } = await db
    .from('picks')
    .select('id')
    .eq('order_id', tx.order_id)
    .single();
    
  if (existingPick) {
    console.log(`✅ [WH] Order ${tx.order_id} already in picks table`);
    return;
  }
  
  // Update transaction as paid
  await db.from('pick_transactions')
    .update({ 
      payment_status: 'paid',
      bold_webhook_received_at: new Date().toISOString()
    })
    .eq('id', tx.id);

  // 🔥 FIX: For anonymous orders, we keep them in pick_transactions
  // They will be moved to picks table when user signs up
  // BUT we need to mark them properly
  
  console.log(`✅ [WH] Anonymous order marked as paid: ${tx.order_id}`);
  console.log(`📝 [WH] Order will be moved to picks table when user completes registration`);
  
  // Send email notification if email exists
  if (tx.email) {
    try {
      const promoText = tx.promotion_applied 
        ? `<p style="background-color: #10b981; color: white; padding: 12px; border-radius: 8px;">
             🎁 <strong>¡Bono aplicado!</strong> Tu jugada incluye el bono promocional: ${tx.promotion_campaign_name}
           </p>` 
        : '';

      const signUpUrl = `${SITE_URL}/sign-up?session=${tx.anonymous_session_id}&order=${tx.order_id}&redirect_url=/payment-success`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f97316;">¡Pago Confirmado! 🎉</h1>
          <p>Tu pago de <strong>$${(tx.wager_amount / 1000).toFixed(0)} MMC</strong> se procesó exitosamente.</p>
          ${promoText}
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Detalles de tu jugada:</strong></p>
            <ul>
              <li>Orden: ${tx.order_id}</li>
              <li>Picks: ${tx.picks?.length || 0}</li>
              <li>Modo: ${tx.mode === 'full' ? 'Full Throttle' : 'Safety Car'}</li>
              <li>Multiplicador: ${tx.multiplier}x</li>
              <li>Ganancia potencial: $${(tx.potential_win / 1000).toFixed(0)} MMC</li>
            </ul>
          </div>
          <p>Para ver tu jugada en el dashboard:</p>
          <ol>
            <li>Completa tu registro en MMC GO</li>
            <li>Usa el mismo email: <strong>${tx.email}</strong></li>
            <li>Tu jugada se vinculará automáticamente</li>
          </ol>
          <p style="margin-top: 20px;">
            <a href="${signUpUrl}" 
               style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Completar Registro →
            </a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            ¿Necesitas ayuda? Escríbenos a ${SUPPORT_EMAIL}
          </p>
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

/* 🔥 ENHANCED: Pick Purchase Handler with better tracking */
async function handlePickPurchase(db: SupabaseClient, data: any) {
  console.log('[Bold WH] 🏁 Pick purchase flow - ENHANCED VERSION');

  const ref = data.metadata?.reference as string;
  const payId = data.payment_id as string;
  const total = data.amount?.total as number;

  if (!ref || !payId) throw new Error('Missing reference or payId');

  // Get transaction
  const { data: tx } = await db
    .from('pick_transactions')
    .select('*')
    .eq('order_id', ref)
    .maybeSingle();
    
  if (!tx) { 
    console.warn(`❌ [WH] Transaction not found: ${ref}`); 
    return; 
  }

  // 🔥 FIX: Better duplicate detection
  const { data: existingPick } = await db
    .from('picks')
    .select('id')
    .eq('order_id', ref)
    .single();
    
  if (existingPick) {
    console.info(`↩️ [WH] Order already processed: ${ref}`);
    // Still update tracking if not done
    if (!tx.tracking_completed) {
      await trackPurchaseEvent({
        orderId: ref,
        amount: tx.wager_amount || total || 0,
        currency: 'COP',
        email: tx.email,
        userId: tx.user_id,
        picks: tx.picks || [],
        mode: tx.mode,
        promotionApplied: tx.promotion_applied || false,
        bonusAmount: tx.promotion_bonus_amount || 0,
        campaignName: tx.promotion_campaign_name || ''
      });
    }
    return;
  }
  
  // Check if already marked as paid (duplicate webhook)
  if (tx.payment_status === 'paid' && tx.bold_webhook_received_at && tx.tracking_completed) {
    console.info(`↩️ [WH] Already processed and tracked: ${ref}`);
    return;
  }

  console.log(`🔍 [WH] Processing transaction:`, {
    orderId: tx.order_id,
    userId: tx.user_id,
    amount: tx.wager_amount,
    isAnonymous: !tx.user_id,
    alreadyTracked: tx.tracking_completed
  });

  // Mark as paid FIRST
  await db.from('pick_transactions')
    .update({ 
      payment_status: 'paid', 
      bold_payment_id: payId,
      bold_webhook_received_at: new Date().toISOString()
    })
    .eq('id', tx.id);

  // Process based on user type
  if (tx.user_id) {
    await processAuthenticatedOrder(db, tx);
  } else {
    await processAnonymousOrder(db, tx);
  }

  // 🔥 FIX: Track purchase event with better error handling
  // Only track if not already tracked
  if (!tx.tracking_completed) {
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
  } else {
    console.log(`ℹ️ [WH] Tracking already completed for: ${ref}`);
  }

  console.log(`✅ [WH] Pick flow completed: ${ref}`);
}

/* ──────────────────── MAIN WEBHOOK HANDLER ───────────────────── */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`🔔 [WEBHOOK] Bold webhook received at ${new Date().toISOString()}`);
  
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  // 🔥 FIX: Better signature verification logging
  if (!verify(sig, raw)) {
    console.error('❌ [WEBHOOK] Invalid signature:', {
      receivedSig: sig.substring(0, 10) + '...',
      bodyLength: raw.length,
      timestamp: new Date().toISOString()
    });
    return new NextResponse('Bad signature', { status: 401 });
  }

  const evt = JSON.parse(raw);
  console.log(`📦 [WEBHOOK] Event:`, {
    type: evt.type,
    ref: evt.data?.metadata?.reference,
    paymentId: evt.data?.payment_id
  });
  
  if (evt.type !== 'SALE_APPROVED') {
    console.log(`ℹ️ [WEBHOOK] Event ${evt.type} ignored`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const ref: string = evt.data?.metadata?.reference ?? '';

  try {
    if      (ref.startsWith('MM-EXTRA-')) await handleNumberPurchase(sb, evt.data);
    else if (ref.startsWith('MMC-'))      await handlePickPurchase(sb, evt.data);
    else if (ref.startsWith('MM-DEP-'))   await handleWalletDeposit(sb, evt.data);
    else {
      console.warn(`⚠️ [WEBHOOK] Unknown reference format: ${ref}`);
      return NextResponse.json({ error: 'Unknown reference format' }, { status: 400 });
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [WEBHOOK] Processed successfully in ${duration}ms`);
    
    return NextResponse.json({ 
      ok: true, 
      processed: true,
      reference: ref,
      duration_ms: duration
    });
    
  } catch (e: any) {
    const duration = Date.now() - startTime;
    console.error(`🔥 [WEBHOOK] Error after ${duration}ms:`, {
      error: e.message,
      reference: ref,
      stack: e.stack
    });

    // Try to log webhook error
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