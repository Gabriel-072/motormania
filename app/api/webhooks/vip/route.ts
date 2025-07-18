// app/api/webhooks/vip/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOLD_SECRET = process.env.BOLD_WEBHOOK_SECRET_KEY!;

// Verify Bold signature
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

// Submit VIP prediction
async function submitVipPrediction(userId: string, predictions: any, gpName: string) {
  try {
    console.log('🎯 Submitting VIP prediction for user:', userId, 'GP:', gpName);

    // Check for existing prediction
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-bold-signature') ?? '';

  console.log('🎯 VIP webhook received');

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

    // Only process VIP orders
    if (!orderId.startsWith('vip_')) {
      console.log('⏭️ Not a VIP order, ignoring');
      return NextResponse.json({ ok: true, ignored: true });
    }

    console.log('🎮 Processing VIP payment for order:', orderId);

    // Get the pending VIP order
    const { data: orderData, error: orderError } = await supabase
      .from('vip_orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .single();

    if (orderError || !orderData) {
      console.error('❌ VIP order not found or already processed:', orderId);
      return NextResponse.json({ 
        ok: false, 
        error: 'Order not found or already processed' 
      });
    }

    console.log('✅ Found pending VIP order for user:', orderData.user_id);

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
        .from('vip_orders')
        .update({ 
          status: 'failed',
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
      .from('vip_orders')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (updateError) {
      console.error('❌ Error updating order status:', updateError);
    }

    console.log('✅ VIP payment processed successfully');

    return NextResponse.json({
      ok: true,
      processed: true,
      order_id: orderId,
      user_id: orderData.user_id,
      gp_name: orderData.gp_name,
      message: 'VIP prediction submitted successfully',
      webhook_processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ VIP webhook processing error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}