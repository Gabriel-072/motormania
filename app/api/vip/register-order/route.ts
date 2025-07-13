// 📁 app/api/vip/register-order/route.ts - CLEAN VERSION (EXISTING COLUMNS ONLY)

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
  console.log('🔍 Register order called');
  
  try {
    const body = await req.json();
    console.log('📦 Request body:', JSON.stringify(body, null, 2));
    
    const { 
      planId, 
      planName, 
      amount,
      fullName, 
      email,
      requireEmailCollection = false,
      payFirst = false
    } = body;

    console.log('🎯 Pay-first flow?', payFirst);

    // Auth check (only for non-pay-first)
    const { userId } = await auth();
    console.log('👤 User ID:', userId, 'Pay-first:', payFirst);
    
    if (!payFirst && !userId) {
      console.log('❌ Auth required but no user found');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Plan validation
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) {
      console.log('❌ Plan not found:', planId);
      return NextResponse.json({ error: 'PLAN_NOT_FOUND' }, { status: 400 });
    }

    console.log('✅ Plan found:', plan);

    // Get user data (only for authenticated flow)
    let userData = { fullName: 'Sin nombre', email: '' };
    
    if (userId && !payFirst) {
      console.log('🔍 Getting user data for authenticated flow');
      try {
        const { data: clerkUser } = await sb
          .from('clerk_users')
          .select('full_name, email')
          .eq('clerk_id', userId)
          .single();

        userData = {
          fullName: clerkUser?.full_name || fullName || 'Sin nombre',
          email: clerkUser?.email || email || ''
        };
        console.log('✅ User data retrieved:', userData);
      } catch (userError) {
        console.log('⚠️ Error getting user data:', userError);
      }
    }

    const finalAmount = amount || plan.price;
    const finalPlanName = planName || plan.name;

    console.log('💰 Final amount:', finalAmount, 'Final plan name:', finalPlanName);

    // Get Active GP for Race Pass
    let activeGp = null;
    if (planId === 'race-pass') {
      console.log('🏁 Getting active GP for race pass');
      try {
        const { data: gpData } = await sb
          .from('gp_schedule')
          .select('gp_name, qualy_time, race_time')
          .gte('qualy_time', new Date().toISOString())
          .order('race_time', { ascending: true })
          .limit(1)
          .single();
        
        activeGp = gpData?.gp_name || null;
        console.log('🏁 Active GP:', activeGp);
        
        if (!activeGp) {
          console.log('❌ No active GP found');
          return NextResponse.json({ 
            error: 'NO_ACTIVE_GP',
            message: 'No hay ningún Gran Premio activo para predicciones en este momento.' 
          }, { status: 400 });
        }
      } catch (gpError) {
        console.log('❌ Error getting active GP:', gpError);
        return NextResponse.json({ 
          error: 'GP_FETCH_ERROR',
          message: 'Error obteniendo GP activo' 
        }, { status: 500 });
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

    console.log('🆔 Generated order ID:', orderId);

    const amountStr = String(finalAmount);
    
    const integritySignature = crypto
      .createHash('sha256')
      .update(`${orderId}${amountStr}${CURRENCY}${BOLD_SECRET}`)
      .digest('hex');

    console.log('🔐 Integrity signature generated');

    const redirectionUrl = payFirst 
      ? `${SITE_URL}/vip-account-setup?order=${orderId}`
      : `${SITE_URL}/fantasy-vip-success?orderId=${orderId}`;

    console.log('🔗 Redirection URL:', redirectionUrl);

    // 🔥 SIMPLIFIED: Only use columns that definitely exist
    const transactionData = {
      order_id: orderId,
      plan_id: planId,
      amount_cop: finalAmount,
      payment_status: 'pending',
      selected_gp: activeGp,
      user_id: payFirst ? null : userId,
      full_name: payFirst ? `[PAY_FIRST] ${finalPlanName}` : userData.fullName,
      email: payFirst ? 'pay-first@pending.com' : userData.email
    };

    console.log('💾 Transaction data to insert:', JSON.stringify(transactionData, null, 2));

    // Save transaction to Supabase
    try {
      const { data: transaction, error: dbError } = await sb
        .from('vip_transactions')
        .insert(transactionData)
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database error:', dbError);
        return NextResponse.json({
          error: 'DATABASE_ERROR',
          details: dbError.message,
          code: dbError.code
        }, { status: 500 });
      }

      console.log('✅ Transaction saved:', transaction);

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

      console.log('✅ Sending response:', JSON.stringify(response, null, 2));
      
      return NextResponse.json(response);

    } catch (dbError) {
      console.error('❌ Database operation failed:', dbError);
      return NextResponse.json({
        error: 'DB_OPERATION_FAILED',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Unexpected error in register-order:', error);
    return NextResponse.json({
      error: 'INTERNAL_SERVER_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}