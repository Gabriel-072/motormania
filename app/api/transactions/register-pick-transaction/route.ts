// app/api/transactions/register-pick-transaction/route.ts - Updated for Anonymous Users
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
    /* 🆕 Auth is now optional - get userId if available */
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
      anonymousSessionId?: string; // 🆕 For anonymous users
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

    /* 🆕 Anonymous user validation */
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

    /* 🆕 Clean up existing pending transactions */
    if (userId) {
      // For authenticated users, clean their pending transactions
      await sb.from('pick_transactions')
        .delete()
        .eq('user_id', userId)
        .eq('payment_status', 'pending');
    } else {
      // For anonymous users, clean their session's pending transactions
      await sb.from('pick_transactions')
        .delete()
        .eq('anonymous_session_id', anonymousSessionId)
        .eq('payment_status', 'pending');
    }

    /* Calculations */
    const multiplier = calcMultiplier(picks.length, mode);
    const potentialWin = multiplier * amount;
    
    /* 🆕 Updated order ID generation */
    const orderId = userId 
      ? `MMC-${userId}-${Date.now()}`
      : `MMC-ANON-${Date.now()}`;
    
    const amountStr = String(amount);

    // Bold signature (orderId + amount + currency + secret)
    const integrityKey = crypto
      .createHash('sha256')
      .update(`${orderId}${amountStr}${CURRENCY}${BOLD_SECRET}`)
      .digest('hex');

    const callbackUrl = userId 
      ? `${SITE_URL}/dashboard?bold_order_id=${orderId}`
      : `${SITE_URL}/sign-up?session=${anonymousSessionId}&order=${orderId}&redirect_url=/payment-success`;

    /* 🆕 Save transaction with nullable user_id */
    const transactionData = {
      user_id: userId, // Can be null for anonymous users
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
      payment_status: 'pending'
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
      sessionId: anonymousSessionId
    });

  } catch (err: any) {
    console.error('register-pick-transaction error:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal server error' 
    }, { status: 500 });
  }
}