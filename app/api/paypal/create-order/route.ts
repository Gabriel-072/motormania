// 📁 app/api/paypal/create-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
const PAYPAL_BASE_URL = 'https://api-m.paypal.com'; // Use sandbox: https://api-m.sandbox.paypal.com

// Get PayPal access token
async function getPayPalAccessToken() {
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const { picks, mode = 'full', amount, gpName, fullName, email } = body;

    // Validation
    if (!Array.isArray(picks) || picks.length < 2 || picks.length > 8) {
      return NextResponse.json({ error: 'Invalid picks count' }, { status: 400 });
    }
    if (amount < 20000) {
      return NextResponse.json({ error: 'Minimum amount $20,000 COP' }, { status: 400 });
    }

    // Calculate multiplier and potential win
    const payoutCombos: Record<number, number> = { 2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100 };
    const multiplier = payoutCombos[picks.length] || 0;
    const potentialWin = multiplier * amount;

    // Generate order ID
    const orderId = `PP-${userId}-${Date.now()}`;

    // Convert COP to USD (PayPal requires USD for international)
    const amountUSD = (amount / 4000).toFixed(2); // Rough conversion, use your exchange rate service

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal order
    const paypalOrder = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId,
          amount: {
            currency_code: 'USD',
            value: amountUSD,
          },
          description: `MMC GO (${picks.length} picks) - ${mode === 'full' ? 'Full Throttle' : 'Safety Car'}`,
        }],
        application_context: {
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?paypal_order_id=${orderId}`,
          cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/mmc-go`,
        },
      }),
    });

    const paypalData = await paypalOrder.json();

    if (!paypalOrder.ok) {
      throw new Error(`PayPal order creation failed: ${paypalData.message}`);
    }

    // Save pending transaction in database
    const { error: dbErr } = await sb.from('pick_transactions').insert({
      user_id: userId,
      full_name: fullName ?? 'Player MMC',
      email: email,
      order_id: orderId,
      gp_name: gpName,
      picks,
      mode,
      multiplier,
      potential_win: potentialWin,
      wager_amount: amount,
      payment_status: 'pending',
      paypal_order_id: paypalData.id,
    });

    if (dbErr) throw dbErr;

    return NextResponse.json({
      orderID: paypalData.id,
      orderId: orderId,
    });

  } catch (err: any) {
    console.error('PayPal create order error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}