// 📁 /app/api/transactions/register-pick-transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth }                     from '@clerk/nextjs/server';
import { createClient }             from '@supabase/supabase-js';
import crypto                       from 'crypto';

// ──────────────────────────────
// ENV + Supabase
// ──────────────────────────────
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BOLD_SECRET  = process.env.BOLD_SECRET_KEY!;
const SITE_URL     = process.env.NEXT_PUBLIC_SITE_URL!;
const CURRENCY     = 'COP';

// ────────── tablas de multiplicadores ──────────
const payoutCombos : Record<number, number>   = { 2:3,3:6,4:10,5:20,6:35,7:60,8:100 };
const safetyPayouts: Record<number, number[]> = { 3:[2],4:[5],5:[10],6:[20],7:[30],8:[50] };

function calcMultiplier(cnt:number, mode:'full'|'safety'){
  return mode==='full' ? (payoutCombos[cnt]??0) : (safetyPayouts[cnt]?.[0]??0);
}

// ──────────────────────────────
// POST  /api/transactions/register-pick-transaction
// ──────────────────────────────
export async function POST(req:NextRequest){
  try{
    /* 1️⃣  Auth segura */
    const { userId } = await auth();
    if(!userId) return new NextResponse('Unauthorized', { status: 401 });

    /* 2️⃣  Body */
    interface Body {
      picks : any[];                    // PickSelection[]
      mode  : 'full'|'safety';
      amount: number;                   // int (COP)
      gpName: string;
      fullName?: string;
      email?: string;
    }
    const body:Body = await req.json();
    const { picks, mode='full', amount, gpName } = body;

    /* 3️⃣  Validación mínima */
    if(!Array.isArray(picks) || picks.length<2 || picks.length>8)
      return NextResponse.json({ error:'Nº de picks inválido'}, {status:400});
    if(amount<10000) return NextResponse.json({ error:'Monto mínimo $10.000'}, {status:400});
    if(mode==='safety' && picks.length<3)
      return NextResponse.json({ error:'Safety requiere ≥3 picks'},{status:400});

    /* 4️⃣  Cálculos */
    const multiplier   = calcMultiplier(picks.length, mode);
    const potentialWin = multiplier * amount;
    const orderId      = `MMC-${userId}-${Date.now()}`;
    const amountStr    = String(amount);

    // Firma SHA-256  (orderId + amount + currency + secret)
    const integrityKey = crypto
      .createHash('sha256')
      .update(`${orderId}${amountStr}${CURRENCY}${BOLD_SECRET}`)
      .digest('hex');

    const callbackUrl  = `${SITE_URL}/dashboard?bold_order_id=${orderId}`;

    /* 5️⃣  Guardar fila pending */
    const { error:dbErr } = await sb.from('pick_transactions').insert({
      user_id      : userId,
      full_name    : body.fullName  ?? 'Jugador MMC',
      email        : body.email,
      order_id     : orderId,
      gp_name      : gpName,
      picks,
      mode,
      multiplier,
      potential_win: potentialWin,
      wager_amount : amount,
      payment_status:'pending'
    });
    if(dbErr) throw dbErr;

    /* 6️⃣  Respuesta para el frontend */
    return NextResponse.json({
      orderId,
      amount      : amountStr, // string para Bold
      callbackUrl,
      integrityKey
    });

  }catch(err:any){
    console.error('register-pick-transaction:', err);
    return NextResponse.json({ error:'Internal server error' }, { status: 500 });
  }
}