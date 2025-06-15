// 📁 /app/api/vip/confirm-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  console.log('🔍 confirm-order POST called');

  try {
    // 1️⃣ Auth
    const { userId } = await auth();
    console.log('🔍 Clerk User ID:', userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2️⃣ Get orderId from body
    const body = await req.json();
    const { orderId } = body;
    console.log('🔍 Order ID from request:', orderId);
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // 3️⃣ Create Supabase client with service role
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4️⃣ Check if the order exists and belongs to user
    const { data: existingOrder, error: fetchError } = await sb
      .from('vip_transactions')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingOrder) {
      console.error('❌ Error fetching order:', fetchError);
      return NextResponse.json(
        {
          error: 'Order not found',
          details: fetchError?.message,
          orderId,
          userId,
        },
        { status: 404 }
      );
    }

    console.log('🔍 Found order:', {
      orderId: existingOrder.order_id,
      status: existingOrder.payment_status,
      slackNotified: existingOrder.slack_notified
    });

    // If already paid, just return success
    if (existingOrder.payment_status === 'paid') {
      console.log('✅ Order already paid');
      return NextResponse.json({
        success: true,
        message: 'Order already confirmed',
        alreadyPaid: true
      });
    }

    // 5️⃣ Update payment status to paid
    console.log('🔍 Updating payment status to paid...');
    const now = new Date().toISOString();
    const { data: updatedTx, error: updateError } = await sb
      .from('vip_transactions')
      .update({
        payment_status: 'paid',
        paid_at: now,
        manual_confirmation_at: now
      })
      .eq('order_id', orderId)
      .select('*')
      .single();

    if (updateError || !updatedTx) {
      console.error('❌ Error updating order:', updateError);
      return NextResponse.json(
        {
          error: 'Database update failed',
          details: updateError?.message,
        },
        { status: 500 }
      );
    }

    console.log('✅ Order updated successfully');

    // 6️⃣ Get user data from clerk_users
    const { data: clerkUser } = await sb
      .from('clerk_users')
      .select('full_name, email')
      .eq('clerk_id', updatedTx.user_id)
      .single();

    const displayName = clerkUser?.full_name || updatedTx.full_name || 'Sin nombre';
    const displayEmail = clerkUser?.email || updatedTx.email || 'No email';

    // 7️⃣ Upsert into vip_users
    const entryTxId = crypto.randomUUID();
    const activePlan = updatedTx.plan_id;
    const planExpiresAt = updatedTx.plan_id === 'season-pass' 
      ? new Date('2026-12-31').toISOString() 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await sb
      .from('vip_users')
      .upsert(
        {
          id: updatedTx.user_id,
          entry_tx_id: entryTxId,
          joined_at: updatedTx.paid_at,
          full_name: displayName,
          email: displayEmail,
          active_plan: activePlan,
          plan_expires_at: planExpiresAt
        },
        { onConflict: 'id' }
      );

    // 8️⃣ Create vip_entry record
    await sb
      .from('vip_entries')
      .upsert(
        {
          user_id: updatedTx.user_id,
          status: 'approved',
          amount_paid: updatedTx.amount_cop,
          currency: 'COP',
          bold_order_id: orderId, // Using orderId as we don't have bold_payment_id here
          metadata: { source: 'manual_confirmation' }
        },
        { onConflict: 'bold_order_id' }
      );

    // NOTE: We don't send Slack notification here to avoid duplicates
    // The webhook handler is responsible for Slack notifications

    return NextResponse.json({
      success: true,
      message: 'Payment confirmed successfully',
      updatedOrder: {
        orderId: updatedTx.order_id,
        planId: updatedTx.plan_id,
        amount: updatedTx.amount_cop,
        status: updatedTx.payment_status
      }
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle GET requests for URL-based confirmation
export async function GET(req: NextRequest) {
  console.log('🔍 confirm-order GET called');

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  // Reuse the POST logic
  const mockReq = new NextRequest(req.url, {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });

  return POST(mockReq);
}