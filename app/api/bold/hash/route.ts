// app/api/bold/hash/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

// 🔐 Variables de entorno
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const BOLD_CURRENCY = 'COP'; // Verifica que Bold lo acepte exactamente así

export async function POST(req: NextRequest) {
  try {
    // Autenticación Clerk (sólo usuarios autenticados pueden generar orden)
    const { userId } = await auth();
    if (!userId) {
      console.error('❌ userId no encontrado en el resultado de auth()');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const amount = body?.amount;
    console.log('💰 Monto recibido:', amount);

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      console.error('❌ Monto inválido:', amount);
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Construir datos necesarios para firma
    const timestamp = Date.now().toString();
    const orderId = `ORDER-${userId}-${timestamp}`;
    const redirectUrl = `${APP_URL}/dashboard?bold-tx-status=approved&bold-order-id=${orderId}`;
    const amountStr = amount.toFixed(2);
    const dataToSign = `${orderId}${amountStr}${BOLD_CURRENCY}`;

    // Generar firma de integridad (hash)
    const integritySignature = crypto
      .createHmac('sha256', BOLD_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');

    console.log('🔐 Firma generada:', { dataToSign, integritySignature });

    // Devolver datos para iniciar checkout con Bold
    return NextResponse.json({
      orderId,
      amount,
      redirectUrl,
      integritySignature,
      metadata: { reference: orderId },
    });
  } catch (err) {
    console.error('🚨 Error generando hash de pago Bold:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}