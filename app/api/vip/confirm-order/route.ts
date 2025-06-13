// 📁 /app/api/vip/confirm-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import { createClient }              from '@supabase/supabase-js';

const SLACK_WEBHOOK = process.env.SLACK_MMC_NEW_VIP_WEBHOOK_URL!;

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

    // 4️⃣ First check if the order exists
    console.log('🔍 Fetching order from database...');
    const { data: existingOrder, error: fetchError } = await sb
      .from('vip_transactions')
      .select('*') // Select all columns for debugging
      .eq('order_id', orderId)
      .single();

    if (fetchError || !existingOrder) {
      console.error('❌ Error fetching order:', fetchError);
      
      // Let's also try to see all orders for this user
      const { data: userOrders, error: userOrdersError } = await sb
        .from('vip_transactions')
        .select('order_id, payment_status')
        .eq('user_id', userId);
      
      console.log('🔍 All orders for user:', userOrders);
      
      return NextResponse.json({ 
        error: 'Order not found', 
        details: fetchError?.message,
        orderId,
        userId,
        userOrders
      }, { status: 404 });
    }

    console.log('🔍 Found order:', existingOrder);

    // Verify the order belongs to the current user
    if (existingOrder.user_id !== userId) {
      console.error('❌ User mismatch:', { 
        orderId, 
        orderUserId: existingOrder.user_id, 
        clerkUserId: userId 
      });
      return NextResponse.json({ 
        error: 'Order does not belong to user',
        orderUserId: existingOrder.user_id,
        clerkUserId: userId
      }, { status: 403 });
    }

    // If already paid, just return success
    if (existingOrder.payment_status === 'paid') {
      console.log('✅ Order already paid');
      return NextResponse.json({ success: true, message: 'Order already confirmed' });
    }

    // 5️⃣ Update payment status to paid and fetch updated row
    console.log('🔍 Updating payment status to paid...');
    const now = new Date().toISOString();
    const { data: updatedTx, error: updateError } = await sb
      .from('vip_transactions')
      .update({ 
        payment_status: 'paid',
        paid_at: now
      })
      .eq('order_id', orderId)
      .select('id, user_id, full_name, plan_id, amount_cop, paid_at')
      .single();

    if (updateError || !updatedTx) {
      console.error('❌ Error updating order:', updateError);
      return NextResponse.json({ 
        error: 'Database update failed', 
        details: updateError?.message,
        updateError
      }, { status: 500 });
    }

    console.log('✅ Order updated successfully:', updatedTx);

    // 6️⃣ Upsert into vip_users
    await sb
      .from('vip_users')
      .upsert(
        {
          id          : updatedTx.user_id,
          entry_tx_id : updatedTx.id,
          joined_at   : updatedTx.paid_at
        },
        { onConflict: 'id' }
      );

    // 7️⃣ Send Slack notification
    const slackPayload = {
      text: [
        '*✅ Pago VIP confirmado*',
        `• Transacción ID: ${updatedTx.id}`,
        `• Usuario: <@${updatedTx.user_id}> (${updatedTx.full_name})`,
        `• Plan: ${updatedTx.plan_id}`,
        `• Monto: $${updatedTx.amount_cop} COP`,
        `• Fecha de pago: ${updatedTx.paid_at}`
      ].join('\n'),
    };

    await fetch(SLACK_WEBHOOK, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(slackPayload)
    });

    console.log('✅ Slack notification sent');

    return NextResponse.json({ 
      success: true,
      updatedOrder: updatedTx
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({ 
      error  : 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack  : error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// Also handle GET requests in case Bold uses GET
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
    body:   JSON.stringify({ orderId })
  });
  
  return POST(mockReq);
}