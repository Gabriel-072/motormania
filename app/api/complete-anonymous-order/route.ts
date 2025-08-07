// app/api/complete-anonymous-order/route.ts - Updated for Promotional System
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Track completion for analytics
async function trackCompleteRegistration(data: {
  orderId: string;
  amount: number;
  email: string;
  userId: string;
  picks: any[];
  mode: string;
}) {
  try {
    console.log('📊 Tracking CompleteRegistration for:', data.orderId);
    
    // You can add Facebook Pixel or other tracking here
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'CompleteRegistration', {
        content_name: 'Anonymous Order Completion',
        value: data.amount / 1000,
        currency: 'COP',
        content_ids: [data.orderId],
        num_items: data.picks.length
      });
    }
  } catch (error) {
    console.warn('Analytics tracking failed:', error);
  }
}

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

        // 🔥 UPDATED: Handle promotional application for anonymous users
        let promoApplicationId = null;
        let effectiveAmount = tx.wager_amount;

        // Check if promotion was requested during payment
        if (tx.promotion_applied) {
          try {
            console.log(`🎁 Applying promotional bonus for anonymous order: ${tx.order_id}`);
            
            // Apply promotional bonus using RPC function
            const { data: bonusResult, error: bonusError } = await supabase.rpc('apply_picks_promotion', {
              p_user_id: userId, // Now we have the real user ID
              p_transaction_id: tx.order_id,
              p_original_amount: tx.wager_amount
            });

            if (!bonusError && bonusResult && bonusResult.length > 0) {
              const result = bonusResult[0];
              if (result.success) {
                effectiveAmount = result.total_effective_amount;
                
                // Get the promo application ID for reference
                const { data: promoApp } = await supabase
                  .from('user_promo_applications')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('transaction_id', tx.order_id)
                  .single();
                
                if (promoApp) {
                  promoApplicationId = promoApp.id;
                }
                
                console.log(`✅ Promotional bonus applied successfully:`, {
                  campaignName: result.campaign_name,
                  bonusAmount: result.bonus_amount,
                  effectiveAmount: effectiveAmount
                });
              } else {
                console.warn(`❌ Promotion application failed: ${result.error_message}`);
              }
            } else {
              console.warn(`❌ Promotion RPC failed:`, bonusError);
            }
          } catch (promoError) {
            console.error('❌ Error applying promotion:', promoError);
            // Continue without promotion - don't fail the entire process
          }
        }

        // Get UTM data if available
        let utmData = null;
        const { data: recentTraffic } = await supabase
          .from('traffic_sources')
          .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentTraffic) {
          utmData = recentTraffic;
        }

        // 🔥 UPDATED: Move to picks table with promotional data
        const pickData = {
          user_id: userId,
          gp_name: tx.gp_name,
          session_type: 'combined',
          picks: tx.picks ?? [],
          multiplier: Number(tx.multiplier ?? 0),
          potential_win: tx.potential_win ?? 0,
          mode: tx.mode ?? 'full',
          
          // 🔥 IMPORTANT: Use effective amount (includes bonus)
          wager_amount: effectiveAmount,
          
          // 🔥 NEW: Store promotional reference
          promo_application_id: promoApplicationId,
          
          // UTM attribution
          utm_source: utmData?.utm_source,
          utm_medium: utmData?.utm_medium,
          utm_campaign: utmData?.utm_campaign,
          utm_term: utmData?.utm_term,
          utm_content: utmData?.utm_content,
          referrer: utmData?.referrer
        };

        // Insert into picks table
        const { error: pickError } = await supabase
          .from('picks')
          .insert(pickData);

        if (pickError) {
          console.error(`❌ Error inserting pick for ${tx.order_id}:`, pickError);
          continue;
        }

        // 🔥 UPDATED: Update promo status if applied
        if (promoApplicationId) {
          await supabase
            .from('user_promo_applications')
            .update({ 
              status: 'used',
              used_at: new Date().toISOString()
            })
            .eq('id', promoApplicationId);
        }

        linkedCount++;
        processedOrders.push({
          orderId: tx.order_id,
          amount: tx.wager_amount,
          effectiveAmount: effectiveAmount, // Include effective amount
          mode: tx.mode || 'full',
          picks: (tx.picks || []).length,
          promotionApplied: !!promoApplicationId,
          campaignName: tx.promotion_campaign_name
        });

        console.log(`🎉 Successfully linked order ${tx.order_id} to user ${userId}`);

      } catch (error) {
        console.error(`❌ Error processing transaction ${tx.id}:`, error);
        continue; // Continue with next transaction
      }
    }

    // Clean up processed transactions
    if (linkedCount > 0) {
      const processedIds = processedOrders.map(o => o.orderId);
      const { error: deleteError } = await supabase
        .from('pick_transactions')
        .delete()
        .in('order_id', processedIds);

      if (deleteError) {
        console.warn('⚠️ Warning: Could not clean up processed transactions:', deleteError);
      } else {
        console.log(`🧹 Cleaned up ${linkedCount} processed transactions`);
      }
    }

    console.log(`🏁 Process complete. Linked ${linkedCount} orders to user ${userId}`);

    return NextResponse.json({
      success: true,
      linked: linkedCount,
      orders: processedOrders,
      message: `Successfully linked ${linkedCount} paid order${linkedCount === 1 ? '' : 's'} to your account`,
      // 🔥 NEW: Include promotional summary
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