import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const BOLD_CURRENCY = 'COP';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { amount } = await req.json();
  if (typeof amount !== 'number' || amount <= 0) {
    return new NextResponse('Invalid amount', { status: 400 });
  }

  const timestamp = Date.now().toString();
  const orderId = `ORDER-${userId}-${timestamp}`;
  const redirectUrl = `${APP_URL}/dashboard?bold-tx-status=approved&bold-order-id=${orderId}`;
  const amountStr = amount.toFixed(2);

  const dataToSign = `${orderId}${amountStr}${BOLD_CURRENCY}`;
  const integritySignature = crypto
    .createHmac('sha256', BOLD_SECRET_KEY)
    .update(dataToSign)
    .digest('hex');

  return NextResponse.json({
    orderId,
    amount,
    redirectUrl,
    integritySignature,
    metadata: { reference: orderId },
  });
}