// 📁 app/api/transactions/deposit/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth }                    from '@clerk/nextjs/server';
import crypto                      from 'crypto';

/* ───────── ENV ─────────
 * NEXT_PUBLIC_BOLD_BUTTON_KEY → pública (frontend)
 * BOLD_SECRET_KEY             → private key Bold
 * NEXT_PUBLIC_SITE_URL        → https://motormaniacolombia.com
 */
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const SITE_URL        = process.env.NEXT_PUBLIC_SITE_URL!;

export async function POST(req: NextRequest) {
  // 0. Auth
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  // 1. Validar body
  let amount: number;
  try {
    const body = await req.json();
    amount = Number(body?.amount);
    if (!amount || amount <= 0) throw new Error();
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 2. Construir orderId único
  const orderId   = `MM-DEP-${userId}-${Date.now()}`;
  const amountStr = String(amount); 

  // 3. HMAC-SHA256 sobre payload
  const payload = `${orderId}|${amountStr}|COP`;
  const integrityKey = crypto
    .createHmac('sha256', BOLD_SECRET_KEY)
    .update(payload)
    .digest('hex');

  // 4. Responder
  return NextResponse.json({
    orderId,
    amount     : amountStr,
    callbackUrl: `${SITE_URL}/wallet`,
    integrityKey
  });
}