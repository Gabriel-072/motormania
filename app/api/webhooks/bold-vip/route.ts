import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOLD_SECRET = process.env.BOLD_WEBHOOK_SECRET_KEY!;

/* ---------------------------- Verify Signature --------------------------- */
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
          race_pass_gp: racePassGp
        },
        { onConflict: 'id' }
      );

    if (userError) {
      console.error('❌ Error upserting vip_user:', userError);
    }

    // 🎯 FACEBOOK PURCHASE TRACKING (CAPI)
    try {
      if (displayEmail && displayEmail !== 'No email') {
        const purchaseEventId = crypto.randomUUID();

        // Hash user data for privacy (required by Facebook)
        const hashedEmail = crypto
          .createHash('sha256')
          .update(displayEmail.toLowerCase().trim())
          .digest('hex');

        const hashedName = displayName !== 'Sin nombre'
          ? crypto.createHash('sha256').update(displayName.toLowerCase().trim()).digest('hex')
          : undefined;

        // Get client IP and user agent from request headers
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                         req.headers.get('x-real-ip') ||
                         req.headers.get('cf-connecting-ip');
        const userAgent = req.headers.get('user-agent');

        const capiPayload = {
          data: [{
            event_name: 'Purchase',
            event_id: purchaseEventId,
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy-vip-info`,
            action_source: 'website',
            user_data: {
              em: [hashedEmail], // Array of hashed emails
              fn: hashedName ? [hashedName] : undefined, // Array of hashed first names
              client_ip_address: clientIp,
              client_user_agent: userAgent,
              fbc: undefined, // Facebook click ID (not available in webhook)
              fbp: undefined, // Facebook browser ID (not available in webhook)
            },
            custom_data: {
              content_ids: [transaction.plan_id],
              content_type: 'product',
              content_name: transaction.plan_id === 'season-pass' ? 'Season Pass' : 'Race Pass',
              value: (data.amount?.total || transaction.amount_cop) / 1000, // Convert to thousands
              currency: 'COP',
              num_items: 1,
              order_id: transaction.order_id,
              payment_method: 'bold_checkout',
              // Additional custom parameters
              plan_type: transaction.plan_id,
              selected_gp: transaction.selected_gp || undefined,
              conversion_source: 'webhook'
            }
          }],
          access_token: process.env.FB_ACCESS_TOKEN
        };

        // Send to Facebook Conversions API
        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${process.env.FB_PIXEL_ID}/events`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(capiPayload)
          }
        );

        if (fbResponse.ok) {
          const fbResult = await fbResponse.json();
          console.log('✅ Facebook Purchase tracked via CAPI:', {
            event_id: purchaseEventId,
            order_id: transaction.order_id,
            fb_result: fbResult
          });

          // Log the response for debugging
          if (fbResult.events_received !== 1) {
            console.warn('⚠️ Facebook CAPI warning:', fbResult);
          }
        } else {
          const error = await fbResponse.text();
          console.error('❌ Facebook CAPI error:', {
            status: fbResponse.status,
            error: error,
            order_id: transaction.order_id
          });
        }

        // 🎯 ALSO TRACK COMPLETE REGISTRATION EVENT
        const registrationEventId = crypto.randomUUID();
        const registrationPayload = {
          data: [{
            event_name: 'CompleteRegistration',
            event_id: registrationEventId,
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy-vip-success`,
            action_source: 'website',
            user_data: {
              em: [hashedEmail],
              fn: hashedName ? [hashedName] : undefined,
              client_ip_address: clientIp,
              client_user_agent: userAgent,
            },
            custom_data: {
              content_category: 'vip_membership',
              content_name: transaction.plan_id,
              value: (data.amount?.total || transaction.amount_cop) / 1000,
              currency: 'COP',
              registration_method: 'purchase_completion',
              plan_type: transaction.plan_id
            }
          }],
          access_token: process.env.FB_ACCESS_TOKEN
        };

        // Send Complete Registration event
        const regResponse = await fetch(
          `https://graph.facebook.com/v18.0/${process.env.FB_PIXEL_ID}/events`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationPayload)
          }
        );

        if (regResponse.ok) {
          console.log('✅ Facebook CompleteRegistration tracked via CAPI');
        } else {
          console.error('❌ Facebook CompleteRegistration CAPI error:', await regResponse.text());
        }
      } else {
        console.warn('⚠️ Skipping Facebook tracking - no valid email found for order:', transaction.order_id);
      }
    } catch (fbError) {
      console.error('❌ Facebook tracking error (non-critical):', fbError);
      // Don't fail the webhook for tracking errors
    }

    return NextResponse.json({
      ok: true,
      processed: true,
      transaction_id: result.transaction_id,
      facebook_tracking: 'completed' // Confirm tracking was attempted
    });

  } catch (err) {
    console.error('❌ Webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}