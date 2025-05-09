// 📁 app/api/promocodes/redeem/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth }                     from '@clerk/nextjs/server';
import { createClient }             from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  let code: string;
  try {
    const { code: bodyCode } = await req.json();
    code = String(bodyCode || '').trim().toUpperCase();
    if (!code) throw new Error();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Buscar promo
  const { data: promo, error: codeErr } = await supabase
    .from('promo_codes')
    .select('id,fuel_amount,mmc_amount,max_uses,expires_at')
    .eq('code', code)
    .maybeSingle();

  if (codeErr || !promo) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 404 });
  }
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Código expirado' }, { status: 400 });
  }

  // 2. Conteo de usos totales
  const { count } = await supabase
    .from('promo_code_redemptions')
    .select('id', { count: 'exact' })
    .eq('code_id', promo.id);
  if (count! >= promo.max_uses) {
    return NextResponse.json({ error: 'Código agotado' }, { status: 400 });
  }

  // 3. Verificar uso por este usuario
  const { data: used } = await supabase
    .from('promo_code_redemptions')
    .select('id')
    .eq('code_id', promo.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (used) {
    return NextResponse.json({ error: 'Ya canjeaste este código' }, { status: 400 });
  }

  // 4. Insertar canjeo
  const { error: insErr } = await supabase
    .from('promo_code_redemptions')
    .insert({ code_id: promo.id, user_id: userId });
  if (insErr) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }

  // 5. Incrementar wallet
  const { error: rpcErr } = await supabase.rpc('increment_wallet_balances', {
    uid        : userId,
    mmc_amount : promo.mmc_amount,
    fuel_amount: promo.fuel_amount,
    cop_amount : 0
  });
  if (rpcErr) {
    return NextResponse.json({ error: 'Error actualizando billetera' }, { status: 500 });
  }

  return NextResponse.json({
    message: `¡Código aplicado! +${promo.fuel_amount} Fuel y +${promo.mmc_amount} MMC`
  });
}