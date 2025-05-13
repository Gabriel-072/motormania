// 📁 app/api/transactions/deposit/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import crypto                        from 'crypto';

/* ───────── ENV ACTUALES ─────────
 * NEXT_PUBLIC_BOLD_BUTTON_KEY  → pública, la usa el frontend
 * BOLD_SECRET_KEY              → **private key**  (la usamos aquí)
 * NEXT_PUBLIC_SITE_URL         → https://motormaniacolombia.com
 */
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const SITE_URL        = process.env.NEXT_PUBLIC_SITE_URL!;

/**
 *  POST  →  { amount:number }
 *  RESP  ←  { orderId, amount, callbackUrl, integrityKey }
 */
export async function POST(req: NextRequest) {
  /* 0. Auth -------------------------------------------------- */
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  /* 1. Body -------------------------------------------------- */
  let amount: number;
  try {
    const { amount: bodyAmt } = await req.json();
    amount = Number(bodyAmt);
    if (!amount || amount <= 0) throw new Error();
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  /* 2. Genera orderId único --------------------------------- */
  const orderId   = `MM-DEP-${userId}-${Date.now()}`;
  const amountStr = String(amount); // sin decimales

  /* 3. Firma SHA-256 requerida por Bold --------------------- */
  // concatenamos exactamente como en register-pick-transaction
  const payload      = `${orderId}${amountStr}COP${BOLD_SECRET_KEY}`;
  const integrityKey = crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');

  /* 4. Respuesta -------------------------------------------- */
  return NextResponse.json({
    orderId,
    amount     : amountStr,      // la librería Bold espera string entero
    callbackUrl: `${SITE_URL}/wallet`,
    integrityKey
  });
}