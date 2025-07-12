// 📁 app/api/vip/register-order/route.ts - HYBRID: SUPPORTS BOTH AUTHENTICATED & PAY-FIRST FLOWS

import { NextRequest, NextResponse } from 'next/server';
import { auth }                      from '@clerk/nextjs/server';
import { createClient }              from '@supabase/supabase-js';
import crypto                        from 'crypto';

// 🔥 FIXED: Add dynamic configuration to prevent static rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOLD_SECRET = process.env.BOLD_SECRET_KEY!;
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL!;
const CURRENCY    = 'COP';

const PLANS: Record<string, { price: number; name: string }> = {
  'race-pass'  : { price:  20_000, name: 'Race Pass'   },
  'season-pass': { price: 80_000, name: 'Season Pass' }
};

export async function POST(req: NextRequest) {
  try {
    /* ───────────── 🔥 NEW: Parse request body with pay-first support ───────────── */
    const { 
      planId, 
      planName, 
      amount,
      // Legacy authenticated flow fields
      fullName, 
      email,
      // 🔥 NEW: Pay-first flow flags
      requireEmailCollection = false,
      payFirst = false
    } = await req.json();

    /* ───────────── 1️⃣ Auth (Optional for pay-first flow) ───────────── */
    const { userId } = await auth();
    
    // 🚀 NEW: Pay-first flow - no auth required
    if (payFirst) {
      console.log('🚀 Pay-first flow initiated - no auth required');
    } else if (!userId) {
      // Legacy flow - auth required
      return new NextResponse('Unauthorized', { status: 401 });
    }

    /* ───────────── 1.5️⃣ Get user data (only for authenticated flow) ───────────── */
    let userData = { fullName: 'Sin nombre', email: '' };
    
    if (userId && !payFirst) {
      const { data: clerkUser } = await sb
        .from('clerk_users')
        .select('full_name, email')
        .eq('clerk_id', userId)
        .single();

      userData = {
        fullName: clerkUser?.full_name || fullName || 'Sin nombre',
        email: clerkUser?.email || email || ''
      };
    }

    /* ───────────── 2️⃣ Plan validation ───────────── */
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND' }, { status: 400 });
    }

    // Use provided amount or plan default
    const finalAmount = amount || plan.price;
    const finalPlanName = planName || plan.name;

    /* ───────────── 2.5️⃣ Get Active GP for Race Pass ───────────── */
    let activeGp = null;
    if (planId === 'race-pass') {
      const { data: gpData } = await sb
        .from('gp_schedule')
        .select('gp_name, qualy_time, race_time')
        .gte('qualy_time', new Date().toISOString())
        .order('race_time', { ascending: true })
        .limit(1)
        .single();
      
      activeGp = gpData?.gp_name || null;
      
      if (!activeGp) {
        return NextResponse.json({ 
          error: 'NO_ACTIVE_GP',
          message: 'No hay ningún Gran Premio activo para predicciones en este momento.' 
        }, { status: 400 });
      }
    }

    /* ───────────── 3️⃣ Generate Order ID ───────────── */
    let orderId;
    if (payFirst) {
      // 🔥 NEW: Pay-first order ID format
      const shortStamp = Date.now().toString(36);
      const randomSuffix = Math.random().toString(36).substr(2, 6);
      orderId = `vip-${planId}-pf-${shortStamp}-${randomSuffix}`;
    } else {
      // Legacy authenticated order ID format
      const safeUserId = userId!.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 12);
      const shortStamp = Date.now().toString(36);
      orderId = `vip-${planId}-${safeUserId}-${shortStamp}`;
    }

    const amountStr = String(finalAmount);
    
    const integritySignature = crypto
      .createHash('sha256')
      .update(`${orderId}${amountStr}${CURRENCY}${BOLD_SECRET}`)
      .digest('hex');

    /* ───────────── 4️⃣ Set redirection URL based on flow ───────────── */
    const redirectionUrl = payFirst 
      ? `${SITE_URL}/vip-account-setup?order=${orderId}`
      : `${SITE_URL}/fantasy-vip-success?orderId=${orderId}`;

    /* ───────────── 5️⃣ Save transaction to Supabase ───────────── */
    const transactionData = {
      order_id: orderId,
      plan_id: planId,
      amount_cop: finalAmount,
      payment_status: 'pending',
      selected_gp: activeGp,
      // 🔥 NEW: Pay-first flow tracking
      pay_first_flow: payFirst,
      requires_account_creation: payFirst,
      ...(payFirst ? {
        // Pay-first flow: minimal data, will be filled by webhook
        user_id: null,
        full_name: null,
        email: null,
        customer_email: null,
        customer_name: null
      } : {
        // Authenticated flow: full user data
        user_id: userId,
        full_name: userData.fullName,
        email: userData.email
      })
    };

    const { data: transaction, error: dbError } = await sb
      .from('vip_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (dbError) {
      console.error('[register-order] DB Error:', dbError);
      return new NextResponse('DB_ERROR', { status: 500 });
    }

    /* ───────────── 6️⃣ Response to client ───────────── */
    const response = {
      orderId,
      amount: amountStr,
      description: `F1 Fantasy VIP – ${finalPlanName}${activeGp ? ` (${activeGp})` : ''}`,
      integritySignature,
      redirectionUrl,
      activeGp,
      // 🔥 NEW: Flow-specific data
      payFirstFlow: payFirst,
      requiresAccountCreation: payFirst,
      transaction_id: transaction.id
    };

    console.log(`✅ Order created: ${orderId} (${payFirst ? 'pay-first' : 'authenticated'} flow)`);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in register-order:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}