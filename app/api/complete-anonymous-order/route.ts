// app/api/complete-anonymous-order/route.ts - Link Anonymous Orders to Registered Users
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const INTERNAL_KEY = process.env.INTERNAL_API_KEY!;

/* ───────────── FACEBOOK TRACKING FOR COMPLETED REGISTRATION ─────────────── */
async function trackCompleteRegistration(orderData: {
  orderId: string;
  amount: number;
  email: string;
  userId: string;
  picks: any[];
  mode: string;
}) {
  const eventId = `complete_registration_${orderData.orderId}_${Date.now()}`;
  
  try {
    const hashedEmail = crypto.createHash('sha256')
      .update(orderData.email.toLowerCase().trim())
      .digest('hex');
    
    await fetch(`${SITE_URL}/api/fb-track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': INTERNAL_KEY
      },
      body: JSON.stringify({
        event_name: 'CompleteRegistration',
        event_id: eventId,
        event_source_url: `${SITE_URL}/sign-up`,
        user_data: {
          em: hashedEmail,
          external_id: orderData.userId,
        },
        custom_data: {
          content_name: `Post-Payment Registration - ${orderData.mode}`,
          content_category: 'user_registration',
          value: orderData.amount / 1000,
          currency: 'COP',
          num_items: orderData.picks.length
        },
      }),
    });

    console.log(`✅ CompleteRegistration event tracked: ${orderData.orderId}`);
  } catch (error) {
    console.error(`❌ Failed to track CompleteRegistration event:`, error);
  }
}

export async function POST(req: NextRequest) {
  try {
    /* 1. Authenticate user */
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    /* 2. Get session ID from request */
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ 
        error: 'Session ID required' 
      }, { status: 400 });
    }

    console.log(`🔗 Linking anonymous orders for session ${sessionId} to user ${userId}`);

    /* 3. Find paid anonymous transactions for this session */
    const { data: transactions, error: fetchError } = await sb
      .from('pick_transactions')
      .select('*')
      .eq('anonymous_session_id', sessionId)
      .eq('payment_status', 'paid')
      .is('user_id', null);

    if (fetchError) {
      console.error('Error fetching anonymous transactions:', fetchError);
      throw new Error('Error buscando transacciones anónimas');
    }

    if (!transactions || transactions.length === 0) {
      console.log('No paid anonymous transactions found for session:', sessionId);
      return NextResponse.json({ 
        message: 'No paid transactions found',
        linked: 0 
      });
    }

    console.log(`Found ${transactions.length} paid anonymous transactions to link`);

    /* 4. Get UTM data for this user (if available) */
    const { data: utmData } = await sb
      .from('traffic_sources')
      .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    /* 5. Process each transaction */
    let linkedCount = 0;
    const processedOrders = [];

    for (const tx of transactions) {
      try {
        /* Update transaction with user_id */
        const { error: updateError } = await sb
          .from('pick_transactions')
          .update({ 
            user_id: userId, 
            user_registered_at: new Date().toISOString()
          })
          .eq('id', tx.id);

        if (updateError) {
          console.error(`Error updating transaction ${tx.id}:`, updateError);
          continue;
        }

        /* Move to picks table */
        const { error: insertError } = await sb
          .from('picks')
          .insert({
            user_id: userId,
            gp_name: tx.gp_name,
            session_type: 'combined',
            picks: tx.picks || [],
            multiplier: Number(tx.multiplier || 0),
            wager_amount: Number(tx.wager_amount || 0),
            potential_win: Number(tx.potential_win || 0),
            mode: tx.mode,
            order_id: tx.order_id,
            pick_transaction_id: tx.id,
            utm_source: utmData?.utm_source,
            utm_medium: utmData?.utm_medium,
            utm_campaign: utmData?.utm_campaign,
            utm_term: utmData?.utm_term,
            utm_content: utmData?.utm_content,
            referrer: utmData?.referrer,
            payment_method: tx.bold_payment_id ? 'bold' : 'crypto'
          });

        if (insertError) {
          console.error(`Error inserting pick ${tx.id}:`, insertError);
          continue;
        }

        /* Track registration completion */
        await trackCompleteRegistration({
          orderId: tx.order_id,
          amount: Number(tx.wager_amount || 0),
          email: tx.email,
          userId: userId,
          picks: tx.picks || [],
          mode: tx.mode || 'full'
        });

        linkedCount++;
        processedOrders.push({
          orderId: tx.order_id,
          amount: tx.wager_amount,
          mode: tx.mode,
          picks: tx.picks?.length || 0
        });

        console.log(`✅ Linked order ${tx.order_id} to user ${userId}`);

      } catch (error) {
        console.error(`Error processing transaction ${tx.id}:`, error);
      }
    }

    /* 6. Clean up localStorage flag (client-side will handle this) */
    console.log(`🎉 Successfully linked ${linkedCount} orders to user ${userId}`);

    return NextResponse.json({
      success: true,
      linked: linkedCount,
      orders: processedOrders,
      message: `Successfully linked ${linkedCount} paid orders to your account`
    });

  } catch (error) {
    console.error('Complete anonymous order error:', error);
    return NextResponse.json({ 
      error: 'Failed to complete anonymous order linking' 
    }, { status: 500 });
  }
}