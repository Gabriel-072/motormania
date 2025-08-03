// 📁 app/api/wallet-promo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth }                    from '@clerk/nextjs/server';
import { createClient }            from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: NextRequest) {
  // Autenticación
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  // 1. Wallet
  const { data: wallet, error: wErr } = await supabase
    .from('wallet')
    .select('balance_cop,withdrawable_cop')
    .eq('user_id', userId)
    .single();
  if (wErr) return new NextResponse(wErr.message, { status: 500 });

  // 2. Promo progres
  const { data: pr } = await supabase
    .from('promotions_user')
    .select('wager_remaining_mmc, locked_amount_mmc')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  const promo = pr
    ? { remaining: pr.wager_remaining_mmc, total: pr.locked_amount_mmc * 2 }
    : null;

  // 3. Transacciones recientes
  const { data: txs, error: tErr } = await supabase
    .from('transactions')
    .select('id,type,amount,description,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (tErr) return new NextResponse(tErr.message, { status: 500 });

  return NextResponse.json({ wallet, promo, txs });
}