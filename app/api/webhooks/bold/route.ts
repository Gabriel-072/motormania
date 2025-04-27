// 📁 app/api/webhooks/bold/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ──────────────────────────────
// 🔐 ENV
// ──────────────────────────────
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BOLD_SECRET  = process.env.BOLD_SECRET_KEY!;
const SITE_URL     = process.env.NEXT_PUBLIC_SITE_URL!;
const EXTRA_COUNT  = 5;               // números extra que vendes

// ──────────────────────────────
// 1. Signature check
// ──────────────────────────────
async function verify(sig: string, raw: string) {
  try {
    const bodyB64  = Buffer.from(raw).toString('base64');
    const expected = crypto
      .createHmac('sha256', BOLD_SECRET)
      .update(bodyB64)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ──────────────────────────────
// Utils
// ──────────────────────────────
async function uniqueSix(existing: string[], n: number) {
  const pool = new Set(existing);
  const out: string[] = [];
  while (out.length < n) {
    const v = Math.floor(100_000 + Math.random() * 900_000).toString();
    if (!pool.has(v)) { pool.add(v); out.push(v); }
  }
  return out;
}

// ──────────────────────────────
// 2-A. Compra de NÚMEROS EXTRA
// ──────────────────────────────
async function handleNumberPurchase(db: SupabaseClient, data: any) {
  const ref   = data.metadata?.reference as string;            // ORDER-user_…
  const total = data.amount?.total      as number;
  const payId = data.payment_id;

  const userId = ref.match(/user_[A-Za-z0-9]+/)?.[0];
  if (!userId) throw new Error('userId no encontrado en referencia');

  const desc = `Compra de ${EXTRA_COUNT} números extra (BoldID:${payId})`;

  // idempotencia por descripción
  const { data: exists } = await db.from('transactions').select('id')
                                   .eq('description', desc).maybeSingle();
  if (exists) return console.info('↩️ números ya procesados', ref);

  // 1. transacción
  await db.from('transactions').insert({
    user_id: userId,
    type   : 'recarga',
    amount : total,
    description: desc
  });

  // 2. entries
  const { data: entry } = await db.from('entries')
                                  .select('numbers, paid_numbers_count')
                                  .eq('user_id', userId).maybeSingle();

  const merged = [
    ...(entry?.numbers ?? []),
    ...(await uniqueSix(entry?.numbers ?? [], EXTRA_COUNT))
  ];

  await db.from('entries').upsert({
    user_id           : userId,
    numbers           : merged,
    paid_numbers_count: (entry?.paid_numbers_count ?? 0) + EXTRA_COUNT
  }, { onConflict: 'user_id' });

  // 3. e-mail
  const { data: u } = await db.from('clerk_users')
                              .select('email, full_name')
                              .eq('clerk_id', userId).maybeSingle();

  if (u?.email) {
    fetch(`${SITE_URL}/api/send-numbers-confirmation`, {
      method : 'POST',
      headers: { 'Content-Type':'application/json', Referer: SITE_URL },
      body   : JSON.stringify({
        to      : u.email,
        name    : u.full_name || 'Usuario',
        numbers : merged.slice(-EXTRA_COUNT),
        context : 'compra',
        orderId : ref,
        amount  : total
      })
    }).catch(e => console.error('✉️  Email números error', e));
  }

  console.log('✅ números extra procesados', ref);
}

// ──────────────────────────────
// 2-B. Compra de PICKS (MMC-…)
// ──────────────────────────────
async function handlePickPurchase(db: SupabaseClient, data: any) {
  const ref = data.metadata?.reference as string;              // MMC-…
  if (!ref) throw new Error('reference faltante en pick');

  // 1) localizar la fila pendiente
  const { data: tx } = await db.from('pick_transactions').select('*')
                              .eq('order_id', ref).maybeSingle();

  if (!tx)          return console.warn('pick_transactions no encontrada', ref);
  if (tx.payment_status === 'paid') {
    return console.info('↩️ pick ya marcada paid', ref);
  }

  // 2) marcar paid + picks_saved=true (idempotencia)
  await db.from('pick_transactions')
          .update({ payment_status: 'paid', picks_saved: true })
          .eq('id', tx.id);

  // 3) copiar a tabla picks (respetando tipos de tu esquema)
  await db.from('picks').insert({
    user_id      : tx.user_id,
    gp_name      : tx.gp_name,
    session_type : 'combined',
    picks        : tx.picks ?? [],            // jsonb
    multiplier   : Number(tx.multiplier ?? 0),// integer en schema
    wager_amount : tx.wager_amount ?? 0,      // numeric(10,2)
    potential_win: tx.potential_win ?? 0,     // numeric(10,2)
    name         : tx.full_name,
    mode         : tx.mode,
    order_id     : ref
  });

  // 4) e-mail
  if (tx.email) {
    fetch(`${SITE_URL}/api/send-pick-confirmation`, {
      method : 'POST',
      headers: { 'Content-Type':'application/json', Referer: SITE_URL },
      body   : JSON.stringify({
        to     : tx.email,
        name   : tx.full_name,
        amount : tx.wager_amount,
        mode   : tx.mode,
        picks  : tx.picks
      })
    }).catch(e => console.error('✉️  Email picks error', e));
  }

  console.log('✅ pick procesada', ref);
}

// ──────────────────────────────
// 3. Entrypoint
// ──────────────────────────────
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  if (!(await verify(sig, raw))) {
    return new NextResponse('Bad signature', { status: 401 });
  }

  const evt = JSON.parse(raw);
  if (evt.type !== 'SALE_APPROVED') return NextResponse.json({ ok: true });

  try {
    const ref: string = evt.data?.metadata?.reference ?? '';
    if (ref.startsWith('ORDER-user_'))  await handleNumberPurchase(sb, evt.data);
    else if (ref.startsWith('MMC-'))    await handlePickPurchase(sb, evt.data);
    else console.warn('Referencia desconocida:', ref);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('🔥 Webhook error', e);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}