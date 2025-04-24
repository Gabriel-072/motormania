// 📁 /app/api/bold/hash/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto'; // Usaremos crypto de Node.js
import { auth } from '@clerk/nextjs/server';

// --- Variables de Entorno y Constantes ---
// Esta DEBE ser la "Llave secreta" de Bold (Tleqx...)
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL;
const BOLD_CURRENCY = 'COP';

// --- Chequeos Iniciales ---
if (!BOLD_SECRET_KEY) { console.error("FATAL ERROR: BOLD_SECRET_KEY env var is not set."); }
if (!APP_URL) { console.error("FATAL ERROR: NEXT_PUBLIC_SITE_URL env var is not set."); }

export async function POST(req: NextRequest) {
  console.log("API Route: /api/bold/hash invoked.");

  if (!BOLD_SECRET_KEY || !APP_URL) {
    return NextResponse.json({ error: 'Error de configuración del servidor.' }, { status: 500 });
  }

  try {
    // 1. Autenticación Clerk
    console.log("Bold Hash API: Verificando autenticación Clerk...");
    const authData = await auth(); // Corrección previa
    const userId = authData.userId; // Corrección previa
    if (!userId) { console.warn('Bold Hash API: No autorizado (no userId).'); return new NextResponse('Unauthorized', { status: 401 }); }
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

    // 3. Generar Order ID (Consistente)
    const timestamp = Date.now();
    const orderId = `MM-EXTRA-${userId}-${timestamp}`; // Formato consistente
    console.log(`Bold Hash API: orderId generado: ${orderId}`);

    // 4. Preparar Cadena para Hash (SIGUIENDO NUEVA DOCUMENTACIÓN)
    const amountStr = String(amountInt); // Monto como string
    // FORMATO: {Identificador}{Monto}{Divisa}{LlaveSecreta}
    const stringToHash = `${orderId}${amountStr}${BOLD_CURRENCY}${BOLD_SECRET_KEY}`;
    console.log(`Bold Hash API: Cadena para hashear: "${orderId}${amountStr}${BOLD_CURRENCY}******"`); // No loguear el secreto completo

    // 5. Generar Hash SHA-256 (NO HMAC)
    const integritySignature = crypto
      .createHash('sha256') // <--- CAMBIO A createHash
      .update(stringToHash) // <-- Firma la cadena que INCLUYE el secreto
      .digest('hex');
    console.log(`Bold Hash API: Firma SHA-256 generada: ${integritySignature.substring(0,10)}...`);

    // 6. Generar Callback URL
    const callbackUrl = `${APP_URL}/dashboard?bold_order_id=${orderId}&bold_payment_status=success`;
    console.log(`Bold Hash API: callbackUrl generada: ${callbackUrl}`);

    // 7. Devolver Respuesta JSON (Nombres de clave como los espera lib/bold.ts)
    return NextResponse.json({
      orderId: orderId,
      amount: amountStr,                 // Devuelve amount como string
      callbackUrl: callbackUrl,          // Nombre esperado por lib/bold.ts
      integrityKey: integritySignature,  // Nombre esperado por lib/bold.ts
      metadata: { reference: orderId }
    });

  } catch (err) {
    console.error('🔥 Error inesperado en /api/bold/hash:', err);
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return NextResponse.json({ error: 'Error interno del servidor', details: message } , { status: 500 });
  }
}