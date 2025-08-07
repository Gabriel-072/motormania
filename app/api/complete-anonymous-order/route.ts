// app/api/complete-anonymous-order/route.ts - Fixed Version
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    console.log('🔗 Starting anonymous order completion process');

    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get session ID from request
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    console.log(`🔍 Looking for paid transactions for session: ${sessionId}`);

    // Find paid pick_transactions for this session
    const { data: transactions, error: fetchError } = await supabase
      .from('pick_transactions')
      .select('*')
      .eq('anonymous_session_id', sessionId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching transactions:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      console.log('❌ No paid transactions found for session');
      return NextResponse.json({ 
        success: true, 
        linked: 0, 
        message: 'No paid orders found to link' 
      });
    }

    console.log(`📋 Found ${transactions.length} paid transaction(s) to process`);

    let linkedCount = 0;
    const processedOrders = [];

    // Process each transaction
    for (const tx of transactions) {
      try {
        console.log(`🔄 Processing transaction: ${tx.order_id}`);

        // Handle promotional application if it was requested
        let promoApplicationId = null;
        let effectiveAmount = tx.wager_amount;

        // Check if promotion was applied during payment
        if (tx.promotion_applied) {
          try {
            console.log(`🎁 Applying promotional bonus for order: ${tx.order_id}`);
            
            // Apply promotional bonus using RPC function
            const { data: bonusResult, error: bonusError } = await supabase.rpc('apply_picks_promotion', {
              p_user_id: userId,
              p_transaction_id: tx.order_id,
              p_original_amount: tx.wager_amount
            });

            if (!bonusError && bonusResult && bonusResult.length > 0) {
              const result = bonusResult[0];
              if (result.success) {
                effectiveAmount = result.total_effective_amount;
                
                // Get the promo application ID
                const { data: promoApp } = await supabase
                  .from('user_promo_applications')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('transaction_id', tx.order_id)
                  .single();
                
                if (promoApp) {
                  promoApplicationId = promoApp.id;
                }
                
                console.log(`✅ Promotional bonus applied:`, {
                  campaignName: result.campaign_name,
                  bonusAmount: result.bonus_amount,
                  effectiveAmount: effectiveAmount
                });
              }
            }
          } catch (promoError) {
            console.error('❌ Error applying promotion:', promoError);
            // Continue without promotion
          }
        }

        // Get UTM data if available
        const { data: recentTraffic } = await supabase
          .from('traffic_sources')
          .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // 🔥 FIX: Insert the data into picks table
        const pickData = {
          user_id: userId, // Now we have the authenticated user ID
          gp_name: tx.gp_name,
          session_type: 'combined',
          picks: Array.isArray(tx.picks) ? tx.picks : [],
          multiplier: Number(tx.multiplier ?? 0),
          potential_win: tx.potential_win ?? 0,
          mode: tx.mode ?? 'full',
          wager_amount: effectiveAmount,
          order_id: tx.order_id,
          pick_transaction_id: tx.id,
          payment_method: 'bold',
          ...(promoApplicationId && { promo_application_id: promoApplicationId }),
          ...(recentTraffic && {
            utm_source: recentTraffic.utm_source,
            utm_medium: recentTraffic.utm_medium,
            utm_campaign: recentTraffic.utm_campaign,
            utm_term: recentTraffic.utm_term,
            utm_content: recentTraffic.utm_content,
            referrer: recentTraffic.referrer
          })
        };

        // Insert into picks table
        const { error: insertError } = await supabase
          .from('picks')
          .insert(pickData);

        if (insertError) {
          console.error(`❌ Failed to insert pick for order ${tx.order_id}:`, insertError);
          throw insertError;
        }

        // Update promo application status if used
        if (promoApplicationId) {
          await supabase
            .from('user_promo_applications')
            .update({ 
              status: 'used',
              used_at: new Date().toISOString()
            })
            .eq('id', promoApplicationId);
        }

        // Delete the transaction from pick_transactions table
        await supabase
          .from('pick_transactions')
          .delete()
          .eq('id', tx.id);

        console.log(`✅ Successfully moved transaction ${tx.order_id} to picks table`);

        linkedCount++;
        processedOrders.push({
          orderId: tx.order_id,
          amount: tx.wager_amount,
          effectiveAmount: effectiveAmount,
          mode: tx.mode,
          picks: tx.picks?.length || 0,
          promotionApplied: tx.promotion_applied || false
        });

        // Track analytics
        console.log('📊 Tracking CompleteRegistration for:', tx.order_id);

      } catch (txError) {
        console.error(`❌ Error processing transaction ${tx.order_id}:`, txError);
        // Continue with other transactions
      }
    }

    console.log(`✅ Successfully linked ${linkedCount} orders to user ${userId}`);

    return NextResponse.json({
      success: true,
      linked: linkedCount,
      orders: processedOrders,
      message: `Successfully linked ${linkedCount} paid order${linkedCount === 1 ? '' : 's'} to your account`,
      promotionalSummary: {
        ordersWithPromotion: processedOrders.filter(o => o.promotionApplied).length,
        totalBonusApplied: processedOrders.reduce((sum, o) => 
          o.promotionApplied ? sum + (o.effectiveAmount - o.amount) : sum, 0
        )
      }
    });

  } catch (error) {
    console.error('❌ Complete anonymous order error:', error);
    return NextResponse.json({ 
      error: 'Failed to complete anonymous order linking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}