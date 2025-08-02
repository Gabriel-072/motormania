// app/api/crypto-payment/route.ts - Updated for Anonymous Users
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    /* 🆕 Auth is now optional */
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (error) {
      console.log('No authentication found, proceeding as anonymous crypto payment');
    }

    const { 
      amount, 
      picks, 
      mode, 
      userEmail, 
      userName, 
      orderId,
      anonymousSessionId // 🆕 For anonymous users
    } = await request.json();

    /* 🆕 Validation for anonymous users */
    if (!userId) {
      if (!userEmail || !userName) {
        return NextResponse.json({ 
          error: 'Email y nombre son requeridos para usuarios anónimos' 
        }, { status: 400 });
      }
      if (!anonymousSessionId) {
        return NextResponse.json({ 
          error: 'Session ID requerido para usuarios anónimos' 
        }, { status: 400 });
      }
    }

    /* Calculate multipliers */
    const payoutCombos: Record<number, number> = { 2:3, 3:6, 4:10, 5:20, 6:35, 7:60, 8:100 };
    const multiplier = payoutCombos[picks.length] || 0;
    const potentialWin = multiplier * amount;

    /* 🆕 Save pending crypto transaction */
    const transactionData = {
      user_id: userId, // Can be null for anonymous users
      anonymous_session_id: anonymousSessionId || null,
      full_name: userName,
      email: userEmail,
      order_id: orderId,
      gp_name: picks[0]?.gp_name || 'Hungarian Grand Prix',
      picks,
      mode,
      multiplier,
      potential_win: potentialWin,
      wager_amount: amount,
      payment_status: 'pending'
    };

    const { error: dbErr } = await sb.from('pick_transactions').insert(transactionData);
    
    if (dbErr) {
      console.error('Database error saving crypto transaction:', dbErr);
      throw new Error('Error guardando transacción crypto');
    }

    /* Create Coinbase Commerce charge */
    const response = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': process.env.COINBASE_COMMERCE_API_KEY!,
        'X-CC-Version': '2018-03-22'
      },
      body: JSON.stringify({
        name: `MMC GO - ${picks.length} picks`,
        description: `${mode === 'full' ? 'Full Throttle' : 'Safety Car'} (${picks.length} selections)`,
        local_price: {
          amount: (amount / 4000).toFixed(2), // Convert COP to USD
          currency: 'USD'
        },
        pricing_type: 'fixed_price',
        metadata: {
          orderId,
          picks: JSON.stringify(picks),
          mode,
          userEmail,
          userName,
          originalAmountCOP: amount,
          platform: 'mmc-go',
          userId: userId || 'anonymous',
          anonymousSessionId: anonymousSessionId || null
        },
        redirect_url: userId 
          ? `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?crypto=true`
          : `${process.env.NEXT_PUBLIC_BASE_URL}/sign-up?session=${anonymousSessionId}&order=${orderId}&redirect_url=/payment-success?crypto=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/mmc-go`
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Coinbase API error:', errorData);
      throw new Error('Failed to create crypto payment');
    }

    const charge = await response.json();
    
    return NextResponse.json({
      chargeId: charge.data.id,
      checkoutUrl: charge.data.hosted_url,
      addresses: charge.data.addresses,
      success: true,
      isAnonymous: !userId,
      sessionId: anonymousSessionId
    });

  } catch (error) {
    console.error('Crypto payment creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create crypto payment', success: false }, 
      { status: 500 }
    );
  }
}