// 📁 /app/api/bold/hash/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

// --- Env Vars & Constants ---
const BOLD_INTEGRITY_SECRET = process.env.BOLD_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL;
const BOLD_CURRENCY = 'COP';

// --- Startup Checks ---
if (!BOLD_INTEGRITY_SECRET) { console.error("FATAL ERROR: BOLD_SECRET_KEY (for integrity) env var is not set."); }
if (!APP_URL) { console.error("FATAL ERROR: NEXT_PUBLIC_SITE_URL env var is not set."); }

export async function POST(req: NextRequest) {
  console.log("API Route: /api/bold/hash invoked.");

  if (!BOLD_INTEGRITY_SECRET || !APP_URL) {
    return NextResponse.json({ error: 'Error de configuración del servidor.' }, { status: 500 });
  }

  try {
    // 1. Autenticación Clerk - CORRECCIÓN EXPLÍCITA
    console.log("Bold Hash API: Verificando autenticación Clerk...");
    const authData = await auth(); // Espera explícitamente la resolución
    const userId = authData.userId; // Accede a userId DESPUÉS de resolver

    if (!userId) {
      console.warn('Bold Hash API: No autorizado (userId no encontrado).');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    console.log(`Bold Hash API: Autorizado para userId: ${userId}`);

    // 2. Parsear y Validar Monto
    let amountInt: number;
    try {
        const { amount } = await req.json();
        amountInt = Math.round(amount);
        if (!Number.isInteger(amountInt) || amountInt <= 0) { throw new Error('Monto inválido.'); }
        console.log(`Bold Hash API: Monto recibido (número): ${amountInt}`);
    } catch (parseError) {
        console.error('Bold Hash API: Error en cuerpo de solicitud o monto.', parseError);
        return NextResponse.json({ error: 'Cuerpo de solicitud o monto inválido.' }, { status: 400 });
    }

    // 3. Generar Order ID
    const timestamp = Date.now();
    const orderId = `MM-EXTRA-${userId}-${timestamp}`;
    console.log(`Bold Hash API: orderId generado: ${orderId}`);

    // 4. Preparar Datos para Firma (Amount como String)
    const amountStr = String(amountInt);
    const dataToSign = `${orderId}${amountStr}${BOLD_CURRENCY}`;
    console.log(`Bold Hash API: Datos para firmar: "${dataToSign}"`);

    // 5. Generar Firma HMAC-SHA256
    const integritySignature = crypto
      .createHmac('sha256', BOLD_INTEGRITY_SECRET)
      .update(dataToSign)
      .digest('hex');
    console.log(`Bold Hash API: Firma generada: ${integritySignature.substring(0,10)}...`);

    // 6. Generar Callback URL
    const callbackUrl = `${APP_URL}/dashboard?bold_order_id=${orderId}&bold_payment_status=success`;
    console.log(`Bold Hash API: callbackUrl generada: ${callbackUrl}`);

    // 7. Devolver Respuesta JSON
    return NextResponse.json({
      orderId: orderId,
      amount: amountStr,
      callbackUrl: callbackUrl,
      integrityKey: integritySignature,
      metadata: { reference: orderId }
    });

  } catch (err) {
    console.error('🔥 Error inesperado en /api/bold/hash:', err);
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return NextResponse.json({ error: 'Error interno del servidor', details: message } , { status: 500 });
  }
}