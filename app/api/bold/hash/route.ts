// 📁 /app/api/bold/hash/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

// 🔐 Variables de entorno (todas deben estar definidas en Vercel)
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const BOLD_CURRENCY = 'COP'; // 👈 ¡En mayúsculas!

export async function POST(req: NextRequest) {
  try {
    // Autenticación Clerk
    const { userId } = await auth();
    if (!userId) {
      console.error('❌ userId no encontrado en el resultado de auth()');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parsear el body
    const { amount } = await req.json();
    console.log('💰 Monto recibido:', amount);

    if (typeof amount !== 'number' || amount <= 0) {
      console.error('❌ Monto inválido:', amount);
      return new NextResponse('Invalid amount', { status: 400 });
    }

    // Generar valores para Bold
    const timestamp = Date.now().toString();
    const orderId = `ORDER-${userId}-${timestamp}`;
    const redirectUrl = `${APP_URL}/dashboard?bold-tx-status=approved&bold-order-id=${orderId}`;
    const amountStr = amount.toFixed(2); // 👈 IMPORTANTE: Siempre 2 decimales

    // Firmar: orderId + amountStr + currency
    const dataToSign = `${orderId}${amountStr}${BOLD_CURRENCY}`;
    const integritySignature = crypto
      .createHmac('sha256', BOLD_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');

    console.log('🔐 Firma Bold generada:', { dataToSign, integritySignature });

    // Retornar los datos requeridos por Bold Checkout
    return NextResponse.json({
      orderId,
      amount,
      redirectUrl,
      integritySignature,
      metadata: {
        reference: orderId, // 👈 Úsalo para identificar al usuario
      },
    });
  } catch (err) {
    console.error('🚨 Error generando hash de pago Bold:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}