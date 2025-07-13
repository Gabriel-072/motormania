// 📁 app/api/vip/register-order/route.ts - EXACT SCHEMA MATCH

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
  'race-pass': { price: 20_000, name: 'Race Pass' },
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

    const redirectionUrl = payFirst 
      ? `${SITE_URL}/vip-account-setup?order=${orderId}`
      : `${SITE_URL}/fantasy-vip-success?orderId=${orderId}`;

    // 🎯 EXACT SCHEMA MATCH - All columns that exist in vip_transactions
    const transactionData = {
      // Required fields
      order_id: orderId,
      plan_id: planId,
      amount_cop: finalAmount,
      payment_status: 'pending',
      
      // User fields
      user_id: payFirst ? null : userId,
      full_name: payFirst ? null : userData.fullName,
      email: payFirst ? null : userData.email,
      
      // Pay-first specific fields (these columns exist!)
      pay_first_flow: payFirst,
      requires_account_creation: payFirst,
      customer_email: payFirst ? null : null, // Will be filled by webhook
      customer_name: payFirst ? null : null,  // Will be filled by webhook
      
      // GP field
      selected_gp: activeGp,
      
      // Status fields
      slack_notified: false,
      
      // Timestamps (let database handle created_at with default)
      // created_at will be auto-set by database default
      
      // Optional fields that can be null
      bold_payment_id: null,
      paid_at: null,
      bold_webhook_received_at: null,
      manual_confirmation_at: null
    };

    console.log('💾 Inserting transaction data:', JSON.stringify(transactionData, null, 2));

    // Insert with explicit column specification to avoid cache issues
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
        code: dbError.code,
        hint: dbError.hint
      }, { status: 500 });
    }

    console.log('✅ Transaction created:', transaction);

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