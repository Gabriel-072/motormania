// 📁 /app/api/vip/confirm-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ Auth
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2️⃣ Get orderId from body
    const body = await req.json();
    const { orderId } = body;
    
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // 3️⃣ First check if the order exists and belongs to this user
    const { data: existingOrder, error: fetchError } = await sb
      .from('vip_transactions')
      .select('user_id, payment_status')
      .eq('order_id', orderId)
      .single();

    if (fetchError || !existingOrder) {
      console.error('Order not found:', orderId);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify the order belongs to the current user
    if (existingOrder.user_id !== userId) {
      console.error('Order does not belong to user:', { orderId, userId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // If already paid, just return success
    if (existingOrder.payment_status === 'paid') {
      return NextResponse.json({ success: true, message: 'Order already confirmed' });
    }

    // 4️⃣ Update payment status to paid
    const { error: updateError } = await sb
      .from('vip_transactions')
      .update({ 
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .eq('user_id', userId); // Extra safety check

    if (updateError) {
      console.error('Error updating VIP order:', updateError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    console.log(`✅ VIP order confirmed: ${orderId} for user ${userId}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in confirm-order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Keep the GET method as well if needed for other purposes
export async function GET(req: NextRequest) {
  // Your existing GET handler code...
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const { error } = await sb
    .from('vip_transactions')
    .update({ payment_status: 'paid' })
    .eq('order_id', orderId);

  if (error) {
    console.error('Error confirming VIP order:', error);
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}