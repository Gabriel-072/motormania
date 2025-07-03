import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Retrieve environment variables
const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const accessToken = process.env.META_CAPI_TOKEN;

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

    // 🎯 ENHANCED FACEBOOK PURCHASE TRACKING (CAPI)
    let purchaseEventId: string | undefined;
    let registrationEventId: string | undefined; 
    let subscribeEventId: string | undefined;

    try {
      if (displayEmail && displayEmail !== 'No email') {
        purchaseEventId = crypto.randomUUID();

        // Hash user data for privacy (required by Facebook)
        const hashedEmail = crypto
          .createHash('sha256')
          .update(displayEmail.toLowerCase().trim())
          .digest('hex');

        // Split name for better hashing
        const nameParts = displayName.toLowerCase().trim().split(' ');
        const hashedFirstName = nameParts[0] && displayName !== 'Sin nombre'
          ? crypto.createHash('sha256').update(nameParts[0]).digest('hex')
          : undefined;
        const hashedLastName = nameParts[1] && displayName !== 'Sin nombre'
          ? crypto.createHash('sha256').update(nameParts.slice(1).join(' ')).digest('hex')
          : undefined;

        // Get client IP and user agent from request headers
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                         req.headers.get('x-real-ip') ||
                         req.headers.get('cf-connecting-ip');
        const userAgent = req.headers.get('user-agent');

        // ENHANCED PURCHASE EVENT with better parameters
        const capiPayload = {
          data: [{
            event_name: 'Purchase',
            event_id: purchaseEventId,
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy-vip-info`,
            action_source: 'website',
            user_data: {
              em: [hashedEmail],
              fn: hashedFirstName ? [hashedFirstName] : undefined,
              ln: hashedLastName ? [hashedLastName] : undefined,
              client_ip_address: clientIp,
              client_user_agent: userAgent,
              fbc: undefined, // These will be filled by frontend
              fbp: undefined,
            },
            custom_data: {
              content_ids: [transaction.plan_id],
              content_type: 'product',
              content_category: 'vip_membership',
              content_name: transaction.plan_id === 'season-pass' ? 'Season Pass' : 'Race Pass',
              value: (data.amount?.total || transaction.amount_cop) / 1000,
              currency: 'COP',
              num_items: 1,
              transaction_id: boldPaymentId,
              order_id: transaction.order_id,
              payment_method: 'bold_checkout',
              purchase_type: transaction.plan_id === 'season-pass' ? 'premium_annual' : 'entry_single',
              discount_applied: transaction.plan_id === 'season-pass' ? 'yes' : 'no',
              discount_amount: transaction.plan_id === 'season-pass' ? ((data.amount?.total || transaction.amount_cop) * 0.4) / 1000 : 0,
              predicted_ltv: transaction.plan_id === 'season-pass' ? 300 : 150,
              selected_gp: transaction.selected_gp || undefined,
              conversion_source: 'webhook_completion',
              funnel_stage: 'purchase_completed'
            }
          }],
          access_token: accessToken
        };

        // Send to Facebook Conversions API
        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events`,
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
          console.log('✅ Enhanced Facebook Purchase tracked via CAPI:', {
            event_id: purchaseEventId,
            order_id: transaction.order_id,
            plan_id: transaction.plan_id,
            value: (data.amount?.total || transaction.amount_cop) / 1000,
            events_received: fbResult.events_received,
            fb_trace_id: fbResult.fbtrace_id
          });

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

        // 🎯 ENHANCED COMPLETE REGISTRATION EVENT
        registrationEventId = crypto.randomUUID();
        const registrationPayload = {
          data: [{
            event_name: 'CompleteRegistration',
            event_id: registrationEventId,
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy-vip-success`,
            action_source: 'website',
            user_data: {
              em: [hashedEmail],
              fn: hashedFirstName ? [hashedFirstName] : undefined,
              ln: hashedLastName ? [hashedLastName] : undefined,
              client_ip_address: clientIp,
              client_user_agent: userAgent,
            },
            custom_data: {
              content_category: 'vip_user_registration',
              content_name: `User Registration Completed for ${transaction.plan_id}`,
              content_ids: [transaction.plan_id],
              value: (data.amount?.total || transaction.amount_cop) / 1000,
              currency: 'COP',
              registration_method: 'purchase_completion',
              registration_source: 'payment_success',
              user_type: 'new_vip_member',
              plan_type: transaction.plan_id,
              predicted_ltv: transaction.plan_id === 'season-pass' ? 300 : 150
            }
          }],
          access_token: accessToken
        };

        // Send Complete Registration event
        const regResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationPayload)
          }
        );

        if (regResponse.ok) {
          const regResult = await regResponse.json();
          console.log('✅ Enhanced Facebook CompleteRegistration tracked via CAPI:', {
            event_id: registrationEventId,
            events_received: regResult.events_received,
            fb_trace_id: regResult.fbtrace_id
          });
        } else {
          const regError = await regResponse.text();
          console.error('❌ Facebook CompleteRegistration CAPI error:', {
            status: regResponse.status,
            error: regError
          });
        }

        // 🎯 ADD SUBSCRIBE EVENT FOR VIP MEMBERSHIP
        subscribeEventId = crypto.randomUUID();
        const subscribePayload = {
          data: [{
            event_name: 'Subscribe',
            event_id: subscribeEventId,
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy-vip-success`,
            action_source: 'website',
            user_data: {
              em: [hashedEmail],
              fn: hashedFirstName ? [hashedFirstName] : undefined,
              ln: hashedLastName ? [hashedLastName] : undefined,
              client_ip_address: clientIp,
              client_user_agent: userAgent,
            },
            custom_data: {
              content_category: 'vip_membership',
              content_name: `VIP ${transaction.plan_id} Subscription`,
              content_ids: [transaction.plan_id],
              value: (data.amount?.total || transaction.amount_cop) / 1000,
              currency: 'COP',
              subscription_type: transaction.plan_id,
              subscription_duration: transaction.plan_id === 'season-pass' ? 'annual' : 'single_event',
              predicted_ltv: transaction.plan_id === 'season-pass' ? 300 : 150
            }
          }],
          access_token: accessToken
        };

        // Send Subscribe event
        const subResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscribePayload)
          }
        );

        if (subResponse.ok) {
          const subResult = await subResponse.json();
          console.log('✅ Facebook Subscribe event tracked via CAPI:', {
            event_id: subscribeEventId,
            events_received: subResult.events_received
          });
        } else {
          console.error('❌ Facebook Subscribe CAPI error:', await subResponse.text());
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
      user_id: transaction.user_id,
      plan_id: transaction.plan_id,
      amount_cop: data.amount?.total || transaction.amount_cop,
      facebook_tracking: {
        purchase: purchaseEventId ? 'completed' : 'skipped',
        registration: registrationEventId ? 'completed' : 'skipped',
        subscribe: subscribeEventId ? 'completed' : 'skipped'
      },
      tracking_events: {
        purchase_event_id: purchaseEventId,
        registration_event_id: registrationEventId,
        subscribe_event_id: subscribeEventId
      }
    });

  } catch (err) {
    console.error('❌ Webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}