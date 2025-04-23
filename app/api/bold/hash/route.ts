// /app/api/bold/hash/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

// 🔐 Variables de entorno
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const BOLD_CURRENCY = 'COP';

export async function POST(req: NextRequest) {
  try {
    // Autenticación Clerk
    const { userId } = await auth();
    if (!userId) {
      console.error('❌ userId no encontrado en el resultado de auth()');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Leer monto desde el body
    const { amount } = await req.json();
    if (typeof amount !== 'number' || amount <= 0) {
      console.error('❌ Monto inválido:', amount);
      return new NextResponse('Invalid amount', { status: 400 });
    }

    // Generar orderId y redirect URL
    const timestamp = Date.now().toString();
    const orderId = `ORDER-${userId}-${timestamp}`;
    const redirectUrl = `${APP_URL}/dashboard?bold-tx-status=approved&bold-order-id=${orderId}`;

    // Preparar firma
    const amountStr = amount.toFixed(2);
    const dataToSign = `${orderId}${amountStr}${BOLD_CURRENCY}`;
    const integritySignature = crypto
      .createHmac('sha256', BOLD_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');

    console.log('🔐 Firma generada:', { orderId, amountStr, dataToSign, integritySignature });

    return NextResponse.json({
      orderId,
      amount,
      redirectUrl,
      integritySignature,
      metadata: { reference: orderId },
    });
  } catch (err) {
    console.error('🚨 Error generando hash de pago Bold:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
