// app/api/complete-anonymous-order/route.ts - Fixed to properly update picks table
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
    console.log('🔗 Starting complete-anonymous-order API...');

    /* 1. Authenticate user */
    const { userId } = await auth();
    if (!userId) {
      console.error('❌ No authenticated user found');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('✅ Authenticated user:', userId);

    /* 2. Get session ID from request */
    const { sessionId } = await req.json();
    if (!sessionId) {
      console.error('❌ No session ID provided');
      return NextResponse.json({ 
        error: 'Session ID required' 
      }, { status: 400 });
    }

    console.log('🔍 Looking for transactions with session:', sessionId);

    /* 3. Find paid anonymous transactions for this session */
    const { data: transactions, error: fetchError } = await sb
      .from('pick_transactions')
      .select('*')
      .eq('anonymous_session_id', sessionId)
      .eq('payment_status', 'paid')
      .is('user_id', null);

    if (fetchError) {
      console.error('❌ Error fetching anonymous transactions:', fetchError);
      throw new Error('Error buscando transacciones anónimas');
    }

    console.log(`📊 Found ${transactions?.length || 0} transactions to link`);

    if (!transactions || transactions.length === 0) {
      console.log('ℹ️ No paid anonymous transactions found for session:', sessionId);
      return NextResponse.json({ 
        message: 'No paid transactions found',
        linked: 0 
      });
    }

    /* 4. Get UTM data for this user (if available) */
    const { data: utmData } = await sb
      .from('traffic_sources')
      .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('📈 UTM data found:', utmData ? 'yes' : 'no');

    /* 5. Process each transaction */
    let linkedCount = 0;
    const processedOrders: any[] = [];

    for (const tx of transactions) {
      try {
        console.log(`🔄 Processing transaction ${tx.id} - ${tx.order_id}`);

        /* Update transaction with user_id */
        const { error: updateError } = await sb
          .from('pick_transactions')
          .update({ 
            user_id: userId, 
            user_registered_at: new Date().toISOString()
          })
          .eq('id', tx.id);

        if (updateError) {
          console.error(`❌ Error updating transaction ${tx.id}:`, updateError);
          continue;
        }

        console.log(`✅ Updated transaction ${tx.id} with user_id`);

        /* Move to picks table */
        const pickData = {
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
          name: tx.full_name,
          utm_source: utmData?.utm_source,
          utm_medium: utmData?.utm_medium,
          utm_campaign: utmData?.utm_campaign,
          utm_term: utmData?.utm_term,
          utm_content: utmData?.utm_content,
          referrer: utmData?.referrer,
          payment_method: tx.bold_payment_id ? 'bold' : (tx.crypto_payment_id ? 'crypto' : 'unknown')
        };

        console.log('💾 Inserting pick data:', {
          user_id: pickData.user_id,
          order_id: pickData.order_id,
          picks_count: pickData.picks?.length || 0,
          wager_amount: pickData.wager_amount
        });

        const { error: insertError } = await sb
          .from('picks')
          .insert(pickData);

        if (insertError) {
          console.error(`❌ Error inserting pick ${tx.id}:`, insertError);
          console.error('Pick data that failed:', pickData);
          continue;
        }

        console.log(`✅ Successfully inserted pick for transaction ${tx.id}`);

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
          amount: Number(tx.wager_amount || 0),
          mode: tx.mode,
          picks: (tx.picks as any[])?.length || 0
        });

        console.log(`🎉 Successfully linked order ${tx.order_id} to user ${userId}`);

      } catch (error) {
        console.error(`❌ Error processing transaction ${tx.id}:`, error);
      }
    }

    /* 6. Final response */
    console.log(`🏁 Process complete. Linked ${linkedCount} orders to user ${userId}`);

    return NextResponse.json({
      success: true,
      linked: linkedCount,
      orders: processedOrders,
      message: `Successfully linked ${linkedCount} paid orders to your account`
    });

  } catch (error) {
    console.error('❌ Complete anonymous order error:', error);
    return NextResponse.json({ 
      error: 'Failed to complete anonymous order linking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}