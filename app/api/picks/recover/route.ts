// 📁 app/api/picks/recover/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const recoveryId = searchParams.get('id');

    if (!recoveryId) {
      return NextResponse.json({ error: 'Recovery ID required' }, { status: 400 });
    }

    // Find the pending transaction
    const { data: transaction, error } = await sb
      .from('pick_transactions')
      .select('id, picks, wager_amount, potential_win, mode, gp_name, created_at')
      .eq('id', recoveryId)
      .eq('user_id', userId)
      .eq('payment_status', 'pending')
      .single();

    if (error || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Check if transaction is still valid (within 24 hours)
    const createdAt = new Date(transaction.created_at);
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: 'Recovery link expired' }, { status: 410 });
    }

    return NextResponse.json(transaction);

  } catch (error) {
    console.error('Recovery API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}