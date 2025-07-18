// app/api/webhooks/bold-vip/route.ts - SIMPLIFIED FOR FANTASY VIP ONLY (Register First, Pay Later)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOLD_SECRET = process.env.BOLD_WEBHOOK_SECRET_KEY!;

/* ---------------------------- Verify Bold Signature --------------------------- */
function verifyBoldSignature(signature: string, rawBody: string): boolean {
  const bodyB64 = Buffer.from(rawBody).toString('base64');
  const expected = crypto
    .createHmac('sha256', BOLD_SECRET)
    .update(bodyB64)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

/* ---------------------------- Submit VIP Prediction --------------------------- */
async function submitVipPrediction(userId: string, predictions: any, gpName: string) {
  try {
    console.log('🎯 Submitting VIP prediction for user:', userId, 'GP:', gpName);

    // Check for existing prediction for this GP and user
    const { data: existingPrediction } = await supabase
      .from('predictions')
      .select('id')
      .eq('user_id', userId)
      .eq('gp_name', gpName)
      .single();

    if (existingPrediction) {
      return { success: false, error: 'Ya existe una predicción para este GP' };
    }

    // Insert VIP prediction
    const submissionTime = new Date();
    const week = Math.ceil(
      (submissionTime.getTime() - new Date(submissionTime.getFullYear(), 0, 1).getTime()) / 
      (7 * 24 * 60 * 60 * 1000)
    );

    const { error: predictionError } = await supabase
      .from('predictions')
      .insert({
        user_id: userId,
        gp_name: gpName,
        ...predictions,
        is_vip: true, // 🔥 Mark as VIP prediction
        submitted_at: submissionTime.toISOString(),
        submission_week: week,
        submission_year: submissionTime.getFullYear()
      });

    if (predictionError) {
      console.error('❌ Error inserting VIP prediction:', predictionError);
      return { success: false, error: 'Error guardando predicción VIP' };
    }

    // Update user's VIP status in leaderboard
    const { error: leaderboardError } = await supabase
      .from('leaderboard')
      .update({ is_vip: true })
      .eq('user_id', userId);

    if (leaderboardError) {
      console.error('⚠️ Error updating leaderboard VIP status:', leaderboardError);
      // Don't fail the whole process for this
    }

    console.log('✅ VIP prediction submitted successfully for user:', userId);
    return { success: true };

  } catch (error) {
    console.error('❌ Error in submitVipPrediction:', error);
    return { success: false, error: 'Error interno al procesar predicción VIP' };
  }
}

/* ---------------------------- Track Facebook Events --------------------------- */
async function trackFacebookPurchase(orderData: any, paymentData: any, request: NextRequest) {
  try {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const accessToken = process.env.META_CAPI_TOKEN;

    if (!pixelId || !accessToken) {
      console.log('⏭️ Facebook tracking disabled - missing credentials');
      return;
    }

    const eventId = crypto.randomUUID();
    
    // Hash user email for Facebook
    const hashedEmail = crypto
      .createHash('sha256')
      .update(orderData.user_email.toLowerCase().trim())
      .digest('hex');

    // Extract name parts for hashing
    const nameParts = (orderData.user_name || '').toLowerCase().trim().split(' ');
    const hashedFirstName = nameParts[0] 
      ? crypto.createHash('sha256').update(nameParts[0]).digest('hex')
      : undefined;
    const hashedLastName = nameParts.slice(1).join(' ')
      ? crypto.createHash('sha256').update(nameParts.slice(1).join(' ')).digest('hex')
      : undefined;

    // Get client info from request headers
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     request.headers.get('cf-connecting-ip') ||
                     '127.0.0.1';
    
    const userAgent = request.headers.get('user-agent') || '';

    const fbPayload = {
      data: [{
        event_name: 'Purchase',
        event_id: eventId,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy?vip_success=${orderData.order_id}`,
        action_source: 'website',
        user_data: {
          em: [hashedEmail],
          fn: hashedFirstName ? [hashedFirstName] : undefined,
          ln: hashedLastName ? [hashedLastName] : undefined,
          client_ip_address: clientIp,
          client_user_agent: userAgent,
        },
        custom_data: {
          content_ids: ['fantasy_vip'],
          content_type: 'product',
          content_category: 'fantasy_vip_prediction',
          content_name: `Fantasy VIP - ${orderData.gp_name}`,
          value: orderData.amount_cop / 1000, // Convert to COP thousands
          currency: 'COP',
          num_items: 1,
          transaction_id: paymentData.payment_id || paymentData.id,
          order_id: orderData.order_id,
          payment_method: 'bold_checkout',
          purchase_type: 'fantasy_vip_single',
          gp_name: orderData.gp_name,
          conversion_source: 'fantasy_vip_webhook',
          funnel_stage: 'purchase_completed',
          user_already_registered: true // 🔥 Register-first flow
        }
      }],
      access_token: accessToken,
      test_event_code: process.env.FB_TEST_EVENT_CODE || undefined
    };

    const fbResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pixelId}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fbPayload)
      }
    );

    if (fbResponse.ok) {
      const fbResult = await fbResponse.json();
      console.log('✅ Facebook Purchase event tracked:', {
        event_id: eventId,
        order_id: orderData.order_id,
        events_received: fbResult.events_received,
        fb_trace_id: fbResult.fbtrace_id
      });
    } else {
      const errorText = await fbResponse.text();
      console.error('❌ Facebook tracking failed:', errorText);
    }

  } catch (error) {
    console.error('❌ Facebook tracking error (non-critical):', error);
  }
}

/* ---------------------------- Main Webhook Handler --------------------------- */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-bold-signature') ?? '';

  console.log('🎯 Fantasy VIP webhook received');

  // Verify Bold signature
  if (!verifyBoldSignature(signature, rawBody)) {
    console.error('❌ Invalid Bold signature');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  console.log('🎯 Webhook event type:', event.type);

  // Only process approved payments
  if (event.type !== 'SALE_APPROVED' && event.type !== 'PAYMENT_APPROVED') {
    console.log('⏭️ Ignoring event type:', event.type);
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const data = event.data;
    const orderId = data.metadata?.reference || data.order_id || data.external_reference;

    if (!orderId) {
      console.error('❌ No order ID in webhook');
      return NextResponse.json({ ok: false, error: 'No order ID found' });
    }

    // Only process fantasy VIP orders
    if (!orderId.startsWith('fantasy_vip_')) {
      console.log('⏭️ Not a fantasy VIP order, ignoring');
      return NextResponse.json({ ok: true, ignored: true });
    }

    console.log('🎮 Processing fantasy VIP payment for order:', orderId);

    // Get the pending fantasy VIP order
    const { data: orderData, error: orderError } = await supabase
      .from('fantasy_vip_orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .single();

    if (orderError || !orderData) {
      console.error('❌ Fantasy VIP order not found or already processed:', orderId);
      return NextResponse.json({ 
        ok: false, 
        error: 'Order not found or already processed' 
      });
    }

    console.log('✅ Found pending fantasy VIP order for user:', orderData.user_id);

    // Submit the VIP prediction
    const submissionResult = await submitVipPrediction(
      orderData.user_id,
      orderData.predictions,
      orderData.gp_name
    );

    if (!submissionResult.success) {
      console.error('❌ Failed to submit VIP prediction:', submissionResult.error);
      
      // Mark order as failed
      await supabase
        .from('fantasy_vip_orders')
        .update({ 
          status: 'failed',
          error_message: submissionResult.error,
          processed_at: new Date().toISOString()
        })
        .eq('order_id', orderId);

      return NextResponse.json({ 
        ok: false, 
        error: submissionResult.error 
      });
    }

    // Mark order as completed
    const { error: updateError } = await supabase
      .from('fantasy_vip_orders')
      .update({
        status: 'completed',
        bold_payment_id: data.payment_id || data.id,
        processed_at: new Date().toISOString(),
        payment_data: data
      })
      .eq('order_id', orderId);

    if (updateError) {
      console.error('❌ Error updating order status:', updateError);
    }

    // Create/update simplified VIP user record
    const planExpiresAt = new Date();
    planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1); // VIP for 1 year

    const { error: vipUserError } = await supabase
      .from('vip_users')
      .upsert({
        id: orderData.user_id,
        joined_at: new Date().toISOString(),
        full_name: orderData.user_name,
        email: orderData.user_email,
        active_plan: 'fantasy_vip',
        plan_expires_at: planExpiresAt.toISOString(),
        created_via_pay_first: false // 🔥 Register-first flow
      }, { onConflict: 'id' });

    if (vipUserError) {
      console.error('❌ Error creating VIP user record:', vipUserError);
      // Don't fail the whole process for this
    }

    // Track Facebook purchase event
    await trackFacebookPurchase(orderData, data, request);

    console.log('✅ Fantasy VIP payment processed successfully');

    return NextResponse.json({
      ok: true,
      processed: true,
      order_id: orderId,
      user_id: orderData.user_id,
      gp_name: orderData.gp_name,
      amount_cop: orderData.amount_cop,
      plan_expires_at: planExpiresAt.toISOString(),
      message: 'Fantasy VIP prediction submitted successfully',
      redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy?vip_success=${orderId}`,
      webhook_processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Fantasy VIP webhook processing error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}