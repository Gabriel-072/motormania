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

// In the webhook handler, after getting the transaction:

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

// Calculate proper expiration based on plan type
let planExpiresAt;
let racePassGp = null;

if (transaction.plan_id === 'race-pass' && transaction.selected_gp) {
  // Get the race date for the selected GP
  const { data: gpData } = await sb
    .from('gp_schedule')
    .select('race_time')
    .eq('gp_name', transaction.selected_gp)
    .single();
  
  if (gpData) {
    // Race pass expires 4 hours after the race ends
    const raceDate = new Date(gpData.race_time);
    planExpiresAt = new Date(raceDate.getTime() + 4 * 60 * 60 * 1000).toISOString(); // +4 hours
    racePassGp = transaction.selected_gp; // Set the GP name
  } else {
    // Fallback: 30 days if GP not found
    planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
} else if (transaction.plan_id === 'season-pass') {
  planExpiresAt = new Date('2026-12-31').toISOString();
  racePassGp = null; // Season pass has access to all GPs
} else {
  // Default fallback
  planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

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
      plan_expires_at: planExpiresAt,
      race_pass_gp: racePassGp // Now properly set!
    },
    { onConflict: 'id' }
  );

if (userError) {
  console.error('❌ Error upserting vip_user:', userError);
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