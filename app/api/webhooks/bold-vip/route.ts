// 📁 app/api/webhooks/bold-vip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import crypto                        from 'crypto';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOLD_SECRET   = process.env.BOLD_WEBHOOK_SECRET_KEY!;
const SLACK_WEBHOOK = process.env.SLACK_MMC_NEW_VIP_WEBHOOK_URL!;

/* ---------------------------- Verify signature --------------------------- */
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

/* ------------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  console.log('🎯 Bold webhook received');

  if (!verifyBold(sig, raw)) {
    console.error('❌ Invalid Bold signature');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const evt = JSON.parse(raw);
  console.log('🎯 Webhook event:', evt.type);

  if (evt.type !== 'SALE_APPROVED' && evt.type !== 'PAYMENT_APPROVED') {
    console.log('⏭️ Ignoring event type:', evt.type);
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const data    = evt.data;
    const orderId = data.metadata?.reference || data.order_id || data.external_reference;
    if (!orderId) {
      console.error('❌ No order ID in webhook');
      return NextResponse.json({ ok: true, error: 'No order ID' });
    }

    /* ---------- 1️⃣ Actualiza vip_transactions y obtén la fila ------------ */
    const { data: updatedTx, error: updateError } = await sb
      .from('vip_transactions')
      .update({
        payment_status  : 'paid',
        paid_at         : new Date().toISOString(),
        bold_payment_id : data.payment_id || data.id
      })
      .eq('order_id', orderId)
      .select('id, user_id, full_name, plan_id, amount_cop, paid_at')
      .single();

    if (updateError || !updatedTx) {
      console.error('❌ Update error:', updateError);
      return NextResponse.json({ ok: false, error: updateError?.message });
    }

    console.log('✅ Transaction updated:', updatedTx.id);

    /* ---------- 2️⃣ Upsert en vip_entries y vip_users ---------- */
    await sb
      .from('vip_entries')
      .upsert(
        {
          bold_order_id: data.payment_id || data.id,
          user_id      : updatedTx.user_id,
          status       : 'approved',
          amount_paid  : data.amount?.total || updatedTx.amount_cop,
          currency     : data.currency || 'COP'
        },
        { onConflict: 'bold_order_id' }
      );

    // Obtenemos nombre real si existe en clerk_users
    const { data: clerkUser } = await sb
      .from('clerk_users')
      .select('full_name')
      .eq('clerk_id', updatedTx.user_id)
      .single();

    const displayName = clerkUser?.full_name ?? updatedTx.full_name ?? 'Sin nombre';

    // entry_tx_id es uuid en vip_users
    const entryTxId = crypto.randomUUID();

    await sb
      .from('vip_users')
      .upsert(
        {
          id          : updatedTx.user_id,
          entry_tx_id : entryTxId,
          joined_at   : updatedTx.paid_at
        },
        { onConflict: 'id' }
      );

    /* ---------------- 3️⃣ Notificación a Slack ----------------- */
    try {
      const slackPayload = {
        text: [
          '*✅ Pago VIP confirmado*',
          `• Transacción ID: ${updatedTx.id}`,
          `• Usuario: <@${updatedTx.user_id}> (${displayName})`,
          `• Plan: ${updatedTx.plan_id}`,
          `• Monto: $${updatedTx.amount_cop} COP`,
          `• Fecha de pago: ${updatedTx.paid_at}`
        ].join('\n'),
      };

      console.log('🔔 Payload Slack:', JSON.stringify(slackPayload));

      const slackRes = await fetch(SLACK_WEBHOOK, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(slackPayload),
      });

      const slackText = await slackRes.text();
      console.log('🔔 Slack status:', slackRes.status, 'body:', slackText);

      if (!slackRes.ok) throw new Error('Slack respondió código no-200');
    } catch (err) {
      console.error('❌ Slack fetch error:', err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('❌ Webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}