import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ───── Config ─────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const boldWebhookSecret = process.env.BOLD_WEBHOOK_SECRET_KEY!;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const EXTRA_NUMBER_COUNT = 5;

// ───── Firmar Webhook ─────
async function verifyBoldSignature(signature: string, rawBody: string): Promise<boolean> {
  try {
    const encodedBody = Buffer.from(rawBody).toString('base64');
    const expectedSignature = crypto
      .createHmac('sha256', boldWebhookSecret)
      .update(encodedBody)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    console.error("❌ Error verificando firma Bold:", error);
    return false;
  }
}

// ───── Procesar Venta ─────
async function processApprovedSale(supabase: SupabaseClient, bodyData: any) {
  const { payment_id, amount, metadata } = bodyData;
  const reference = metadata?.reference;
  const totalAmount = amount?.total;

  console.log("📦 BOLD Sale Approved - Reference:", reference);
  console.log("📦 Metadata:", metadata);

  if (!payment_id || !reference || totalAmount == null) throw new Error("Faltan datos de pago");

  const parts = reference.split('-');
  const userId = (parts.length === 4 && parts[2].startsWith('user_')) ? parts[2] : null;
  if (!userId) throw new Error(`Referencia inválida: ${reference}`);

  console.log("🧩 Usuario identificado:", userId);

  const txDescription = `Compra de ${EXTRA_NUMBER_COUNT} números extra via Bold (Ref: ${reference}, BoldID: ${payment_id})`;

  const { data: existingTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('description', txDescription)
    .maybeSingle();
  if (existingTx) {
    console.log("⚠️ Transacción duplicada detectada. Abortando.");
    return;
  }

  const { error: insertTxError } = await supabase.from('transactions').insert({
    user_id: userId,
    type: 'recarga',
    amount: totalAmount,
    description: txDescription,
  });
  if (insertTxError) throw new Error(`Error insertando transacción: ${insertTxError.message}`);

  const newNumbers = Array.from({ length: EXTRA_NUMBER_COUNT }, () =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );

  const { data: currentEntry } = await supabase
    .from('entries')
    .select('numbers, paid_numbers_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (!currentEntry) throw new Error(`No se encontró la entrada de usuario: ${userId}`);

  const updatedNumbers = [...(currentEntry.numbers || []), ...newNumbers];
  const updatedPaidCount = (currentEntry.paid_numbers_count || 0) + EXTRA_NUMBER_COUNT;

  const { error: updateError } = await supabase
    .from('entries')
    .update({ numbers: updatedNumbers, paid_numbers_count: updatedPaidCount })
    .eq('user_id', userId);
  if (updateError) throw new Error(`Error actualizando números: ${updateError.message}`);

  const { data: user } = await supabase
    .from('clerk_users')
    .select('email, full_name')
    .eq('clerk_id', userId)
    .maybeSingle();

  const to = user?.email;
  const name = user?.full_name || 'Usuario';

  if (to) {
    console.log("📤 Enviando email de confirmación a:", to);
    fetch(`${appUrl}/api/send-numbers-confirmation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': appUrl,
      },
      body: JSON.stringify({
        to,
        name,
        numbers: newNumbers,
        context: 'compra',
        orderId: reference,
        amount: totalAmount,
      }),
    }).catch(err => console.error('❌ Error enviando email de confirmación:', err));
  } else {
    console.warn("⚠️ No se encontró email para usuario:", userId);
  }
}

// ───── Handler POST ─────
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-bold-signature') || '';
    const isValid = await verifyBoldSignature(signature, rawBody);
    if (!isValid) return new NextResponse('Invalid signature', { status: 401 });

    const body = JSON.parse(rawBody);
    console.log("🧾 BOLD Webhook Body:", JSON.stringify(body, null, 2));

    if (body.type === 'SALE_APPROVED') {
      await processApprovedSale(supabase, body.data);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('❌ Error general en webhook Bold:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}