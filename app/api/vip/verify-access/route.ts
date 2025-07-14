import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { orderId, email } = await req.json();

    if (!orderId || !email) {
      return NextResponse.json({
        success: false,
        error: 'Order ID and email required'
      }, { status: 400 });
    }

    // Check transaction exists and is paid
    const { data: transaction, error: transactionError } = await sb
      .from('vip_transactions')
      .select('*')
      .eq('order_id', orderId)
      .eq('payment_status', 'paid')
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json({
        success: false,
        error: 'Transaction not found or not paid'
      });
    }

    // Verify email matches
    const emailMatches = transaction.email === email || 
                        transaction.customer_email === email;

    if (!emailMatches) {
      return NextResponse.json({
        success: false,
        error: 'Email does not match transaction'
      });
    }

    // Check if VIP access exists
    const { data: vipUser } = await sb
      .from('vip_users')
      .select('*')
      .eq('id', transaction.user_id)
      .single();

    if (!vipUser) {
      return NextResponse.json({
        success: false,
        error: 'VIP access not found'
      });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      user: {
        id: vipUser.id,
        email: vipUser.email,
        plan: vipUser.active_plan,
        expiresAt: vipUser.plan_expires_at
      }
    });

  } catch (error) {
    console.error('❌ Access verification error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}