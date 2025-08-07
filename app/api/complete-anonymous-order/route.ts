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

    // 🔥 UPDATED: Find paid pick_transactions for this session
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

        // 🔥 UPDATED: Check if this transaction needs promotional processing
        let promoApplicationId = null;
        if (tx.promotion_applied) {
          try {
            // Apply promotional bonus using RPC function
            const { data: bonusResult, error: bonusError } = await supabase.rpc('apply_picks_promotion', {
              p_user_id: userId,
              p_transaction_id: tx.order_id,
              p_original_amount: tx.wager_amount
            });

            if (!bonusError && bonusResult && bonusResult.length > 0) {
              const result = bonusResult[0];
              if (result.success) {
                console.log(`🎁 Promotional bonus applied: ${result.campaign_name}`);
                
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
              }
            }
          } catch (promoError) {
            console.warn('⚠️ Promotional processing failed, continuing without bonus:', promoError);
          }
        }

        // 🔥 UPDATED: Create pick record with promotional data
        const pickData = {
          user_id: userId,
          gp_name: tx.gp_name || 'Current GP',
          session_type: 'combined',
          picks: tx.picks || [],
          multiplier: Number(tx.multiplier || 0),
          
          // 🔥 UPDATED: Use promotional amounts if available
          wager_amount: tx.promotion_total_effective || tx.wager_amount,
          original_wager_amount: tx.wager_amount, // Store original payment amount
          potential_win: tx.potential_win || 0,
          mode: tx.mode || 'full',
          
          // 🔥 NEW: Promotional reference
          promo_application_id: promoApplicationId,
          
          // Additional metadata
          order_id: tx.order_id,
          created_at: new Date().toISOString()
        };

        console.log('💾 Inserting pick data:', {
          user_id: pickData.user_id,
          order_id: pickData.order_id,
          picks_count: pickData.picks?.length || 0,
          wager_amount: pickData.wager_amount,
          promotional_bonus: !!promoApplicationId
        });

        const { error: insertError } = await supabase
          .from('picks')
          .insert(pickData);

        if (insertError) {
          console.error(`❌ Error inserting pick ${tx.id}:`, insertError);
          continue;
        }

        console.log(`✅ Successfully inserted pick for transaction ${tx.id}`);

        // 🔥 UPDATED: Update promo application status if applied
        if (promoApplicationId) {
          await supabase
            .from('user_promo_applications')
            .update({ 
              status: 'used',
              used_at: new Date().toISOString()
            })
            .eq('id', promoApplicationId);
        }

        // Track completion
        await trackCompleteRegistration({
          orderId: tx.order_id,
          amount: Number(tx.wager_amount || 0),
          email: tx.email || '',
          userId: userId,
          picks: tx.picks || [],
          mode: tx.mode || 'full'
        });

        linkedCount++;
        processedOrders.push({
          orderId: tx.order_id,
          amount: Number(tx.wager_amount || 0),
          mode: tx.mode || 'full',
          picks: (tx.picks as any[])?.length || 0,
          promotionApplied: !!promoApplicationId
        });

        console.log(`🎉 Successfully linked order ${tx.order_id} to user ${userId}`);

      } catch (error) {
        console.error(`❌ Error processing transaction ${tx.id}:`, error);
        continue; // Continue with next transaction
      }
    }

    // 🔥 UPDATED: Clean up processed transactions
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
      message: `Successfully linked ${linkedCount} paid order${linkedCount === 1 ? '' : 's'} to your account`
    });

  } catch (error) {
    console.error('❌ Complete anonymous order error:', error);
    return NextResponse.json({ 
      error: 'Failed to complete anonymous order linking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}