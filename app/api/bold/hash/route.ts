import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const BOLD_CURRENCY = 'COP';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { amount } = await req.json();
    const amountInt = Math.round(amount);
    if (!Number.isInteger(amountInt) || amountInt <= 0) {
      return new NextResponse('Invalid amount', { status: 400 });
    }

    // build and sign
    const timestamp = Date.now().toString();
    const orderId = `ORDER-${userId}-${timestamp}`;
    const dataToSign = `${orderId}${amountInt}${BOLD_CURRENCY}`;
    const integrityKey = crypto
      .createHmac('sha256', BOLD_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');

    const callbackUrl = `${APP_URL}/dashboard?bold-order-id=${orderId}&bold-tx-status=approved`;

    console.log('🔐 Firma Bold generada:', { dataToSign, integrityKey });

    return NextResponse.json({
      orderId,
      amount: amountInt,
      callbackUrl,
      integrityKey,
      metadata: { reference: orderId },
    });
  } catch (e) {
    console.error('🔥 Error en hash Bold:', e);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}