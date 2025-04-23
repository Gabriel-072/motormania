import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;

export async function POST(req: NextRequest) {
  try {
    const authResult = await auth();
    const userId: string | null = authResult.userId;
    if (!userId) {
      console.error('No userId found in authResult');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { amount } = await req.json();
    console.log('Received request body:', { amount });
    if (!amount || typeof amount !== 'number') {
      console.error('Invalid amount:', amount);
      return new NextResponse('Invalid amount', { status: 400 });
    }

    const timestamp = Date.now().toString();
    const orderId = `ORDER-${userId}-${timestamp}`;
    const redirectUrl = `${APP_URL}/dashboard?payment_confirmed=true`;

    const amountStr = Math.round(amount).toString();
    const dataToSign = `${orderId}${amountStr}${redirectUrl}${BOLD_SECRET_KEY}`;
    
    console.log('Data to sign:', { orderId, amountStr, redirectUrl, dataToSign });

    const integritySignature = crypto
      .createHmac('sha256', BOLD_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');

    console.log('Generated signature:', integritySignature);

    const response = {
      orderId,
      amount,
      redirectUrl,
      integritySignature,
      metadata: {
        reference: orderId,
      },
    };
    console.log('Response:', response);

    return NextResponse.json(response);
  } catch (err) {
    console.error('Hash generation error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}