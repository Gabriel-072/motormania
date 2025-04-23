import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;

export async function POST(req: NextRequest) {
  try {
    // ✅ Esperar correctamente la promesa de auth
    const authResult = await auth();

    const userId: string | null = authResult.userId;
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { amount } = await req.json();
    if (!amount || typeof amount !== 'number') {
      return new NextResponse('Invalid amount', { status: 400 });
    }

    const timestamp = Date.now().toString();
    const orderId = `ORDER-${userId}-${timestamp}`;
    const redirectUrl = `${APP_URL}/dashboard?payment_confirmed=true`;

    const dataToSign = `${orderId}${amount}${redirectUrl}${BOLD_SECRET_KEY}`;
    const integritySignature = crypto
      .createHmac('sha256', BOLD_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');

    return NextResponse.json({
      orderId,
      amount,
      redirectUrl,
      integritySignature,
      metadata: {
        reference: orderId,
      },
    });
  } catch (err) {
    console.error('Hash generation error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}