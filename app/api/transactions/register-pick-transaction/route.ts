// app/api/transactions/register-pick-transaction/route.ts - Aligned with new DB structure
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
  try {
    /* Auth is now optional - get userId if available */
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
    }
    
    const body: Body = await req.json();
    const { picks, mode = 'full', amount, gpName, fullName, email, anonymousSessionId } = body;

    /* Validation */
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
      if (!anonymousSessionId) {
        return NextResponse.json({ 
          error: 'Session ID requerido para usuarios anónimos' 
        }, { status: 400 });
      }
    }

    /* Clean up existing pending transactions */
    if (userId) {
      await sb.from('pick_transactions')
        .delete()
        .eq('user_id', userId)
        .eq('payment_status', 'pending');
    } else {
      await sb.from('pick_transactions')
        .delete()
        .eq('anonymous_session_id', anonymousSessionId)
        .eq('payment_status', 'pending');
    }

    /* Calculations */
    const multiplier = calcMultiplier(picks.length, mode);
    const potentialWin = multiplier * amount;
    
    /* Order ID generation */
    const orderId = userId 
      ? `MMC-${userId}-${Date.now()}`
      : `MMC-ANON-${Date.now()}`;
    
    const amountStr = String(amount);

    // Bold signature
    const integrityKey = crypto
      .createHash('sha256')
      .update(`${orderId}${amountStr}${CURRENCY}${BOLD_SECRET}`)
      .digest('hex');

    const callbackUrl = userId 
      ? `${SITE_URL}/dashboard?bold_order_id=${orderId}`
      : `${SITE_URL}/sign-up?session=${anonymousSessionId}&order=${orderId}&redirect_url=/payment-success`;

    /* 🔥 CHECK FOR ACTIVE PROMOTIONS */
    let promotionApplied = false;
    let promotionBonusAmount = 0;
    let promotionTotalEffective = amount;
    let promotionCampaignName = null;

    try {
      // Check if there's an active promotion
      const { data: activePromo } = await sb
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .gte('valid_until', new Date().toISOString())
        .lte('valid_from', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activePromo && amount >= (activePromo.min_bet_amount || 0)) {
        promotionApplied = true;
        promotionCampaignName = activePromo.campaign_name;
        
        if (activePromo.bonus_type === 'percentage') {
          promotionBonusAmount = Math.round(amount * (activePromo.bonus_value / 100));
        } else if (activePromo.bonus_type === 'fixed') {
          promotionBonusAmount = activePromo.bonus_value;
        }
        
        // Cap bonus to max_bonus_amount if specified
        if (activePromo.max_bonus_amount && promotionBonusAmount > activePromo.max_bonus_amount) {
          promotionBonusAmount = activePromo.max_bonus_amount;
        }
        
        promotionTotalEffective = amount + promotionBonusAmount;
        
        console.log(`🎉 Promotion applied: ${promotionCampaignName}, bonus: ${promotionBonusAmount}`);
      }
    } catch (error) {
      console.error('Error checking promotions:', error);
      // Continue without promotion if there's an error
    }

    /* Save transaction with new promotion fields */
    const transactionData = {
      user_id: userId,
      anonymous_session_id: anonymousSessionId || null,
      full_name: fullName ?? 'Jugador MMC',
      email: email,
      order_id: orderId,
      gp_name: gpName,
      picks,
      mode,
      multiplier,
      potential_win: potentialWin,
      wager_amount: amount,
      payment_status: 'pending',
      promotion_applied: promotionApplied,
      promotion_bonus_amount: promotionBonusAmount,
      promotion_total_effective: promotionTotalEffective,
      promotion_campaign_name: promotionCampaignName
    };

    const { error: dbErr } = await sb.from('pick_transactions').insert(transactionData);
    
    if (dbErr) {
      console.error('Database error:', dbErr);
      throw new Error('Error guardando transacción');
    }

    /* Response */
    return NextResponse.json({
      orderId,
      amount: amountStr,
      callbackUrl,
      integrityKey,
      isAnonymous: !userId,
      sessionId: anonymousSessionId,
      promotion: promotionApplied ? {
        applied: true,
        bonusAmount: promotionBonusAmount,
        totalEffective: promotionTotalEffective,
        campaignName: promotionCampaignName
      } : { applied: false }
    });

  } catch (err: any) {
    console.error('register-pick-transaction error:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal server error' 
    }, { status: 500 });
  }
}