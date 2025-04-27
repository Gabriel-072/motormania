// 📁 /app/api/transactions/register-pick-transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, fullName, orderId, gpName, wagerAmount } = await req.json();

    const { error } = await supabase.from('pick_transactions').insert({
      user_id: userId,
      full_name: fullName,
      order_id: orderId,
      gp_name: gpName,
      wager_amount: wagerAmount,
      payment_status: 'pending',
    });

    if (error) {
      console.error('❌ Error inserting pick transaction:', error);
      return new NextResponse('Error inserting transaction', { status: 500 });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('❌ Error in register-pick-transaction route:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}