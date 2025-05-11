// 📁 app/api/transactions/deposit/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import { createClient }              from '@supabase/supabase-js';

/* ────── ENV ────── */
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/* ────── HELPERS ────── */
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

/**
 * Cuerpo esperado:
 * { orderId: string; amount: number }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  let body: { orderId?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }
  const { orderId, amount } = body;
  if (!orderId || !amount || amount <= 0)
    return new NextResponse('Invalid payload', { status: 400 });

  const desc = `Depósito wallet Bold (Ref:${orderId})`;

  /* Idempotencia */
  const { data: already } = await sb
    .from('transactions')
    .select('id')
    .eq('description', desc)
    .maybeSingle();
  if (already) return NextResponse.json({ ok: true, already: true });

  /* 1. Aplica promo / actualiza wallet (la RPC decide si duplica) */
  const { error: promoErr } = await sb.rpc('apply_deposit_promo', {
    p_user_id:     userId,
    p_amount_cop:  amount
  });
  if (promoErr)
    return new NextResponse(promoErr.message, { status: 500 });

  /* 2. Inserta transacción */
  const { error: txErr } = await sb.from('transactions').insert({
    user_id:    userId,
    type:       'recarga',
    amount:     amount,
    description: desc
  });
  if (txErr)
    return new NextResponse(txErr.message, { status: 500 });

  return NextResponse.json({ ok: true });
}