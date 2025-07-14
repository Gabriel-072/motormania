// 📁 app/api/vip/register-order/route.ts - FIXED FOR NOT NULL user_id

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOLD_SECRET = process.env.BOLD_SECRET_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const CURRENCY = 'COP';

const PLANS: Record<string, { price: number; name: string }> = {
  'race-pass': { price: 2_000, name: 'Race Pass' },
  'season-pass': { price: 80_000, name: 'Season Pass' }
};

export async function POST(req: NextRequest) {
  try {
    const { 
      planId, 
      planName, 
      amount,
      fullName, 
      email,
      requireEmailCollection = false,
      payFirst = false
    } = await req.json();

    console.log('🎯 Pay-first flow:', payFirst);

    // Auth check (only for non-pay-first)
    const { userId } = await auth();
    
    if (!payFirst && !userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Plan validation
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND' }, { status: 400 });
    }

    // Get user data (only for authenticated flow)
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

    const finalAmount = amount || plan.price;
    const finalPlanName = planName || plan.name;

    // Get Active GP for Race Pass
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

    // Generate Order ID
    let orderId;
    if (payFirst) {
      const shortStamp = Date.now().toString(36);
      const randomSuffix = Math.random().toString(36).substr(2, 6);
      orderId = `vip-${planId}-pf-${shortStamp}-${randomSuffix}`;
    } else {
      const safeUserId = userId!.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 12);
      const shortStamp = Date.now().toString(36);
      orderId = `vip-${planId}-${safeUserId}-${shortStamp}`;
    }

    const amountStr = String(finalAmount);
    
    const integritySignature = crypto
      .createHash('sha256')
      .update(`${orderId}${amountStr}${CURRENCY}${BOLD_SECRET}`)
      .digest('hex');

// 🔥 SMART REDIRECT: Default to simple email collection
const redirectionUrl = payFirst 
  ? `${SITE_URL}/vip-email-only?order=${orderId}`
  : `${SITE_URL}/fantasy-vip-success?orderId=${orderId}`;

    // 🔥 FIXED: Handle NOT NULL user_id constraint
    const transactionData = {
      order_id: orderId,
      plan_id: planId,
      amount_cop: finalAmount,
      payment_status: 'pending',
      
      // 🎯 KEY FIX: Use placeholder user_id for pay-first flows
      user_id: payFirst ? `PENDING_${orderId}` : userId,
      
      // Other fields
      full_name: payFirst ? `[PAY_FIRST] ${finalPlanName}` : userData.fullName,
      email: payFirst ? 'pay-first@pending.com' : userData.email,
      selected_gp: activeGp,
      
      // Pay-first tracking fields
      pay_first_flow: payFirst,
      requires_account_creation: payFirst,
      customer_email: null,  // Will be filled by webhook
      customer_name: null,   // Will be filled by webhook
      
      // Status fields
      slack_notified: false
    };

    console.log('💾 Transaction data:', JSON.stringify(transactionData, null, 2));

    const { data: transaction, error: dbError } = await sb
      .from('vip_transactions')
      .insert(transactionData)
      .select('id, order_id, plan_id, amount_cop, payment_status')
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json({
        error: 'DATABASE_ERROR',
        details: dbError.message,
        code: dbError.code
      }, { status: 500 });
    }

    console.log('✅ Transaction created successfully:', transaction);

    const response = {
      orderId,
      amount: amountStr,
      description: `F1 Fantasy VIP – ${finalPlanName}${activeGp ? ` (${activeGp})` : ''}`,
      integritySignature,
      redirectionUrl,
      activeGp,
      payFirstFlow: payFirst,
      requiresAccountCreation: payFirst,
      transaction_id: transaction.id
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Unexpected error in register-order:', error);
    return NextResponse.json({
      error: 'INTERNAL_SERVER_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}