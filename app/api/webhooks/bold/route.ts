// 📁 /app/api/webhooks/bold/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- Env Vars ---
const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const boldWebhookSecret      = process.env.BOLD_SECRET_KEY!;         // ← Usamos la misma SECRET_KEY
const appUrl                 = process.env.NEXT_PUBLIC_SITE_URL!;

// --- Init ---
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const EXTRA_NUMBER_COUNT = 5;

// --- Verify Bold Signature ---
async function verifyBoldSignature(signature: string, rawBody: string): Promise<boolean> {
  try {
    const encodedBody = Buffer.from(rawBody).toString('base64');
    const expectedSignature = crypto
      .createHmac('sha256', boldWebhookSecret)
      .update(encodedBody)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// --- Process Sale ---
async function processApprovedSale(supabase: SupabaseClient, bodyData: any) {
  const { payment_id, amount, metadata } = bodyData;
  const reference    = metadata?.reference;
  const totalAmount  = amount?.total;
  if (!payment_id || !reference || totalAmount == null) throw new Error("Missing payment data");

  const parts = reference.split('-');
  const userId = (parts.length === 4 && parts[2].startsWith('user_')) ? parts[2] : null;
  if (!userId) throw new Error(`Invalid reference format: ${reference}`);

  const txDescription = `Compra de ${EXTRA_NUMBER_COUNT} números extra via Bold (Ref: ${reference}, BoldID: ${payment_id})`;

  // evito duplicados
  const { data: existingTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('description', txDescription)
    .maybeSingle();
  if (existingTx) return;

  const { error: insertTxError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'recarga',
      amount: totalAmount,
      description: txDescription,
    });
  if (insertTxError) throw new Error(`Insert transaction failed: ${insertTxError.message}`);

  // genero nuevos números
  const newNumbers = Array.from({ length: EXTRA_NUMBER_COUNT }, () =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );

  // actualizo tabla entries
  const { data: currentEntry } = await supabase
    .from('entries')
    .select('numbers, paid_numbers_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (!currentEntry) throw new Error(`No entry row found for user: ${userId}`);

  const updatedNumbers   = [...(currentEntry.numbers || []), ...newNumbers];
  const updatedPaidCount = (currentEntry.paid_numbers_count || 0) + EXTRA_NUMBER_COUNT;

  const { error: updateError } = await supabase
    .from('entries')
    .update({ numbers: updatedNumbers, paid_numbers_count: updatedPaidCount })
    .eq('user_id', userId);
  if (updateError) throw new Error(`Failed to update entries: ${updateError.message}`);

  // disparo email
  const { data: user } = await supabase
    .from('clerk_users')
    .select('email, full_name')
    .eq('clerk_id', userId)
    .maybeSingle();
  const to   = user?.email;
  const name = user?.full_name || 'Usuario';

  if (to) {
    await fetch(`${appUrl}/api/send-numbers-confirmation`, {
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
    }).catch(err => console.error('Email confirmation failed:', err));
  }
}

// --- POST Handler ---
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-bold-signature') || '';
    if (!await verifyBoldSignature(signature, rawBody)) {
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    if (body.type === 'SALE_APPROVED') {
      await processApprovedSale(supabase, body.data);
    }
    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}