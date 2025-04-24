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
// ✅ Verify Bold webhook signature (Base64-encoded body)
// ─────────────────────────────────────────────────────────────────────────────
async function verifyBoldSignature(signature: string, rawBody: string): Promise<boolean> {
  try {
    // 1) Encode raw payload to Base64
    const encoded = Buffer.from(rawBody).toString('base64');
    // 2) Compute HMAC-SHA256 over the Base64 string
    const expectedSignature = crypto
      .createHmac('sha256', boldWebhookSecret)
      .update(encoded)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    console.log('🔐 Bold signature verification:', { isValid, signature, expectedSignature });
    return isValid;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔢 Generate unique 6-digit numbers
// ─────────────────────────────────────────────────────────────────────────────
async function generateUniqueNumbers(existing: string[], count: number): Promise<string[]> {
  const newNums: string[] = [];
  const pool = new Set(existing);
  while (newNums.length < count) {
    const num = Math.floor(100000 + Math.random() * 900000).toString();
    if (!pool.has(num)) {
      pool.add(num);
      newNums.push(num);
    }
  }
  return newNums;
}

// ─────────────────────────────────────────────────────────────────────────────
// 💰 Process SALE_APPROVED events
// ─────────────────────────────────────────────────────────────────────────────
async function processApprovedSale(db: SupabaseClient, data: any) {
  console.log('🎟️ Processing SALE_APPROVED:', JSON.stringify(data, null, 2));
  const { payment_id, amount, metadata } = data;
  const reference = metadata?.reference as string;
  const total = amount?.total as number;
  if (!payment_id || !reference || typeof total !== 'number') {
    throw new Error(`Invalid payload: ${JSON.stringify(data)}`);
  }

  // Extract userId from reference: e.g. 'ORDER-user_<id>-<ts>'
  const m = reference.match(/user_[A-Za-z0-9]+/);
  const userId = m?.[0];
  if (!userId) throw new Error(`Cannot parse userId from reference ${reference}`);

  // Ensure user exists
  const { data: userRec } = await db.from('clerk_users').select('clerk_id').eq('clerk_id', userId).maybeSingle();
  if (!userRec) throw new Error(`User not found: ${userId}`);

  // Idempotency: check existing transaction
  const description = `Compra de ${EXTRA_NUMBER_COUNT} números extra via Bold (Ref: ${reference}, BoldID: ${payment_id})`;
  const { data: existingTx } = await db.from('transactions').select('id').eq('description', description).maybeSingle();
  if (existingTx) {
    console.info('⚠️ Transaction already processed:', description);
    return;
  }

  // Record transaction
  const { error: txErr } = await db.from('transactions').insert({
    user_id: userId,
    type: 'recarga',
    amount: total,
    description,
  });
  if (txErr) throw txErr;

  // Update entries
  const { data: entry } = await db.from('entries').select('numbers, paid_numbers_count').eq('user_id', userId).maybeSingle();
  const existingNums = entry?.numbers || [];
  const newNums = await generateUniqueNumbers(existingNums, EXTRA_NUMBER_COUNT);
  const updated = [...existingNums, ...newNums];
  const paidCount = (entry?.paid_numbers_count || 0) + EXTRA_NUMBER_COUNT;

  const { error: upErr } = await db.from('entries').upsert({
    user_id: userId,
    numbers: updated,
    paid_numbers_count: paidCount,
  }, { onConflict: 'user_id' });
  if (upErr) throw upErr;

  // Fetch user email
  const { data: userInfo } = await db.from('clerk_users').select('email, full_name').eq('clerk_id', userId).maybeSingle();
  const to = userInfo?.email;
  if (to) {
    // Notify via email
    await fetch(`${appUrl}/api/send-numbers-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: appUrl },
      body: JSON.stringify({
        to,
        name: userInfo.full_name || 'Usuario',
        numbers: newNums,
        context: 'compra',
        orderId: reference,
        amount: total,
      }),
    }).catch(e => console.error('❌ Email error:', e));
  }

  console.log('✅ SALE_APPROVED processed:', payment_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 📬 Webhook entrypoint
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get('x-bold-signature') || '';
    console.log('📩 Webhook received:', { sig, len: rawBody.length });

    if (!(await verifyBoldSignature(sig, rawBody))) {
      console.warn('❌ Invalid signature');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const evt = JSON.parse(rawBody);
    if (evt.type === 'SALE_APPROVED') {
      await processApprovedSale(supabase, evt.data);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('🔥 Webhook handler error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
