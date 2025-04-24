import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

// 🔐 Env Vars
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const BOLD_CURRENCY = 'COP';

export async function POST(req: NextRequest) {
  try {
    // Clerk Auth
    const { userId } = await auth();
    if (!userId) {
      console.error('❌ userId no encontrado');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse input
    const { amount } = await req.json();
    const amountInt = Math.round(amount);

    if (!Number.isInteger(amountInt) || amountInt <= 0) {
      console.error('❌ Monto inválido:', amount);
      return new NextResponse('Invalid amount', { status: 400 });
    }

    // 🔐 Firmar Bold: orderId + amountInt + currency
    const timestamp = Date.now().toString();
    const orderId = `ORDER-${userId}-${timestamp}`;
    const dataToSign = `${orderId}${amountInt}${BOLD_CURRENCY}`;
    const integritySignature = crypto
      .createHmac('sha256', BOLD_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');

    const redirectUrl = `${APP_URL}/dashboard?bold-order-id=${orderId}&bold-tx-status=approved`;

    console.log('🔐 Firma Bold generada:', { dataToSign, integritySignature });

    return NextResponse.json({
      orderId,
      amount: amountInt,
      redirectUrl,
      integritySignature,
      metadata: {
        reference: orderId,
      },
    });
  } catch (err) {
    console.error('🔥 Error en hash Bold:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}