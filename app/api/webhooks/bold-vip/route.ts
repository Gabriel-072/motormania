// 📁 app/api/webhooks/bold-vip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOLD_SECRET = process.env.BOLD_WEBHOOK_SECRET_KEY!;
const SLACK_WEBHOOK = process.env.SLACK_MMC_NEW_VIP_WEBHOOK_URL!;

/* ---------------------------- Verify signature --------------------------- */
function verifyBold(sig: string, raw: string): boolean {
  const bodyB64 = Buffer.from(raw).toString('base64');
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

/* ---------------------------- Send Slack Notification --------------------------- */
async function sendSlackNotification(data: {
  transactionId: bigint;
  userId: string;
  fullName: string;
  email: string;
  planId: string;
  amountCop: number;
  paidAt: string;
}) {
  try {
    const planName = data.planId === 'season-pass' ? '🏆 Season Pass' : '🏁 Race Pass';
    const formattedAmount = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(data.amountCop);

    const slackPayload = {
      text: `✅ *Nuevo miembro VIP confirmado*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 Nuevo Miembro VIP',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Usuario:*\n${data.fullName}`
            },
            {
              type: 'mrkdwn',
              text: `*Email:*\n${data.email}`
            },
            {
              type: 'mrkdwn',
              text: `*Plan:*\n${planName}`
            },
            {
              type: 'mrkdwn',
              text: `*Monto:*\n${formattedAmount}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Transaction ID: ${data.transactionId} | User ID: ${data.userId} | Pagado: ${new Date(data.paidAt).toLocaleString('es-CO')}`
            }
          ]
        }
      ]
    };

    const slackRes = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!slackRes.ok) {
      const errorText = await slackRes.text();
      throw new Error(`Slack responded with ${slackRes.status}: ${errorText}`);
    }

    console.log('✅ Slack notification sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Slack notification error:', error);
    return false;
  }
}

/* ---------------------------- Main Handler --------------------------- */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  console.log('🎯 Bold webhook received');
  console.log('🎯 Bold VIP webhook received');
  console.log('📦 Raw body:', raw.substring(0, 200)); // First 200 chars

  // Verify signature
  if (!verifyBold(sig, raw)) {
    console.error('❌ Invalid Bold signature');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const evt = JSON.parse(raw);
  console.log('🎯 Webhook event:', evt.type);

  // Only process approved payments
  if (evt.type !== 'SALE_APPROVED' && evt.type !== 'PAYMENT_APPROVED') {
    console.log('⏭️ Ignoring event type:', evt.type);
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const data = evt.data;
    const orderId = data.metadata?.reference || data.order_id || data.external_reference;
    
    if (!orderId) {
      console.error('❌ No order ID in webhook');
      return NextResponse.json({ ok: true, error: 'No order ID' });
    }

    const boldPaymentId = data.payment_id || data.id;

    // Use the idempotent function to update payment status
    const { data: updateResult, error: updateError } = await sb.rpc(
      'update_vip_payment_status',
      {
        p_order_id: orderId,
        p_payment_id: boldPaymentId,
        p_status: 'paid'
      }
    );

    if (updateError || !updateResult?.[0]) {
      console.error('❌ Update error:', updateError);
      return NextResponse.json({ ok: false, error: updateError?.message });
    }

    const result = updateResult[0];
    console.log('✅ Payment update result:', result);

    // If already processed, return early
    if (result.already_processed) {
      console.log('ℹ️ Order already processed, skipping');
      return NextResponse.json({ ok: true, already_processed: true });
    }

    // Get full transaction details for further processing
    const { data: transaction, error: fetchError } = await sb
      .from('vip_transactions')
      .select('*')
      .eq('id', result.transaction_id)
      .single();

    if (fetchError || !transaction) {
      console.error('❌ Error fetching transaction:', fetchError);
      return NextResponse.json({ ok: false, error: 'Transaction not found' });
    }

    // Create/Update vip_entries
    const { error: entryError } = await sb
      .from('vip_entries')
      .upsert(
        {
          bold_order_id: boldPaymentId,
          user_id: transaction.user_id,
          status: 'approved',
          amount_paid: data.amount?.total || transaction.amount_cop,
          currency: data.currency || 'COP',
          webhook_processed_at: new Date().toISOString(),
          metadata: data
        },
        { onConflict: 'bold_order_id' }
      );

    if (entryError) {
      console.error('❌ Error upserting vip_entry:', entryError);
    }

    // Get user data from clerk_users for accurate information
    const { data: clerkUser } = await sb
      .from('clerk_users')
      .select('full_name, email')
      .eq('clerk_id', transaction.user_id)
      .single();

    const displayName = clerkUser?.full_name || transaction.full_name || 'Sin nombre';
    const displayEmail = clerkUser?.email || transaction.email || 'No email';

    // Create/Update vip_users
    const entryTxId = crypto.randomUUID();
    const activePlan = transaction.plan_id;
    const planExpiresAt = transaction.plan_id === 'season-pass' 
      ? new Date('2026-12-31').toISOString() 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days for race pass

    const { error: userError } = await sb
      .from('vip_users')
      .upsert(
        {
          id: transaction.user_id,
          entry_tx_id: entryTxId,
          joined_at: transaction.paid_at,
          full_name: displayName,
          email: displayEmail,
          active_plan: activePlan,
          plan_expires_at: planExpiresAt
        },
        { onConflict: 'id' }
      );

    if (userError) {
      console.error('❌ Error upserting vip_user:', userError);
    }

    // Send Slack notification if needed
    if (result.should_notify_slack) {
      const slackSuccess = await sendSlackNotification({
        transactionId: result.transaction_id,
        userId: transaction.user_id,
        fullName: displayName,
        email: displayEmail,
        planId: transaction.plan_id,
        amountCop: transaction.amount_cop,
        paidAt: transaction.paid_at
      });

      // Mark as notified if successful
      if (slackSuccess) {
        await sb
          .from('vip_transactions')
          .update({ slack_notified: true })
          .eq('id', result.transaction_id);
      }
    }

    return NextResponse.json({ 
      ok: true,
      processed: true,
      transaction_id: result.transaction_id
    });

  } catch (err) {
    console.error('❌ Webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}