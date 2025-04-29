// 📁 app/api/withdraw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';      // ← usamos el SDK directo

// ---------- Constantes ----------
const MIN_WITHDRAW = 10_000;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!             // service-role key
);

// ---------- Handler ----------
export async function POST(req: NextRequest) {
  /* Clerk */
  const { userId } = await auth();                   // ← await corrige el error TS
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  /* Body */
  const { amount, method, account } = await req.json();
  if (!amount || amount < MIN_WITHDRAW)
    return new NextResponse(`Monto mínimo ${MIN_WITHDRAW}`, { status: 400 });
  if (!method || !account)
    return new NextResponse('Método y cuenta requeridos', { status: 400 });

  /* 1. Restar saldo retirable */
  const { error: decErr } = await supabase.rpc('decrement_withdrawable', {
    _uid: userId,
    _cop: amount,
  });
  if (decErr) return new NextResponse(decErr.message, { status: 400 });

  /* 2. Crear solicitud */
  const { data: reqRow, error: insErr } = await supabase
    .from('withdrawal_requests')
    .insert({ user_id: userId, amount, method, account })
    .select('id')
    .single();
  if (insErr) return new NextResponse(insErr.message, { status: 400 });

  /* 3. Registrar transacción pendiente */
  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'retiro_pending',
    amount: -amount,
    description: `Retiro solicitado (#${reqRow.id})`,
  });

  return NextResponse.json({ ok: true, requestId: reqRow.id });
}