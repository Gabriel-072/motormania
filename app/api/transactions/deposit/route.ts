// 📁 app/api/transactions/deposit/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import crypto                        from 'crypto';

/* ───────── ENV ACTUALES ─────────
 * NEXT_PUBLIC_BOLD_BUTTON_KEY  → pública, la usa el frontend
 * BOLD_SECRET_KEY              → la “Secret Key” del Payment Button (no la del webhook)
 * NEXT_PUBLIC_SITE_URL         → https://motormaniacolombia.com
 */
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const SITE_URL        = process.env.NEXT_PUBLIC_SITE_URL!;

export async function POST(req: NextRequest) {
  // 0. Auth
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  // 1. Parse & validate body
  let amount: number;
  try {
    const { amount: raw } = await req.json();
    amount = Number(raw);
    if (!amount || amount <= 0) throw new Error();
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 2. Build a unique orderId
  const orderId = `MM-DEP-${userId}-${Date.now()}`;

  // 3. For COP, use an integer string (no decimals)
  const amountStr = amount.toString(); // e.g. "20000"

  // 4. Compute HMAC-SHA256 exactly over "orderId|amountStr|COP"
  const payload      = `${orderId}|${amountStr}|COP`;
  const integrityKey = crypto
    .createHmac('sha256', BOLD_SECRET_KEY)
    .update(payload)
    .digest('hex');

  // 5. Return everything the widget needs
  return NextResponse.json({
    orderId,
    amount     : amountStr,
    callbackUrl: `${SITE_URL}/wallet`,
    integrityKey
  });
}