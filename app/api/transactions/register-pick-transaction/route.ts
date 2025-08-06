// app/api/transactions/register-pick-transaction/route.ts - Fixed & More Robust
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ENV + Supabase
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BOLD_SECRET = process.env.BOLD_SECRET_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const CURRENCY = 'COP';

// Multiplier tables
const payoutCombos: Record<number, number> = { 2:3, 3:6, 4:10, 5:20, 6:35, 7:60, 8:100 };
const safetyPayouts: Record<number, number[]> = { 3:[2], 4:[5], 5:[10], 6:[20], 7:[30], 8:[50] };

function calcMultiplier(cnt: number, mode: 'full' | 'safety') {
  return mode === 'full' ? (payoutCombos[cnt] ?? 0) : (safetyPayouts[cnt]?.[0] ?? 0);
}

export async function POST(req: NextRequest) {
  console.log('🚀 register-pick-transaction API called');
  
  try {
    /* Auth - optional */
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult.userId;
      console.log('👤 User ID:', userId || 'anonymous');
    } catch (error) {
      console.log('No authentication found, proceeding as anonymous');
    }

    /* Parse body */
    const body = await req.json();
    console.log('📥 Request body:', JSON.stringify(body, null, 2));
    
    const { 
      picks, 
      mode = 'full', 
      amount, 
      gpName, 
      fullName, 
      email, 
      anonymousSessionId,
      // NEW promotional system
      applyPromotion = false,
      // OLD system compatibility
      bonusAmount: oldBonusAmount,
      effectiveWager: oldEffectiveWager
    } = body;

    /* Basic validation */
    if (!Array.isArray(picks) || picks.length < 2 || picks.length > 8) {
      console.error('❌ Invalid picks count:', picks?.length);
      return NextResponse.json({ error: 'Nº de picks inválido' }, { status: 400 });
    }
    if (!amount || amount < 10000) {
      console.error('❌ Invalid amount:', amount);
      return NextResponse.json({ error: 'Monto mínimo $10.000' }, { status: 400 });
    }
    if (mode === 'safety' && picks.length < 3) {
      console.error('❌ Safety mode needs 3+ picks');
      return NextResponse.json({ error: 'Safety requiere ≥3 picks' }, { status: 400 });
    }
    if (!gpName) {
      console.error('❌ Missing gpName');
      return NextResponse.json({ error: 'GP name required' }, { status: 400 });
    }

    /* Anonymous user validation */
    if (!userId) {
      if (!email || !fullName) {
        console.error('❌ Anonymous user missing email/name');
        return NextResponse.json({ 
          error: 'Email y nombre son requeridos para usuarios anónimos' 
        }, { status: 400 });
      }
      if (!email.includes('@')) {
        console.error('❌ Invalid email:', email);
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
      }
      if (!anonymousSessionId) {
        console.error('❌ Missing anonymous session ID');
        return NextResponse.json({ 
          error: 'Session ID requerido para usuarios anónimos' 
        }, { status: 400 });
      }
    }

    console.log('✅ Validation passed');

    /* Clean up existing pending transactions */
    try {
      if (userId) {
        const { error: cleanupError } = await sb.from('pick_transactions')
          .delete()
          .eq('user_id', userId)
          .eq('payment_status', 'pending');
        if (cleanupError) console.warn('Cleanup error for user:', cleanupError);
      } else {
        const { error: cleanupError } = await sb.from('pick_transactions')
          .delete()
          .eq('anonymous_session_id', anonymousSessionId)
          .eq('payment_status', 'pending');
        if (cleanupError) console.warn('Cleanup error for anonymous:', cleanupError);
      }
      console.log('✅ Cleanup completed');
    } catch (cleanupErr) {
      console.warn('Cleanup failed:', cleanupErr);
    }

    /* Promotional bonus calculation */
    let promotionDetails = null;
    let totalEffectiveAmount = amount;
    let bonusAmount = 0;

    // Check if we're using OLD system compatibility
    if (oldBonusAmount !== undefined && oldEffectiveWager !== undefined) {
      console.log('🔄 Using OLD promotional system compatibility');
      bonusAmount = oldBonusAmount;
      totalEffectiveAmount = oldEffectiveWager;
    } 
    // Or NEW promotional system
    else if (applyPromotion && userId) {
      console.log('🎁 Attempting to apply NEW promotional system');
      try {
        const { data: promoData, error: promoError } = await sb.rpc('get_active_picks_promotion', {
          p_user_id: userId,
          p_bet_amount: amount
        });

        if (!promoError && promoData && promoData.length > 0) {
          const promo = promoData[0];
          bonusAmount = promo.calculated_bonus_amount || 0;
          totalEffectiveAmount = promo.total_effective_amount || amount;
          
          promotionDetails = {
            campaignId: promo.campaign_id,
            campaignName: promo.campaign_name,
            bonusPercentage: promo.bonus_percentage,
            bonusAmount,
            totalEffectiveAmount,
            userRemainingUses: promo.user_remaining_uses
          };
          
          console.log('✅ Promotion applied:', promotionDetails);
        } else {
          console.log('ℹ️ No active promotion found:', promoError);
        }
      } catch (error) {
        console.warn('⚠️ Promotion system error (continuing without):', error);
      }
    }

    /* Calculate multiplier and potential win */
    const multiplier = calcMultiplier(picks.length, mode);
    const potentialWin = multiplier * totalEffectiveAmount;
    
    console.log('💰 Calculations:', {
      originalAmount: amount,
      bonusAmount,
      totalEffectiveAmount,
      multiplier,
      potentialWin
    });
    
    /* Generate order ID */
    const orderId = userId 
      ? `MMC-${userId}-${Date.now()}`
      : `MMC-ANON-${Date.now()}`;
    
    const amountStr = String(amount); // Payment amount (original)

    /* Bold signature */
    const integrityKey = crypto
      .createHash('sha256')
      .update(`${orderId}${amountStr}${CURRENCY}${BOLD_SECRET}`)
      .digest('hex');

    const callbackUrl = userId 
      ? `${SITE_URL}/dashboard?bold_order_id=${orderId}`
      : `${SITE_URL}/sign-up?session=${anonymousSessionId}&order=${orderId}&redirect_url=/payment-success`;

    /* Prepare transaction data */
    const transactionData = {
      // Core fields
      user_id: userId,
      anonymous_session_id: anonymousSessionId || null,
      full_name: fullName ?? 'Jugador MMC',
      email: email,
      order_id: orderId,
      gp_name: gpName,
      picks: JSON.stringify(picks), // Ensure it's stringified
      mode,
      multiplier,
      wager_amount: amount,
      potential_win: potentialWin,
      payment_status: 'pending',
      created_at: new Date().toISOString(),
      
      // Promotional fields (nullable, safe to add)
      promotion_applied: bonusAmount > 0 ? true : null,
      promotion_bonus_amount: bonusAmount > 0 ? bonusAmount : null,
      promotion_total_effective: totalEffectiveAmount !== amount ? totalEffectiveAmount : null,
      promotion_campaign_name: promotionDetails?.campaignName || null
    };

    console.log('💾 Saving transaction data:', JSON.stringify(transactionData, null, 2));

    /* Save to database */
    const { data: insertedData, error: dbErr } = await sb
      .from('pick_transactions')
      .insert(transactionData)
      .select()
      .single();
    
    if (dbErr) {
      console.error('❌ Database error:', dbErr);
      
      // Check if it's a table/column issue
      if (dbErr.message?.includes('relation') || dbErr.message?.includes('column')) {
        return NextResponse.json({ 
          error: 'Database schema issue. Please run migration first.',
          details: dbErr.message
        }, { status: 500 });
      }
      
      throw new Error(`Database error: ${dbErr.message}`);
    }

    console.log('✅ Transaction saved:', insertedData);

    /* Response */
    const response = {
      orderId,
      amount: amountStr,
      callbackUrl,
      integrityKey,
      isAnonymous: !userId,
      sessionId: anonymousSessionId,
      promotion: promotionDetails ? {
        applied: true,
        campaignName: promotionDetails.campaignName,
        bonusAmount: promotionDetails.bonusAmount,
        totalEffectiveAmount: promotionDetails.totalEffectiveAmount,
        originalAmount: amount
      } : {
        applied: false,
        bonusAmount: 0,
        totalEffectiveAmount: amount,
        originalAmount: amount
      }
    };

    console.log('✅ API Success:', response);
    return NextResponse.json(response);

  } catch (err: any) {
    console.error('❌ API Error:', err);
    console.error('Stack trace:', err.stack);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}