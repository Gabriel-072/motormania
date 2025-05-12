// 📁 app/api/transactions/deposit/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import crypto                        from 'crypto';

const { BOLD_SECRET_KEY, NEXT_PUBLIC_SITE_URL } = process.env;
const CURRENCY = 'COP';

export async function POST(req: NextRequest) {
  // 1) Auth
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  // 2) Parse & validate amount
  let { amount } = await req.json().catch(() => ({}));
  amount = Number(amount);
  if (!amount || amount <= 0) return new NextResponse('Invalid amount', { status: 400 });

  // 3) Build orderId & amountStr
  const orderId   = `MM-DEP-${userId}-${Date.now()}`;
  const amountStr = amount.toString();  // e.g. "20000"

  // 4) Compute plain SHA-256 of concatenation:
  //    `${orderId}${amountStr}${CURRENCY}${BOLD_SECRET_KEY}`
  const integrityKey = crypto
    .createHash('sha256')
    .update(orderId + amountStr + CURRENCY + BOLD_SECRET_KEY!)
    .digest('hex');

  // 5) Return to frontend exactly what openBoldCheckout() needs
  return NextResponse.json({
    orderId,
    amount       : amountStr,
    callbackUrl  : `${NEXT_PUBLIC_SITE_URL}/wallet`,
    integrityKey
  });
}