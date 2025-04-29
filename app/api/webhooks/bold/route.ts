// 📁 app/api/webhooks/bold/route.ts
import { NextRequest, NextResponse }    from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto                           from 'crypto';
import { Resend }                       from 'resend';

// ─── ENV ─────────────────────────────────────────────────────────────────
const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BOLD_WEBHOOK_SECRET= process.env.BOLD_WEBHOOK_SECRET_KEY!;
const SITE_URL           = process.env.NEXT_PUBLIC_SITE_URL!;
const INTERNAL_KEY       = process.env.INTERNAL_API_KEY!;
const RESEND_API_KEY     = process.env.RESEND_API_KEY!;

// ­-- instancias
const sb     = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(RESEND_API_KEY);

// ─── CONSTANTES ─────────────────────────────────────────────────────────
const EXTRA_COUNT   = 5;
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';
const FROM_EMAIL    = 'MotorMania <noreply@motormaniacolombia.com>';

// ─── TOOLS ──────────────────────────────────────────────────────────────
function verify(sig: string, raw: string): boolean {
  const bodyB64  = Buffer.from(raw).toString('base64');
  const expected = crypto
    .createHmac('sha256', BOLD_WEBHOOK_SECRET)
    .update(bodyB64)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

async function uniqueSix(existing: string[], n: number): Promise<string[]> {
  const pool = new Set(existing);
  const out: string[] = [];
  while (out.length < n) {
    const num = Math.floor(100_000 + Math.random() * 900_000).toString();
    if (!pool.has(num)) {
      pool.add(num);
      out.push(num);
    }
  }
  return out;
}

// ─── HANDLER: COMPRA DE NÚMEROS EXTRA ───────────────────────────────────
async function handleNumberPurchase(db: SupabaseClient, data: any) {
  console.log('[Bold WH] Number purchase flow');
  const ref   = data.metadata?.reference as string;
  const total = data.amount?.total       as number;
  const payId = data.payment_id          as string;

  if (!ref || total === undefined || !payId) throw new Error('Datos incompletos');

  // userId desde referencia MM-EXTRA-user_xxx-TIMESTAMP
  const parts = ref.split('-');
  if (parts.length !== 4 || parts[0] !== 'MM' || parts[1] !== 'EXTRA')
    throw new Error('Formato referencia inesperado');

  const userId = parts[2];
  console.log(`[Bold WH Num] user=${userId} ref=${ref}`);

  // idempotencia
  const desc = `Compra de ${EXTRA_COUNT} números extra via Bold (Ref:${ref}, BoldID:${payId})`;
  const { data: already } = await db.from('transactions')
    .select('id').eq('description', desc).maybeSingle();
  if (already) { console.info('↩️ ya procesado'); return; }

  // 1. registrar transacción
  await db.from('transactions').insert({
    user_id: userId, type: 'recarga', amount: total, description: desc
  });

  // 2. generar números y actualizar entries
  const { data: entry } = await db.from('entries')
    .select('numbers, paid_numbers_count').eq('user_id', userId).maybeSingle();
  if (!entry) throw new Error('Entry no encontrado');

  const newNums = await uniqueSix(entry.numbers ?? [], EXTRA_COUNT);
  await db.from('entries').upsert({
    user_id: userId,
    numbers: [...(entry.numbers ?? []), ...newNums],
    paid_numbers_count: (entry.paid_numbers_count ?? 0) + EXTRA_COUNT
  }, { onConflict: 'user_id' });

  // 3. e-mail de confirmación (ruta interna)
  const { data: userRow } = await db.from('clerk_users')
    .select('email, full_name').eq('clerk_id', userId).maybeSingle();

  if (userRow?.email) {
    try {
      const resp = await fetch(`${SITE_URL}/api/send-numbers-confirmation`, {
        method : 'POST',
        headers: {
          'Content-Type'  : 'application/json',
          'x-internal-key': INTERNAL_KEY
        },
        body: JSON.stringify({
          to      : userRow.email,
          name    : userRow.full_name || 'Usuario',
          numbers : newNums,
          context : 'compra',
          orderId : ref,
          amount  : total
        })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error(`✉️ num-email API error (${resp.status}):`, txt || '(sin cuerpo)');
      } else {
        console.log('📧 num-email enviado a', userRow.email);
      }
    } catch (err) {
      console.error('✉️ num-email fetch failed:', err);
    }
  } else {
    console.warn('Usuario sin email — no se envió confirmación.');
  }

  console.log('✅ Números extra procesados');
}

// ─── HANDLER: COMPRA DE PICKS MMC-GO ────────────────────────────────────
async function handlePickPurchase(db: SupabaseClient, data: any) {
  console.log('[Bold WH] Pick purchase flow');
  const ref   = data.metadata?.reference as string;
  const payId = data.payment_id          as string;
  if (!ref || !payId) throw new Error('Referencia/payId faltante');

  // 1. localizar transacción pendiente
  const { data: tx } = await db
    .from('pick_transactions').select('*').eq('order_id', ref).maybeSingle();
  if (!tx) { console.warn('pick_transactions no encontrada'); return; }
  if (tx.payment_status === 'paid') { console.info('pick ya pagada'); return; }

  // 2. marcar pagada
  await db.from('pick_transactions')
    .update({ payment_status: 'paid', bold_payment_id: payId })
    .eq('id', tx.id);

  // 3. mover a tabla picks
  await db.from('picks').insert({
    user_id            : tx.user_id,
    gp_name            : tx.gp_name,
    session_type       : 'combined',
    picks              : tx.picks ?? [],
    multiplier         : Number(tx.multiplier ?? 0),
    wager_amount       : tx.wager_amount ?? 0,
    potential_win      : tx.potential_win ?? 0,
    name               : tx.full_name,
    mode               : tx.mode,
    order_id           : ref,
    pick_transaction_id: tx.id
  });

  // 4. wallet (si lo requieres)
  if (tx.wager_amount) {
    const mmc  = Math.round(tx.wager_amount / 1000);
    const fuel = tx.wager_amount;
    const cop  = Math.round(tx.wager_amount);
    const { error: rpcErr } = await db.rpc('increment_wallet_balances', {
      uid        : tx.user_id,
      mmc_amount : mmc,
      fuel_amount: fuel,
      cop_amount : cop
    });
    if (rpcErr) console.warn('RPC wallet error', rpcErr.message);
  }

  // 5. e-mail de confirmación de picks
  if (tx.email) {
    try {
      const subject = `✅ Tus Picks de MMC-GO (${ref.slice(-6)}) ¡Confirmados!`;
      const picksHtml = (tx.picks ?? []).map((p: any) => `
        <li style="margin-bottom:6px">
          <strong>${p.driver}</strong> 
          <span style="color:#6b7280;font-size:12px">
            (${p.session_type === 'qualy' ? 'Q' : 'R'} ${p.line.toFixed(1)})
          </span>
          <span style="float:right;font-weight:bold;color:${
            p.betterOrWorse==='mejor' ? '#16a34a' : '#dc2626'
          }">
            ${p.betterOrWorse?.toUpperCase()}
          </span>
        </li>`).join('');

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#8b5cf6;text-align:center">
            ¡Jugada Confirmada, ${tx.full_name || 'Jugador'}!
          </h2>
          <p style="text-align:center">
            Referencia: <strong>${ref}</strong>
          </p>
          <ul style="list-style:none;padding:0">${picksHtml}</ul>
          <p style="text-align:center;margin-top:24px">
            <a href="${SITE_URL}/dashboard"
               style="background:#8b5cf6;color:#fff;padding:10px 18px;
                      border-radius:6px;text-decoration:none">
              Ver Dashboard
            </a>
          </p>
          <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
          <p style="font-size:12px;color:#999;text-align:center">
            MotorManía • Bogotá, CO • 
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#999">
              ${SUPPORT_EMAIL}
            </a>
          </p>
        </div>`;

      const { error: mailErr } = await resend.emails.send({
        from   : FROM_EMAIL,
        to     : [tx.email],
        subject,
        html
      });
      if (mailErr) console.error('Resend error:', mailErr);
      else         console.log('📧 Pick e-mail sent to', tx.email);
    } catch (e) {
      console.error('Send-pick-email failed', e);
    }
  } else {
    console.warn('Pick e-mail no enviado: user sin email');
  }

  console.log('✅ Pick flow finished for', ref);
}

// ─── ENTRYPOINT ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  if (!verify(sig, raw))
    return new NextResponse('Bad signature', { status: 401 });

  const evt = JSON.parse(raw);
  if (evt.type !== 'SALE_APPROVED')
    return NextResponse.json({ ok: true, ignored: true });

  const ref: string = evt.data?.metadata?.reference ?? '';
  try {
    if      (ref.startsWith('MM-EXTRA-')) await handleNumberPurchase(sb, evt.data);
    else if (ref.startsWith('MMC-'))      await handlePickPurchase(sb, evt.data);
    else   console.warn('Referencia desconocida:', ref);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('🔥 Webhook error', e);
    return new NextResponse('Internal error', { status: 500 });
  }
}