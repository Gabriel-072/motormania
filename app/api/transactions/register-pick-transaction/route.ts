// app/api/transactions/register-pick-transaction/route.ts - FINAL with Promotions
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

// Multiplier tables (unchanged)
const payoutCombos: Record<number, number> = { 2:3, 3:6, 4:10, 5:20, 6:35, 7:60, 8:100 };
const safetyPayouts: Record<number, number[]> = { 3:[2], 4:[5], 5:[10], 6:[20], 7:[30], 8:[50] };

function calcMultiplier(cnt: number, mode: 'full' | 'safety') {
  return mode === 'full' ? (payoutCombos[cnt] ?? 0) : (safetyPayouts[cnt]?.[0] ?? 0);
}

export async function POST(req: NextRequest) {
  try {
    /* Auth (optional for anonymous users) */
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (error) {
      console.log('No authentication found, proceeding as anonymous');
    }

    /* Body validation */
    interface Body {
      picks: any[];
      mode: 'full' | 'safety';
      amount: number;
      gpName: string;
      fullName?: string;
      email?: string;
      anonymousSessionId?: string;
      // 🔥 NEW: Promotional system
      applyPromotion?: boolean;
    }
    
    const body: Body = await req.json();
    const { 
      picks, 
      mode = 'full', 
      amount, 
      gpName, 
      fullName, 
      email, 
      anonymousSessionId,
      applyPromotion = true
    } = body;

    /* Existing validation (unchanged) */
    if (!Array.isArray(picks) || picks.length < 2 || picks.length > 8) {
      return NextResponse.json({ error: 'Nº de picks inválido' }, { status: 400 });
    }
    if (amount < 10000) {
      return NextResponse.json({ error: 'Monto mínimo $10.000' }, { status: 400 });
    }
    if (mode === 'safety' && picks.length < 3) {
      return NextResponse.json({ error: 'Safety requiere ≥3 picks' }, { status: 400 });
    }

    /* Anonymous user validation */
    if (!userId) {
      if (!email || !fullName) {
        return NextResponse.json({ 
          error: 'Email y nombre son requeridos para usuarios anónimos' 
        }, { status: 400 });
      }
      if (!email.includes('@')) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
      }
    }

    /* Clean up existing pending transactions */
    if (userId) {
      await sb.from('pick_transactions')
        .delete()
        .eq('user_id', userId)
        .eq('payment_status', 'pending');
    } else if (anonymousSessionId) {
      await sb.from('pick_transactions')
        .delete()
        .eq('anonymous_session_id', anonymousSessionId)
        .eq('payment_status', 'pending');
    }

    /* 🔥 NEW: Get promotional offer */
    let promotionDetails = null;
    let totalEffectiveAmount = amount;
    let bonusAmount = 0;

    if (applyPromotion && userId) {
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
          
          console.log(`🎁 Promotion available:`, {
            campaign: promo.campaign_name,
            originalAmount: amount,
            bonusAmount,
            totalEffective: totalEffectiveAmount
          });
        }
      } catch (error) {
        console.warn('Error fetching promotion (continuing without):', error);
      }
    }

    /* Calculate multiplier and potential win */
    const multiplier = calcMultiplier(picks.length, mode);
    const potentialWin = multiplier * totalEffectiveAmount; // Use effective amount
    
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

    /* 🔥 NEW: Store transaction with promotional data */
    const transactionData = {
      // Existing fields
      user_id: userId,
      anonymous_session_id: anonymousSessionId || null,
      full_name: fullName ?? 'Jugador MMC',
      email: email,
      order_id: orderId,
      gp_name: gpName,
      picks,
      mode,
      multiplier,
      wager_amount: amount, // Original payment amount
      potential_win: potentialWin, // Based on effective amount
      payment_status: 'pending',
      
      // 🔥 NEW: Promotional fields (nullable for backward compatibility)
      promotion_applied: !!promotionDetails,
      promotion_bonus_amount: bonusAmount,
      promotion_total_effective: totalEffectiveAmount,
      promotion_campaign_name: promotionDetails?.campaignName || null
    };

    const { error: dbErr } = await sb.from('pick_transactions').insert(transactionData);
    
    if (dbErr) {
      console.error('Database error:', dbErr);
      throw new Error('Error guardando transacción');
    }

    console.log(`✅ Pick transaction created:`, {
      orderId,
      originalAmount: amount,
      bonusAmount,
      totalEffectiveAmount,
      potentialWin,
      promotionApplied: !!promotionDetails
    });

    /* Response with promotional info */
    return NextResponse.json({
      orderId,
      amount: amountStr, // Payment amount (original)
      callbackUrl,
      integrityKey,
      isAnonymous: !userId,
      sessionId: anonymousSessionId,
      // 🔥 NEW: Return promotion info
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
    });

  } catch (err: any) {
    console.error('register-pick-transaction error:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal server error' 
    }, { status: 500 });
  }
}