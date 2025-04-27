// 📁 /app/api/webhooks/bold/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ──────────────────────────────────────────────────────────────────────────
// 🔐 ENV VARS
// ──────────────────────────────────────────────────────────────────────────
const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const boldWebhookSecret   = process.env.BOLD_SECRET_KEY!;
const siteUrl             = process.env.NEXT_PUBLIC_SITE_URL!;
const EXTRA_NUMBER_COUNT  = 5;                           // números que vendes

// ──────────────────────────────────────────────────────────────────────────
// 📦 SUPABASE (service-role)
// ──────────────────────────────────────────────────────────────────────────
const sb = createClient(supabaseUrl, supabaseServiceKey);

// ──────────────────────────────────────────────────────────────────────────
// 🔎 VERIFY SIGNATURE
// ──────────────────────────────────────────────────────────────────────────
async function verifyBoldSignature(sig: string, raw: string): Promise<boolean> {
  try {
    const bodyB64 = Buffer.from(raw).toString('base64');
    const expected = crypto
      .createHmac('sha256', boldWebhookSecret)
      .update(bodyB64)
      .digest('hex');

    const ok = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    console.log('🔐 Signature check →', ok);
    return ok;
  } catch (e) {
    console.error('❌ Signature check failed:', e);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 🛠 HELPERS
// ──────────────────────────────────────────────────────────────────────────
async function generateUniqueNumbers(existing: string[], n: number): Promise<string[]> {
  const pool = new Set(existing);
  const out: string[] = [];
  while (out.length < n) {
    const num = Math.floor(100_000 + Math.random() * 900_000).toString();
    if (!pool.has(num)) { pool.add(num); out.push(num); }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// 📍 1)  EXTRA-NUMBERS FLOW  (ORDER-user_<id>-…)
// ──────────────────────────────────────────────────────────────────────────
async function handleNumberPurchase(db: SupabaseClient, data: any) {
  const { payment_id, amount, metadata } = data;
  const reference = metadata?.reference as string;
  const total     = amount?.total      as number;

  // Idempotencia por descripción
  const desc = `Compra de ${EXTRA_NUMBER_COUNT} números extra via Bold (Ref:${reference}, BoldID:${payment_id})`;

  // Si ya existe, salimos
  const { data: already } = await db.from('transactions').select('id').eq('description', desc).maybeSingle();
  if (already) { console.info('⚠️ Repeated number-purchase:', reference); return; }

  // Parsear userId dentro del reference
  const m = reference.match(/user_[A-Za-z0-9]+/);
  const userId = m?.[0];
  if (!userId) throw new Error(`No userId in reference ${reference}`);

  // 1. Registrar transacción
  const { error: txErr } = await db.from('transactions').insert({
    user_id: userId, type: 'recarga', amount: total, description: desc
  });
  if (txErr) throw txErr;

  // 2. Actualizar tabla entries
  const { data: entry } = await db.from('entries')
    .select('numbers, paid_numbers_count')
    .eq('user_id', userId).maybeSingle();

  const existing = entry?.numbers ?? [];
  const newNums  = await generateUniqueNumbers(existing, EXTRA_NUMBER_COUNT);
  const merged   = [...existing, ...newNums];
  const paidCnt  = (entry?.paid_numbers_count ?? 0) + EXTRA_NUMBER_COUNT;

  const { error: entErr } = await db.from('entries')
    .upsert({ user_id: userId, numbers: merged, paid_numbers_count: paidCnt },
            { onConflict: 'user_id' });
  if (entErr) throw entErr;

  // 3. Email de confirmación
  const { data: uInfo } = await db.from('clerk_users')
    .select('email, full_name').eq('clerk_id', userId).maybeSingle();

  if (uInfo?.email) {
    await fetch(`${siteUrl}/api/send-numbers-confirmation`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', Referer: siteUrl },
      body   : JSON.stringify({
        to: uInfo.email,
        name: uInfo.full_name || 'Usuario',
        numbers: newNums,
        context: 'compra',
        orderId: reference,
        amount : total
      })
    }).catch(e => console.error('✉️  Email error:', e));
  }

  console.log('✅ Números extra procesados:', reference);
}

// ──────────────────────────────────────────────────────────────────────────
// 📍 2)  PICK-TRANSACTION FLOW  (MMC-…)
// ──────────────────────────────────────────────────────────────────────────
async function handlePickPurchase(db: SupabaseClient, data: any) {
  const reference = data.metadata?.reference as string;   // = orderId que envías
  if (!reference) throw new Error('Missing order reference for pick');

  // Buscar la transacción “pendiente”
  const { data: pickTx, error } = await db
    .from('pick_transactions')
    .select('*')
    .eq('order_id', reference)
    .maybeSingle();

  if (error)  throw error;
  if (!pickTx) {
    console.warn('⚠️ pick_transactions no encontrada →', reference);
    return; // ignoramos, no rompemos el webhook
  }
  if (pickTx.payment_status === 'paid') {
    console.info('⚠️ Pick transaction ya pagada:', reference);
    return;
  }

  // 1.  Marcar como paid
  const { error: updErr } = await db
    .from('pick_transactions')
    .update({ payment_status: 'paid' })
    .eq('id', pickTx.id);
  if (updErr) throw updErr;

  // 2.  Crear registro definitivo en picks
  const { error: picksErr } = await db.from('picks').insert({
    user_id      : pickTx.user_id,
    gp_name      : pickTx.gp_name,
    session_type : 'combined',
    picks        : [],             // (si quieres guardar picks reales cámbialo)
    multiplier   : 0,
    wager_amount : pickTx.wager_amount,
    potential_win: 0,
    name         : pickTx.full_name,
    mode         : 'Full Throttle',
    order_id     : reference
  });
  if (picksErr) throw picksErr;

  console.log('✅ Pick registrada:', reference);
}

// ──────────────────────────────────────────────────────────────────────────
// 📬  MAIN HANDLER
// ──────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const sig = req.headers.get('x-bold-signature') ?? '';
    if (!(await verifyBoldSignature(sig, raw))) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const evt = JSON.parse(raw);
    if (evt.type !== 'SALE_APPROVED') return new NextResponse('OK');

    const ref: string = evt.data?.metadata?.reference ?? '';
    if (ref.startsWith('ORDER-user_')) {
      await handleNumberPurchase(sb, evt.data);
    } else if (ref.startsWith('MMC-')) {
      await handlePickPurchase(sb, evt.data);
    } else {
      console.warn('⚠️ Webhook con referencia desconocida:', ref);
    }

    return new NextResponse('OK');
  } catch (err) {
    console.error('🔥 Webhook error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}