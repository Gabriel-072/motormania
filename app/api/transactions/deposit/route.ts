// 📁 app/api/transactions/deposit/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import crypto                        from 'crypto';

/* ───────── ENV ───────── */
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;          // llave privada Bold
const SITE_URL        = process.env.NEXT_PUBLIC_SITE_URL!;     // p. ej. https://motormaniacolombia.com

/**
 *  POST  →  { amount:number }
 *  RESP  ←  { orderId, amount, callbackUrl, integrityKey }
 */
export async function POST(req: NextRequest) {
  /* 0. Auth */
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  /* 1. Valida body */
  let amount: number;
  try {
    const body = await req.json();
    amount = Number(body?.amount);
    if (!amount || amount <= 0) throw new Error();
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  /* 2. orderId único */
  const orderId = `MM-DEP-${userId}-${Date.now()}`;

  /* 3. Firma HMAC-SHA256 requerida por Bold */
  const payload      = `${orderId}|${amount}|COP`;
  const integrityKey = crypto
    .createHmac('sha256', BOLD_SECRET_KEY)
    .update(payload)
    .digest('hex');

  /* 4. Respuesta */
  return NextResponse.json({
    orderId,
    amount      : amount.toString(),       // Bold widget espera string
    callbackUrl : `${SITE_URL}/wallet`,    // redirección tras pago
    integrityKey
  });
}