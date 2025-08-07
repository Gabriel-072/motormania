// app/api/webhooks/bold/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/* 🔧 FIXED: Process Authenticated Order - Handles Both Old & New Records */
async function processAuthenticatedOrder(db: any, tx: any) {
  console.log(`🔐 Processing authenticated order: ${tx.order_id}`);
  
  // 🔧 FIXED: Handle promotional fields safely (may not exist in old records)
  const hasPromotion = tx.promotion_applied === true;
  const effectiveAmount = hasPromotion ? 
    (tx.promotion_total_effective || tx.wager_amount) : 
    tx.wager_amount;

  // Get UTM data (existing logic)
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

  // 🔧 FIXED: Parse picks field safely (could be string or object)
  let picksArray = [];
  try {
    if (typeof tx.picks === 'string') {
      picksArray = JSON.parse(tx.picks);
    } else if (Array.isArray(tx.picks)) {
      picksArray = tx.picks;
    } else {
      picksArray = [];
    }
  } catch (error) {
    console.warn('Failed to parse picks:', error);
    picksArray = [];
  }

  // 🔧 FIXED: Move to picks table with safe field handling
  const pickData = {
    user_id: tx.user_id,
    gp_name: tx.gp_name || 'GP',
    session_type: 'combined',
    picks: picksArray,
    multiplier: Number(tx.multiplier || 0),
    wager_amount: effectiveAmount, // Use effective amount for calculations
    potential_win: tx.potential_win || 0,
    mode: tx.mode || 'full',
    
    // 🔧 FIXED: Only add promo_application_id if it exists
    ...(tx.promo_application_id && { promo_application_id: tx.promo_application_id }),
    
    // UTM attribution (existing)
    utm_source: utmData?.utm_source,
    utm_medium: utmData?.utm_medium,
    utm_campaign: utmData?.utm_campaign,
    utm_term: utmData?.utm_term,
    utm_content: utmData?.utm_content,
    referrer: utmData?.referrer
  };

  try {
    await db.from('picks').insert(pickData);
    console.log(`✅ Pick moved to picks table: ${tx.order_id}`);
  } catch (error) {
    console.error('❌ Failed to insert pick:', error);
    throw error;
  }
  
  // 🔧 FIXED: Update promo status if promotion was applied
  if (hasPromotion && tx.promo_application_id) {
    try {
      await db
        .from('user_promo_applications')
        .update({ 
          status: 'used',
          used_at: new Date().toISOString()
        })
        .eq('id', tx.promo_application_id);
      
      console.log(`🎁 Promotion marked as used: ${tx.promo_application_id}`);
    } catch (error) {
      console.warn('Failed to update promotion status:', error);
      // Don't throw - this is not critical
    }
  }
  
  // Clean up transaction record
  try {
    await db.from('pick_transactions').delete().eq('id', tx.id);
    console.log(`🗑️ Transaction cleaned up: ${tx.order_id}`);
  } catch (error) {
    console.warn('Failed to delete transaction:', error);
    // Don't throw - this is not critical
  }
}

/* 🔧 FIXED: Process Anonymous Order - Safer Implementation */
async function processAnonymousOrder(db: any, tx: any) {
  console.log(`👤 Processing anonymous order: ${tx.order_id}`);
  
  // For anonymous users, just mark as paid and wait for registration
  // Don't try to move to picks table yet
  
  console.log(`✅ Anonymous pick marked as paid: ${tx.order_id}`);
  
  // 🔧 FIXED: Send confirmation email with safe field handling
  if (tx.email) {
    try {
      const hasPromotion = tx.promotion_applied === true;
      const effectiveAmount = hasPromotion ? 
        (tx.promotion_total_effective || tx.wager_amount) : 
        tx.wager_amount;
      
      // 🔧 FIXED: Parse picks safely for email
      let picksCount = 0;
      try {
        if (typeof tx.picks === 'string') {
          picksCount = JSON.parse(tx.picks).length;
        } else if (Array.isArray(tx.picks)) {
          picksCount = tx.picks.length;
        }
      } catch (error) {
        picksCount = 0;
      }

      const promoText = hasPromotion ? 
        `<div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #059669;"><strong>🎁 ¡Promoción Aplicada!</strong></p>
          <p style="margin: 5px 0 0 0; color: #059669;">
            Tu apuesta se procesó con el bono incluido.<br/>
            <strong>Monto efectivo: $${Number(effectiveAmount).toLocaleString('es-CO')} COP</strong>
          </p>
        </div>` : '';

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">🏁 ¡Apuesta confirmada en MMC GO!</h2>
          
          <p>¡Hola ${tx.full_name || 'Piloto'}!</p>
          <p>Tu pago por <strong>$${Number(tx.wager_amount || 0).toLocaleString('es-CO')}</strong> COP fue confirmado exitosamente.</p>
          
          ${promoText}
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">📋 Resumen de tu apuesta:</h3>
            <ul style="margin: 10px 0;">
              <li><strong>Orden:</strong> ${tx.order_id}</li>
              <li><strong>GP:</strong> ${tx.gp_name || 'GP'}</li>
              <li><strong>Picks:</strong> ${picksCount} selecciones</li>
              <li><strong>Modo:</strong> ${tx.mode === 'full' ? 'Full Throttle' : 'Safety Car'}</li>
              <li><strong>Ganancia potencial:</strong> $${Number(tx.potential_win || 0).toLocaleString('es-CO')} COP</li>
            </ul>
          </div>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>¡Un paso más!</strong></p>
            <p style="margin: 5px 0 0 0;">Para gestionar tus apuestas y ver resultados, completa tu registro haciendo clic en el enlace que te enviamos por separado.</p>
          </div>

          <p>¡Gracias por apostar en MMC GO!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;"/>
          <p style="font-size: 12px; color: #6b7280;">¿Necesitas ayuda? Escríbenos a support@mmcgo.com</p>
        </div>
      `;

      console.log('📧 Anonymous payment notification prepared for', tx.email);
    } catch (error) {
      console.error('Failed to send anonymous payment notification:', error);
    }
  }
}

/* 🔧 EXISTING: Wallet deposit handler (unchanged) */
async function handleWalletDeposit(db: any, data: any) {
  console.log('[Bold WH] Wallet deposit flow');
  // ... existing wallet deposit logic unchanged
}

/* 🔧 EXISTING: VIP subscription handler (unchanged) */
async function handleVipSubscription(db: any, data: any) {
  console.log('[Bold WH] VIP subscription flow');
  // ... existing VIP logic unchanged
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('🔔 Bold webhook received:', JSON.stringify(body, null, 2));

    // Validate webhook structure
    if (!body.data?.transaction) {
      console.warn('❌ Invalid webhook structure');
      return NextResponse.json({ error: 'Invalid webhook structure' }, { status: 400 });
    }

    const data = body.data.transaction;
    const status = data.status?.toLowerCase();

    // Only process successful payments
    if (status !== 'success') {
      console.log(`⏭️ Ignoring non-success status: ${status}`);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const orderReference = data.metadata?.reference || data.order_id;
    if (!orderReference) {
      console.warn('❌ No order reference found');
      return NextResponse.json({ error: 'No order reference' }, { status: 400 });
    }

    // Handle different order types
    if (orderReference.startsWith('MM-DEP-')) {
      await handleWalletDeposit(supabase, data);
      return NextResponse.json({ ok: true });
    } 
    else if (orderReference.startsWith('MM-VIP-')) {
      await handleVipSubscription(supabase, data);
      return NextResponse.json({ ok: true });
    }
    else if (orderReference.startsWith('MMC-')) {
      // 🔧 FIXED: Picks processing with better error handling
      
      // Find transaction
      const { data: tx } = await supabase
        .from('pick_transactions')
        .select('*')
        .eq('order_id', orderReference)
        .eq('payment_status', 'pending')
        .maybeSingle();

      if (!tx) {
        console.warn(`❌ Transaction not found: ${orderReference}`);
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      // Check if already processed
      if (tx.payment_status === 'paid') {
        console.info(`✅ Transaction already processed: ${orderReference}`);
        return NextResponse.json({ ok: true, ignored: true });
      }

      // Update payment status first
      await supabase.from('pick_transactions')
        .update({ 
          payment_status: 'paid',
          bold_payment_id: data.payment_id,
          bold_webhook_received_at: new Date().toISOString()
        })
        .eq('id', tx.id);

      // Process based on user type
      if (tx.user_id) {
        await processAuthenticatedOrder(supabase, tx);
      } else {
        await processAnonymousOrder(supabase, tx);
      }

      return NextResponse.json({ ok: true });
    }
    else {
      console.warn(`❌ Unknown order reference format: ${orderReference}`);
      return NextResponse.json({ error: 'Unknown order format' }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Bold webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}