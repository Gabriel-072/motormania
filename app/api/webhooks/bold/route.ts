// 📁 /app/api/webhooks/bold/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// 🔐 Env Vars
// ─────────────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const boldWebhookSecret = process.env.BOLD_SECRET_KEY!;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL!;
const EXTRA_NUMBER_COUNT = 5;

// ─────────────────────────────────────────────────────────────────────────────
// 📦 Supabase Client (Service Role)
// ─────────────────────────────────────────────────────────────────────────────
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Verificar firma usando el raw body (NO base64) como exige Bold
// ─────────────────────────────────────────────────────────────────────────────
async function verifyBoldSignature(signature: string, rawBody: string): Promise<boolean> {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', boldWebhookSecret)
      .update(rawBody)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    console.log('🔐 Verificación firma Bold:', {
      isValid,
      received: signature,
      expected: expectedSignature,
    });

    return isValid;
  } catch (error) {
    console.error('❌ Error verificando firma Bold:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔢 Generador de números únicos (6 dígitos)
// ─────────────────────────────────────────────────────────────────────────────
async function generateUniqueNumbers(existingNumbers: string[], count: number): Promise<string[]> {
  const newNumbers: string[] = [];
  const allExisting = new Set(existingNumbers);

  while (newNumbers.length < count) {
    const num = Math.floor(100000 + Math.random() * 900000).toString();
    if (!allExisting.has(num)) {
      newNumbers.push(num);
      allExisting.add(num);
    }
  }

  return newNumbers;
}

// ─────────────────────────────────────────────────────────────────────────────
// 💰 Procesar transacción SALE_APPROVED
// ─────────────────────────────────────────────────────────────────────────────
async function processApprovedSale(supabase: SupabaseClient, bodyData: any) {
  console.log('🎟️ Procesando SALE_APPROVED:', JSON.stringify(bodyData, null, 2));

  try {
    const { payment_id, amount, metadata } = bodyData;
    const reference = metadata?.reference;
    const totalAmount = amount?.total;

    if (!payment_id || !reference || typeof totalAmount !== 'number') {
      throw new Error(`Datos incompletos: ${JSON.stringify({ payment_id, reference, totalAmount })}`);
    }

    const match = reference.match(/user_[a-zA-Z0-9]+/);
    const userId = match?.[0];
    if (!userId) throw new Error(`Referencia inválida: ${reference}`);

    const { data: userExists } = await supabase
      .from('clerk_users')
      .select('clerk_id')
      .eq('clerk_id', userId)
      .maybeSingle();

    if (!userExists) throw new Error(`Usuario no encontrado: ${userId}`);

    const txDescription = `Compra de ${EXTRA_NUMBER_COUNT} números extra via Bold (Ref: ${reference}, BoldID: ${payment_id})`;

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('description', txDescription)
      .maybeSingle();

    if (existingTx) {
      console.warn(`⚠️ Transacción ya procesada: ${txDescription}`);
      return;
    }

    const { error: insertTxError } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'recarga',
      amount: totalAmount,
      description: txDescription,
    });

    if (insertTxError) throw new Error(`Error guardando transacción: ${insertTxError.message}`);

    const { data: currentEntry } = await supabase
      .from('entries')
      .select('numbers, paid_numbers_count')
      .eq('user_id', userId)
      .maybeSingle();

    const existingNumbers = currentEntry?.numbers || [];
    const newNumbers = await generateUniqueNumbers(existingNumbers, EXTRA_NUMBER_COUNT);
    const updatedNumbers = [...existingNumbers, ...newNumbers];
    const updatedPaidCount = (currentEntry?.paid_numbers_count || 0) + EXTRA_NUMBER_COUNT;

    const { error: upsertError } = await supabase.from('entries').upsert(
      {
        user_id: userId,
        numbers: updatedNumbers,
        paid_numbers_count: updatedPaidCount,
      },
      { onConflict: 'user_id' }
    );

    if (upsertError) throw new Error(`Error actualizando números: ${upsertError.message}`);

    const { data: user } = await supabase
      .from('clerk_users')
      .select('email, full_name')
      .eq('clerk_id', userId)
      .maybeSingle();

    const to = user?.email;
    const name = user?.full_name || 'Usuario';

    if (to) {
      await fetch(`${appUrl}/api/send-numbers-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: appUrl,
        },
        body: JSON.stringify({
          to,
          name,
          numbers: newNumbers,
          context: 'compra',
          orderId: reference,
          amount: totalAmount,
        }),
      }).catch((err) => console.error('❌ Error enviando email:', err));
    } else {
      console.warn(`⚠️ Email no encontrado para usuario: ${userId}`);
    }

    console.log('✅ Venta procesada con éxito:', { payment_id, userId });
  } catch (error) {
    console.error('🚨 Error procesando venta Bold:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📬 Webhook Handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-bold-signature') || '';
    console.log('📩 Webhook recibido:', { signature, preview: rawBody.slice(0, 200) });

    const isValid = await verifyBoldSignature(signature, rawBody);
    if (!isValid) {
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log('📦 Payload recibido:', JSON.stringify(body, null, 2));

    if (body.type === 'SALE_APPROVED') {
      await processApprovedSale(supabase, body.data);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('🔥 Error general en webhook:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}