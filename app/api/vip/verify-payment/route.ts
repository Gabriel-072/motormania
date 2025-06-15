// 📁 /app/api/vip/verify-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/vip-helpers';

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2️⃣ Get orderId from request
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // 3️⃣ Query transaction status
    const sb = createServiceClient();
    const { data: transaction, error } = await sb
      .from('vip_transactions')
      .select('payment_status, plan_id, amount_cop, paid_at')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .single();

    if (error || !transaction) {
      console.error('Error fetching transaction:', error);
      return NextResponse.json(
        { 
          error: 'Transaction not found',
          isPaid: false 
        }, 
        { status: 404 }
      );
    }

    // 4️⃣ Check VIP user status
    const { data: vipUser } = await sb
      .from('vip_users')
      .select('id, active_plan, plan_expires_at')
      .eq('id', userId)
      .single();

    // 5️⃣ Return verification result
    return NextResponse.json({
      isPaid: transaction.payment_status === 'paid',
      planId: transaction.plan_id,
      amount: transaction.amount_cop,
      paidAt: transaction.paid_at,
      hasVipAccess: !!vipUser,
      activePlan: vipUser?.active_plan,
      expiresAt: vipUser?.plan_expires_at
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        isPaid: false 
      },
      { status: 500 }
    );
  }
}