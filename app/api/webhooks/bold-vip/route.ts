//app/api/webhooks/bold-vip/route.ts - ENHANCED FOR PAY-FIRST FLOW

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@clerk/nextjs/server';
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

/* ---------------------------- Create User Account --------------------------- */
async function createUserAccount(email: string, fullName?: string) {
  try {
    // 🔥 FIXED: Await clerkClient() first
    const clerk = await clerkClient();
    
    // Check if user already exists
    const existingUsersResponse = await clerk.users.getUserList({
      emailAddress: [email]
    });

    // 🔥 FIXED: Access the data property for the actual users array
    const existingUsers = existingUsersResponse.data;

    if (existingUsers && existingUsers.length > 0) {
      console.log('👤 User already exists:', email);
      return {
        isNewUser: false,
        clerkUserId: existingUsers[0].id,
        user: existingUsers[0]
      };
    }

    // 🔥 IMPROVED: Better name parsing for Clerk
    const parseNameForClerk = (fullName: string) => {
      if (!fullName || fullName === 'Usuario VIP' || fullName.includes('[')) {
        return { firstName: undefined, lastName: undefined };
      }
      
      const parts = fullName.trim().split(' ');
      return {
        firstName: parts[0] || undefined,
        lastName: parts.slice(1).join(' ') || undefined
      };
    };

    const { firstName, lastName } = parseNameForClerk(fullName || '');

    const newUser = await clerk.users.createUser({
      emailAddress: [email],
      firstName,
      lastName,
      skipPasswordRequirement: true,
      skipPasswordChecks: true
    });

    console.log('✅ New Clerk user created:', {
      id: newUser.id,
      email: email,
      name: fullName
    });

    // 🔥 FIXED: Store in clerk_users table with proper name handling
    const cleanName = fullName && fullName !== 'Usuario VIP' && !fullName.includes('[') 
      ? fullName 
      : (email ? email.split('@')[0].replace(/[._]/g, ' ').charAt(0).toUpperCase() + email.split('@')[0].replace(/[._]/g, ' ').slice(1) : 'Usuario VIP');

    await sb
      .from('clerk_users')
      .upsert({
        clerk_id: newUser.id,
        email: email,
        full_name: cleanName,
        created_at: new Date().toISOString(),
        created_via: 'pay_first_webhook'
      }, { onConflict: 'clerk_id' });

    return {
      isNewUser: true,
      clerkUserId: newUser.id,
      user: newUser
    };

  } catch (error) {
    console.error('❌ Error creating user account:', error);
    throw error;
  }
}

/* ---------------------------- Generate Login Session --------------------------- */
async function generateLoginSession(clerkUserId: string, orderId: string) {
  try {
    // Create a session token for auto-login
    const sessionToken = crypto.randomUUID();
    
    // Store session token in database for verification
    await sb
      .from('vip_login_sessions')
      .insert({
        session_token: sessionToken,
        clerk_user_id: clerkUserId,
        order_id: orderId,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        used: false
      });

    return sessionToken;
  } catch (error) {
    console.error('❌ Error generating login session:', error);
    return null;
  }
}

/* ---------------------------- Main Handler --------------------------- */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  console.log('🎯 Bold VIP webhook received');
  console.log('📦 Raw body:', raw.substring(0, 200));

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

    // 🔥 ENHANCED: Aggressive email extraction
    const extractAllPossibleEmails = (data: any) => {
      const emailSources = [
        data.customer?.email,
        data.customer?.emailAddress, 
        data.customer?.email_address,
        data.billing_data?.email,
        data.billing?.email,
        data.payer?.email,
        data.buyer?.email,
        data.contact?.email,
        data.metadata?.customer_email,
        data.payment_method?.customer?.email,
        data.card_holder?.email,
        data.transaction?.customer_email,
        data.checkout?.customer?.email,
        data.customer?.contact?.email,
        data.billing_address?.email,
        data.shipping_address?.email,
        data.payment_source?.payer?.email,
        data.payment_details?.email
      ];

      for (const email of emailSources) {
        if (email && typeof email === 'string' && email.includes('@')) {
          return email.toLowerCase().trim();
        }
      }
      return null;
    };

    // 🔥 ENHANCED: Better name extraction with fallback
    const extractCustomerName = (data: any, email: string | null) => {
      const nameSources = [
        data.customer?.name,
        data.customer?.full_name,
        data.customer?.fullName,
        data.billing_data?.name,
        data.billing?.name,
        data.payer?.name,
        data.buyer?.name,
        data.card_holder?.name,
        data.metadata?.customer_name,
        `${data.customer?.first_name || ''} ${data.customer?.last_name || ''}`.trim(),
        `${data.customer?.firstName || ''} ${data.customer?.lastName || ''}`.trim(),
        `${data.billing_data?.first_name || ''} ${data.billing_data?.last_name || ''}`.trim()
      ];

      for (const name of nameSources) {
        if (name && typeof name === 'string' && name.length > 1 && !name.includes('[') && !name.includes('pending')) {
          return name.trim();
        }
      }
      
      // Fallback to email-based name if available
      if (email) {
        const emailName = email.split('@')[0].replace(/[._]/g, ' ');
        return emailName.charAt(0).toUpperCase() + emailName.slice(1);
      }
      
      return 'Usuario VIP';
    };

    // Extract customer data
    const customerEmail = extractAllPossibleEmails(data);
    const customerName = extractCustomerName(data, customerEmail);

    console.log('📧 Email extraction attempt:', {
      customerEmail,
      customerName,
      available_fields: Object.keys(data)
    });

    if (!customerEmail) {
      console.log('⚠️ No customer email in Bold payment data - will require manual collection');
      
      // Handle missing email case
      const { data: updateResult, error: updateError } = await sb.rpc(
        'update_vip_payment_status',
        {
          p_order_id: orderId,
          p_payment_id: boldPaymentId,
          p_status: 'paid_no_email', // Special status for payments without email
          p_user_id: null,
          p_email: null,
          p_full_name: customerName
        }
      );

      if (updateError) {
        console.error('❌ Update error for no-email payment:', updateError);
        return NextResponse.json({ ok: false, error: updateError?.message });
      }

      return NextResponse.json({
        ok: true,
        processed: true,
        requires_email_collection: true,
        transaction_id: updateResult[0]?.transaction_id,
        order_id: orderId,
        customer_name: customerName,
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/vip-email-only?order=${orderId}`,
        message: 'Payment successful, email collection required'
      });
    }

    console.log('📧 Customer email extracted:', customerEmail);
    console.log('👤 Customer name extracted:', customerName);

    // 🚀 CREATE OR FIND USER ACCOUNT
    let userAccount;
    try {
      userAccount = await createUserAccount(customerEmail, customerName);
    } catch (accountError) {
      console.error('❌ Failed to create user account:', accountError);
      // Continue processing but note the error
      userAccount = null;
    }

    // Update payment status with user info
    const { data: updateResult, error: updateError } = await sb.rpc(
      'update_vip_payment_status',
      {
        p_order_id: orderId,
        p_payment_id: boldPaymentId,
        p_status: 'paid',
        p_user_id: userAccount?.clerkUserId, // 🔥 NEW: Add user ID
        p_email: customerEmail, // 🔥 NEW: Add email
        p_full_name: customerName // 🔥 NEW: Add name
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

    // Get full transaction details
    const { data: transaction, error: fetchError } = await sb
      .from('vip_transactions')
      .select('*')
      .eq('id', result.transaction_id)
      .single();

    if (fetchError || !transaction) {
      console.error('❌ Error fetching transaction:', fetchError);
      return NextResponse.json({ ok: false, error: 'Transaction not found' });
    }

    // 🔥 GENERATE LOGIN SESSION FOR AUTO-LOGIN
    let loginSessionToken = null;
    if (userAccount?.clerkUserId) {
      loginSessionToken = await generateLoginSession(userAccount.clerkUserId, orderId);
    }

    // Create/Update vip_entries
    const { error: entryError } = await sb
      .from('vip_entries')
      .upsert(
        {
          bold_order_id: boldPaymentId,
          user_id: userAccount?.clerkUserId || transaction.user_id,
          status: 'approved',
          amount_paid: data.amount?.total || transaction.amount_cop,
          currency: data.currency || 'COP',
          webhook_processed_at: new Date().toISOString(),
          metadata: data,
          // 🔥 NEW: Pay-first flow data
          customer_email: customerEmail,
          customer_name: customerName,
          account_created: userAccount?.isNewUser || false,
          login_session_token: loginSessionToken
        },
        { onConflict: 'bold_order_id' }
      );

    if (entryError) {
      console.error('❌ Error upserting vip_entry:', entryError);
    }

    // Calculate plan expiration
    let planExpiresAt;
    let racePassGp = null;

    if (transaction.plan_id === 'race-pass' && transaction.selected_gp) {
      const { data: gpData } = await sb
        .from('gp_schedule')
        .select('race_time')
        .eq('gp_name', transaction.selected_gp)
        .single();

      if (gpData) {
        const raceDate = new Date(gpData.race_time);
        planExpiresAt = new Date(raceDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
        racePassGp = transaction.selected_gp;
      } else {
        planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
    } else if (transaction.plan_id === 'season-pass') {
      planExpiresAt = new Date('2026-12-31').toISOString();
      racePassGp = null;
    } else {
      planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Create/Update vip_users
    const entryTxId = crypto.randomUUID();
    const { error: userError } = await sb
      .from('vip_users')
      .upsert(
        {
          id: userAccount?.clerkUserId || transaction.user_id,
          entry_tx_id: entryTxId,
          joined_at: transaction.paid_at,
          full_name: customerName && customerName !== 'Usuario VIP' ? customerName : (customerEmail ? customerEmail.split('@')[0].replace(/[._]/g, ' ').charAt(0).toUpperCase() + customerEmail.split('@')[0].replace(/[._]/g, ' ').slice(1) : 'Usuario VIP'),
          email: customerEmail || transaction.email,
          active_plan: transaction.plan_id,
          plan_expires_at: planExpiresAt,
          race_pass_gp: racePassGp,
          // 🔥 NEW: Pay-first flow tracking
          created_via_pay_first: userAccount?.isNewUser || false,
          login_session_token: loginSessionToken
        },
        { onConflict: 'id' }
      );

    if (userError) {
      console.error('❌ Error upserting vip_user:', userError);
    }

    // 🎯 ENHANCED FACEBOOK TRACKING - Now includes CompleteRegistration for new accounts
    let purchaseEventId: string | undefined;
    let registrationEventId: string | undefined;
    let subscribeEventId: string | undefined;

    try {
      if (customerEmail) {
        purchaseEventId = crypto.randomUUID();

        const hashedEmail = crypto
          .createHash('sha256')
          .update(customerEmail.toLowerCase().trim())
          .digest('hex');

        const nameParts = (customerName || '').toLowerCase().trim().split(' ');
        const hashedFirstName = nameParts[0] && customerName
          ? crypto.createHash('sha256').update(nameParts[0]).digest('hex')
          : undefined;
        const hashedLastName = nameParts[1] && customerName
          ? crypto.createHash('sha256').update(nameParts.slice(1).join(' ')).digest('hex')
          : undefined;

        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                         req.headers.get('x-real-ip') ||
                         req.headers.get('cf-connecting-ip') ||
                         '127.0.0.1';
        
        const userAgent = req.headers.get('user-agent') || '';

        // 🎯 PURCHASE EVENT
        const capiPayload = {
          data: [{
            event_name: 'Purchase',
            event_id: purchaseEventId,
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
              predicted_ltv: transaction.plan_id === 'season-pass' ? 300 : 150,
              selected_gp: transaction.selected_gp || undefined,
              conversion_source: 'pay_first_webhook',
              funnel_stage: 'purchase_completed',
              account_created: userAccount?.isNewUser || false,
              pay_first_flow: true // 🔥 NEW: Flag for pay-first
            }
          }],
          access_token: accessToken,
          test_event_code: process.env.FB_TEST_EVENT_CODE || undefined
        };

        // Send Purchase event
        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(capiPayload)
          }
        );

        if (fbResponse.ok) {
          const fbResult = await fbResponse.json();
          console.log('✅ Facebook Purchase tracked via CAPI:', {
            event_id: purchaseEventId,
            order_id: transaction.order_id,
            events_received: fbResult.events_received,
            fb_trace_id: fbResult.fbtrace_id
          });
        }

        // 🔥 COMPLETE REGISTRATION EVENT (Always send for pay-first flow)
        registrationEventId = crypto.randomUUID();
        const registrationPayload = {
          data: [{
            event_name: 'CompleteRegistration',
            event_id: registrationEventId,
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL}/vip-account-setup`,
            action_source: 'website',
            user_data: {
              em: [hashedEmail],
              fn: hashedFirstName ? [hashedFirstName] : undefined,
              ln: hashedLastName ? [hashedLastName] : undefined,
              client_ip_address: clientIp,
              client_user_agent: userAgent,
            },
            custom_data: {
              content_category: 'vip_account_creation',
              content_name: `Account Created via Pay-First for ${transaction.plan_id}`,
              content_ids: [transaction.plan_id],
              value: (data.amount?.total || transaction.amount_cop) / 1000,
              currency: 'COP',
              registration_method: 'pay_first_flow',
              registration_source: 'payment_completion',
              user_type: userAccount?.isNewUser ? 'new_user' : 'existing_user',
              plan_type: transaction.plan_id,
              account_created: userAccount?.isNewUser || false,
              pay_first_conversion: true // 🔥 NEW: Flag for pay-first conversions
            }
          }],
          access_token: accessToken,
          test_event_code: process.env.FB_TEST_EVENT_CODE || undefined
        };

        // Send CompleteRegistration event
        const regResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationPayload)
          }
        );

        if (regResponse.ok) {
          const regResult = await regResponse.json();
          console.log('✅ Facebook CompleteRegistration tracked for pay-first flow:', {
            event_id: registrationEventId,
            events_received: regResult.events_received,
            new_user: userAccount?.isNewUser
          });
        }

      }
    } catch (fbError) {
      console.error('❌ Facebook tracking error (non-critical):', fbError);
    }

    return NextResponse.json({
      ok: true,
      processed: true,
      transaction_id: result.transaction_id,
      user_id: userAccount?.clerkUserId || transaction.user_id,
      plan_id: transaction.plan_id,
      amount_cop: data.amount?.total || transaction.amount_cop,
      plan_expires_at: planExpiresAt,
      race_pass_gp: racePassGp,
      // 🔥 NEW: Smart redirect URL
      redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/vip-direct-access?order=${orderId}&email=${encodeURIComponent(customerEmail)}&verified=true`,
      account_info: {
        is_new_user: userAccount?.isNewUser || false,
        email: customerEmail,
        name: customerName,
        login_session_token: loginSessionToken,
        auto_login_available: !!loginSessionToken
      },
      facebook_tracking: {
        purchase: purchaseEventId ? 'completed' : 'skipped',
        registration: registrationEventId ? 'completed' : 'skipped',
        pay_first_flow: true
      },
      tracking_events: {
        purchase_event_id: purchaseEventId,
        registration_event_id: registrationEventId
      },
      webhook_processed_at: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Webhook processing error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}