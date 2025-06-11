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
  'race-pass'  : { price:  2_000, name: 'Race Pass'   },
  'season-pass': { price: 200_000, name: 'Season Pass' }
};

export async function POST(req: NextRequest) {
  // 1️⃣ Auth
  const { userId, sessionClaims } = await auth(); 
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  // Extraemos nombre y email de Clerk
  const fullName = sessionClaims?.full_name ?? 'Usuario VIP';
  const email    = sessionClaims?.email     ?? '';

  // 2️⃣ Plan
  const { planId } = await req.json();
  const plan       = PLANS[planId as keyof typeof PLANS];
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND' }, { status: 400 });
  }

 // 3️⃣ Generar orden  ── Bold admite máx. ~40 caracteres
const safeUserId  = userId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 12); // 12 chars
const shortStamp  = Date.now().toString(36);                                       // 8–9 chars
const orderId     = `vip-${planId}-${safeUserId}-${shortStamp}`;                   // ≤ 40
const amount      = String(plan.price);

const integritySignature = crypto
  .createHash('sha256')
  .update(`${orderId}${amount}${CURRENCY}${BOLD_SECRET}`)
  .digest('hex');

const redirectionUrl = `${SITE_URL}/fantasy-vip`;

  // 4️⃣ Guardar en Supabase
  const { error } = await sb.from('vip_transactions').insert({
    user_id       : userId,
    full_name     : fullName,
    email         : email,
    plan_id       : planId,
    order_id      : orderId,
    amount_cop    : plan.price,
    payment_status: 'pending'
  });
  if (error) {
    console.error('[register-order]', error);
    return new NextResponse('DB_ERROR', { status: 500 });
  }

  // 5️⃣ Devolver datos al cliente
  return NextResponse.json({
    orderId,
    amount,
    description       : `F1 Fantasy VIP – ${plan.name}`,
    integritySignature,
    redirectionUrl
  });
}