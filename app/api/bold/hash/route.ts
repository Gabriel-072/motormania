import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const BOLD_CURRENCY = 'cop'; // Mantener minúsculas para probar

export async function POST(req: NextRequest) {
  try {
    // 1) Validar sesión
    const { userId } = await auth();
    if (!userId) {
      console.error('No userId en authResult');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2) Leer y validar body
    const { amount } = await req.json();
    console.log('Received amount:', amount);
    if (typeof amount !== 'number' || amount <= 0) {
      console.error('Amount inválido:', amount);
      return new NextResponse('Invalid amount', { status: 400 });
    }

    // 3) Generar orderId y redirect
    const timestamp = Date.now().toString();
    const orderId = `ORDER-${userId}-${timestamp}`;
    const redirectUrl = `${APP_URL}/dashboard?payment_confirmed=true`;

    // 4) Crear string a firmar (Identificador + Monto + Divisa)
    const amountStr = Number(amount).toFixed(2); // 2000 -> "2000.00"
    const dataToSign = `${orderId}${amountStr}${BOLD_CURRENCY}`;
    console.log('Data to sign:', dataToSign);

    // 5) Generar HMAC SHA256 usando la llave secreta
    const integritySignature = crypto
      .createHmac('sha256', BOLD_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');
    console.log('Generated signature:', integritySignature);

    // 6) Responder al cliente
    return NextResponse.json({
      orderId,
      amount,
      redirectUrl,
      integritySignature,
      metadata: { reference: orderId },
    });
  } catch (err) {
    console.error('Error generando hash:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}