// 📁 app/api/webhooks/bold-vip/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import crypto                       from 'crypto';
import { Resend }                   from 'resend';

/* ─── Supabase y Resend clients ───────────────────────────── */
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const resend       = new Resend(process.env.RESEND_API_KEY!);
const BOLD_SECRET  = process.env.BOLD_WEBHOOK_SECRET_KEY!;
const VIP_AUDIENCE = process.env.RESEND_LIST_ID_FANTASY_VIP!;  // Tu audienceId en Resend

/* ─── Verifica firma de Bold ───────────────────────────────── */
function verifyBold(sig: string, raw: string) {
  const bodyB64  = Buffer.from(raw).toString('base64');
  const expected = crypto
    .createHmac('sha256', BOLD_SECRET)
    .update(bodyB64)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

/* ─── Maneja la suscripción VIP ────────────────────────────── */
async function handleVipSubscription(data: any) {
  const {
    payment_id: boldOrderId,
    status,
    amount: { total: amountPaid },
    currency,
    metadata: { reference } = {}
  } = data;

  // Esperamos reference = 'VIP-<clerkId>-<timestamp>'
  const parts = String(reference).split('-');
  if (parts[0] !== 'VIP' || !parts[1]) {
    console.warn('Ignorando webhook VIP, reference inválido:', reference);
    return;
  }
  const clerkId = parts[1];

  // 1️⃣ Upsert en vip_entries
  const { data: entry, error: upErr } = await sb
    .from('vip_entries')
    .upsert({
      bold_order_id: boldOrderId,
      user_id       : clerkId,
      status        : status === 'SALE_APPROVED' ? 'approved' : 'pending',
      amount_paid   : amountPaid,
      currency
    }, { onConflict: 'bold_order_id' })
    .select('id, status')
    .single();
  if (upErr) throw upErr;

  // Solo seguimos si ya está aprobado
  if (entry.status !== 'approved') return;

  // 2️⃣ Marca al usuario en vip_users
  await sb
    .from('vip_users')
    .upsert({ id: clerkId, entry_tx_id: entry.id }, { onConflict: 'id' });

  // 3️⃣ Trae email y nombre del usuario
  const { data: userRow, error: userErr } = await sb
    .from('clerk_users')
    .select('email, full_name')
    .eq('clerk_id', clerkId)
    .single();
  if (userErr || !userRow?.email) {
    console.warn('No se pudo recuperar email de clerk_users:', userErr);
    return;
  }
  const toEmail = userRow.email;
  const name    = userRow.full_name || 'VIP Member';

  // 4️⃣ Envía correo de bienvenida
  await resend.emails.send({
    from   : 'MotorMania <noreply@motormaniacolombia.com>',
    to     : toEmail,
    subject: '¡Bienvenido a F1 Fantasy VIP!',
    html: `
      <p>¡Hola ${name}!</p>
      <p>Tu suscripción a <strong>F1 Fantasy VIP</strong> ha sido confirmada ✅.</p>
      <p>Ya puedes acceder a todas las ventajas exclusivas en tu panel.</p>
      <p>¡Nos vemos en la pista! 🏎️</p>
    `
  });

  // 5️⃣ Suscribe el contacto a la audiencia “fantasy-vip”
  await resend.contacts.create({
    email        : toEmail,
    first_name   : name.split(' ')[0],
    last_name    : name.split(' ').slice(1).join(' ') || undefined,
    unsubscribed : false,
    audience_id  : VIP_AUDIENCE
  });
}

/* ─── Entrada del webhook ──────────────────────────────────── */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  if (!verifyBold(sig, raw)) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const evt = JSON.parse(raw);
  if (evt.type !== 'SALE_APPROVED') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await handleVipSubscription(evt.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('VIP webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}