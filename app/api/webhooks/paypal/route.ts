// 📁 app/api/webhooks/paypal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID!;
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
const PAYPAL_BASE_URL = 'https://api-m.paypal.com'; // Use sandbox URL for testing
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;

// Verify PayPal webhook signature
async function verifyPayPalWebhook(
  headers: Headers,
  body: string,
  webhookId: string
): Promise<boolean> {
  try {
    const authAlgo = headers.get('paypal-auth-algo');
    const transmission = headers.get('paypal-transmission-id');
    const certId = headers.get('paypal-cert-id');
    const signature = headers.get('paypal-transmission-sig');
    const timestamp = headers.get('paypal-transmission-time');

    if (!authAlgo || !transmission || !certId || !signature || !timestamp) {
      return false;
    }

    // Get PayPal access token
    const tokenResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Verify webhook signature
    const verifyResponse = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_id: certId,
        transmission_id: transmission,
        transmission_sig: signature,
        transmission_time: timestamp,
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    });

    const verifyData = await verifyResponse.json();
    return verifyData.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('PayPal webhook verification failed:', error);
    return false;
  }
}

// Track Facebook Purchase event
async function trackPurchaseEvent(orderData: {
  orderId: string;
  amount: number;
  currency: string;
  email?: string;
  userId?: string;
  picks?: any[];
  mode?: string;
}) {
  const eventId = `purchase_${orderData.orderId}_${Date.now()}`;
  
  try {
    const hashedEmail = orderData.email 
      ? crypto.createHash('sha256').update(orderData.email.toLowerCase().trim()).digest('hex')
      : undefined;
    
    const purchaseData = {
      value: (orderData.amount / 1000),
      currency: orderData.currency,
      content_type: 'product',
      content_category: 'sports_betting',
      content_ids: [`mmc_picks_${orderData.picks?.length || 0}`],
      content_name: `MMC GO ${orderData.mode === 'full' ? 'Full Throttle' : 'Safety Car'} (${orderData.picks?.length || 0} picks)`,
      num_items: orderData.picks?.length || 1,
      order_id: orderData.orderId,
    };

    await fetch(`${SITE_URL}/api/fb-track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY!
      },
      body: JSON.stringify({
        event_name: 'Purchase',
        event_id: eventId,
        event_source_url: `${SITE_URL}/mmc-go`,
        user_data: {
          em: hashedEmail,
          external_id: orderData.userId,
        },
        params: purchaseData,
      }),
    });

    console.log(`✅ PayPal Purchase event tracked: ${orderData.orderId}`);
  } catch (error) {
    console.error(`❌ Failed to track PayPal Purchase event:`, error);
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`🔔 PayPal webhook received at ${new Date().toISOString()}`);
  
  const body = await req.text();
  const headers = req.headers;

  // Verify webhook signature
  const isValid = await verifyPayPalWebhook(headers, body, PAYPAL_WEBHOOK_ID);
  if (!isValid) {
    console.error('❌ Invalid PayPal webhook signature');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);
  console.log(`📦 PayPal Event: ${event.event_type}`);

  // Handle payment completion
  if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    try {
      const paypalOrderId = event.resource.id;
      const customId = event.resource.purchase_units?.[0]?.reference_id;

      if (!customId) {
        console.warn('No reference_id found in PayPal webhook');
        return NextResponse.json({ ok: true, ignored: true });
      }

      // Find transaction in database
      const { data: tx } = await sb
        .from('pick_transactions')
        .select('*')
        .eq('order_id', customId)
        .eq('paypal_order_id', paypalOrderId)
        .maybeSingle();

      if (!tx) {
        console.warn('Transaction not found for PayPal order:', paypalOrderId);
        return NextResponse.json({ ok: true, ignored: true });
      }

      if (tx.payment_status === 'paid') {
        console.info('Transaction already processed');
        return NextResponse.json({ ok: true, ignored: true });
      }

      // Mark as paid
      await sb.from('pick_transactions')
        .update({ 
          payment_status: 'paid', 
          paypal_order_id: paypalOrderId 
        })
        .eq('id', tx.id);

      // Move to picks table
      await sb.from('picks').insert({
        user_id: tx.user_id,
        gp_name: tx.gp_name,
        session_type: 'combined',
        picks: tx.picks ?? [],
        multiplier: Number(tx.multiplier ?? 0),
        wager_amount: tx.wager_amount ?? 0,
        potential_win: tx.potential_win ?? 0,
        name: tx.full_name,
        mode: tx.mode,
        order_id: customId,
        pick_transaction_id: tx.id
      });

      // Add wallet rewards
      if (tx.wager_amount) {
        const mmc = Math.round(tx.wager_amount / 1000);
        const fuel = tx.wager_amount;
        const cop = Math.round(tx.wager_amount);
        
        const { error: rpcErr } = await sb.rpc('increment_wallet_balances', {
          uid: tx.user_id,
          mmc_amount: mmc,
          fuel_amount: fuel,
          cop_amount: cop
        });
        if (rpcErr) console.warn('RPC wallet error', rpcErr.message);
      }

      // Track Facebook Purchase event
      await trackPurchaseEvent({
        orderId: customId,
        amount: tx.wager_amount || 0,
        currency: 'COP',
        email: tx.email,
        userId: tx.user_id,
        picks: tx.picks || [],
        mode: tx.mode
      });

      // Send confirmation email
      if (tx.email) {
        try {
          await fetch(`${SITE_URL}/api/send-pick-confirmation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-key': process.env.INTERNAL_API_KEY!
            },
            body: JSON.stringify({
              to: tx.email,
              name: tx.full_name || 'Player',
              amount: tx.wager_amount,
              mode: tx.mode,
              picks: tx.picks,
              orderId: customId
            })
          });
          console.log('📧 PayPal confirmation email sent');
        } catch (emailErr) {
          console.error('Email send failed:', emailErr);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ PayPal webhook processed successfully in ${duration}ms`);
      
      return NextResponse.json({ 
        ok: true, 
        processed: true,
        orderId: customId,
        duration_ms: duration
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`🔥 PayPal webhook error after ${duration}ms:`, error);
      return new NextResponse('Internal error', { status: 500 });
    }
  }

  // Ignore other event types
  console.log(`ℹ️ PayPal event ${event.event_type} ignored`);
  return NextResponse.json({ ok: true, ignored: true });
}