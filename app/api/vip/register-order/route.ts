// 📁 app/api/vip/register-order/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import { createClient }              from '@supabase/supabase-js';
import crypto                        from 'crypto';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOLD_SECRET = process.env.BOLD_SECRET_KEY!;
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL!;
const CURRENCY    = 'COP';

const PLANS: Record<string, { price: number; name: string }> = {
  'race-pass'  : { price:  20_000, name: 'Race Pass'   },
  'season-pass': { price: 80_000, name: 'Season Pass' }
};

export async function POST(req: NextRequest) {
  /* ───────────── 1️⃣ Auth ───────────── */
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  /* ───────────── 1.5️⃣ Get user data from clerk_users table ───────────── */
  const { data: clerkUser } = await sb
    .from('clerk_users')
    .select('full_name, email')
    .eq('clerk_id', userId)
    .single();

  // Use data from clerk_users table, with fallbacks
  const fullName = clerkUser?.full_name || 'Sin nombre';
  const email = clerkUser?.email || '';

  /* ───────────── 2️⃣ Plan ───────────── */
  const { planId } = await req.json();
  const plan       = PLANS[planId as keyof typeof PLANS];
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND' }, { status: 400 });
  }

  /* ───────────── 2.5️⃣ Get Active GP for Race Pass ───────────── */
  let activeGp = null;
  if (planId === 'race-pass') {
    const { data: gpData } = await sb
      .from('gp_schedule')
      .select('gp_name, qualy_time, race_time')
      .gte('qualy_time', new Date().toISOString()) // Predictions close at qualy time
      .order('race_time', { ascending: true })
      .limit(1)
      .single();
    
    activeGp = gpData?.gp_name || null;
    
    if (!activeGp) {
      return NextResponse.json({ 
        error: 'NO_ACTIVE_GP',
        message: 'No hay ningún Gran Premio activo para predicciones en este momento.' 
      }, { status: 400 });
    }
  }

  /* ───────────── 3️⃣ Generar orden (≤ 40 chars) ───────────── */
  const safeUserId = userId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 12);
  const shortStamp = Date.now().toString(36);
  const orderId    = `vip-${planId}-${safeUserId}-${shortStamp}`; // p.ej: vip-race-pass-abc123-kg9hf5
  const amount     = String(plan.price);
  
  const integritySignature = crypto
    .createHash('sha256')
    .update(`${orderId}${amount}${CURRENCY}${BOLD_SECRET}`)
    .digest('hex');

  const redirectionUrl = `${SITE_URL}/fantasy-vip-success?orderId=${orderId}`;

  /* ───────────── 4️⃣ Guardar orden en Supabase ───────────── */
  const { error } = await sb.from('vip_transactions').insert({
    user_id       : userId,
    full_name     : fullName,    // Now from clerk_users table
    email         : email,        // Now from clerk_users table
    plan_id       : planId,
    order_id      : orderId,
    amount_cop    : plan.price,
    payment_status: 'pending',
    selected_gp   : activeGp // Auto-assigned for race-pass, null for season-pass
  });

  if (error) {
    console.error('[register-order]', error);
    return new NextResponse('DB_ERROR', { status: 500 });
  }

  /* ───────────── 5️⃣ Respuesta al cliente ───────────── */
  return NextResponse.json({
    orderId,
    amount,
    description       : `F1 Fantasy VIP – ${plan.name}${activeGp ? ` (${activeGp})` : ''}`,
    integritySignature,
    redirectionUrl,
    activeGp          : activeGp // Include in response so frontend can show it
  });
}