// 📁 app/api/vip/register-order/route.ts - COMPREHENSIVE DEBUG

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

const PLANS: Record<string, { price: number; name: string }> = {
  'race-pass': { price: 20_000, name: 'Race Pass' },
  'season-pass': { price: 80_000, name: 'Season Pass' }
};

export async function POST(req: NextRequest) {
  console.log('🔍 === COMPREHENSIVE DEBUG START ===');
  
  try {
    // 1. Test basic Supabase connection
    console.log('🔍 STEP 1: Testing Supabase connection...');
    const { data: connectionTest, error: connectionError } = await sb
      .from('vip_transactions')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      console.error('❌ Connection test failed:', connectionError);
      return NextResponse.json({
        error: 'CONNECTION_ERROR',
        details: connectionError.message,
        step: 'connection_test'
      }, { status: 500 });
    }
    console.log('✅ Supabase connection working');

    // 2. Parse and validate request
    console.log('🔍 STEP 2: Parsing request...');
    const { 
      planId, 
      planName, 
      amount,
      fullName, 
      email,
      requireEmailCollection = false,
      payFirst = false
    } = await req.json();
    
    console.log('📦 Request data:', { planId, planName, amount, payFirst });

    // 3. Test Auth
    console.log('🔍 STEP 3: Testing auth...');
    const { userId } = await auth();
    console.log('👤 User ID:', userId);
    
    if (!payFirst && !userId) {
      console.log('❌ Auth required but no user found');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 4. Plan validation
    console.log('🔍 STEP 4: Plan validation...');
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) {
      console.log('❌ Plan not found:', planId);
      return NextResponse.json({ error: 'PLAN_NOT_FOUND' }, { status: 400 });
    }
    console.log('✅ Plan found:', plan);

    // 5. Test GP query
    console.log('🔍 STEP 5: Testing GP query...');
    let activeGp = null;
    if (planId === 'race-pass') {
      const { data: gpData, error: gpError } = await sb
        .from('gp_schedule')
        .select('gp_name, qualy_time, race_time')
        .gte('qualy_time', new Date().toISOString())
        .order('race_time', { ascending: true })
        .limit(1)
        .single();
      
      if (gpError) {
        console.error('❌ GP query error:', gpError);
        return NextResponse.json({
          error: 'GP_QUERY_ERROR',
          details: gpError.message,
          step: 'gp_query'
        }, { status: 500 });
      }
      
      activeGp = gpData?.gp_name || null;
      console.log('🏁 Active GP:', activeGp);
      
      if (!activeGp) {
        console.log('❌ No active GP found');
        return NextResponse.json({ 
          error: 'NO_ACTIVE_GP',
          message: 'No hay ningún Gran Premio activo para predicciones en este momento.' 
        }, { status: 400 });
      }
    }

    // 6. Generate order ID
    console.log('🔍 STEP 6: Generating order ID...');
    const shortStamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    const orderId = `debug-${planId}-${shortStamp}-${randomSuffix}`;
    console.log('🆔 Order ID:', orderId);

    // 7. Test minimal insert first
    console.log('🔍 STEP 7: Testing minimal insert...');
    const minimalData = {
      order_id: orderId,
      plan_id: planId,
      amount_cop: plan.price,
      payment_status: 'pending'
    };
    
    console.log('📦 Minimal data:', minimalData);
    
    const { data: minimalResult, error: minimalError } = await sb
      .from('vip_transactions')
      .insert(minimalData)
      .select('id, order_id')
      .single();
    
    if (minimalError) {
      console.error('❌ MINIMAL INSERT FAILED:', {
        message: minimalError.message,
        details: minimalError.details,
        hint: minimalError.hint,
        code: minimalError.code
      });
      return NextResponse.json({
        error: 'MINIMAL_INSERT_ERROR',
        details: minimalError.message,
        code: minimalError.code,
        hint: minimalError.hint,
        step: 'minimal_insert'
      }, { status: 500 });
    }
    
    console.log('✅ MINIMAL INSERT SUCCESS:', minimalResult);

    // 8. If minimal worked, try adding more fields one by one
    console.log('🔍 STEP 8: Testing individual field additions...');
    
    // Test user_id
    const { error: userIdError } = await sb
      .from('vip_transactions')
      .update({ user_id: payFirst ? null : userId })
      .eq('id', minimalResult.id);
    
    if (userIdError) {
      console.error('❌ user_id update failed:', userIdError);
      return NextResponse.json({
        error: 'USER_ID_UPDATE_ERROR',
        details: userIdError.message,
        step: 'user_id_update'
      }, { status: 500 });
    }
    console.log('✅ user_id update success');

    // Test pay_first_flow
    const { error: payFirstError } = await sb
      .from('vip_transactions')
      .update({ pay_first_flow: payFirst })
      .eq('id', minimalResult.id);
    
    if (payFirstError) {
      console.error('❌ pay_first_flow update failed:', payFirstError);
      return NextResponse.json({
        error: 'PAY_FIRST_UPDATE_ERROR',
        details: payFirstError.message,
        step: 'pay_first_update'
      }, { status: 500 });
    }
    console.log('✅ pay_first_flow update success');

    // Test selected_gp
    if (activeGp) {
      const { error: gpUpdateError } = await sb
        .from('vip_transactions')
        .update({ selected_gp: activeGp })
        .eq('id', minimalResult.id);
      
      if (gpUpdateError) {
        console.error('❌ selected_gp update failed:', gpUpdateError);
        return NextResponse.json({
          error: 'GP_UPDATE_ERROR',
          details: gpUpdateError.message,
          step: 'gp_update'
        }, { status: 500 });
      }
      console.log('✅ selected_gp update success');
    }

    // 9. Generate response
    console.log('🔍 STEP 9: Generating response...');
    const amountStr = String(plan.price);
    const integritySignature = crypto
      .createHash('sha256')
      .update(`${orderId}${amountStr}COP${process.env.BOLD_SECRET_KEY!}`)
      .digest('hex');

    const redirectionUrl = payFirst 
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/vip-account-setup?order=${orderId}`
      : `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy-vip-success?orderId=${orderId}`;

    const response = {
      orderId,
      amount: amountStr,
      description: `F1 Fantasy VIP – ${plan.name}${activeGp ? ` (${activeGp})` : ''}`,
      integritySignature,
      redirectionUrl,
      activeGp,
      payFirstFlow: payFirst,
      requiresAccountCreation: payFirst,
      transaction_id: minimalResult.id,
      debug_info: {
        steps_completed: [
          'connection_test',
          'request_parsing', 
          'auth_check',
          'plan_validation',
          'gp_query',
          'order_generation',
          'minimal_insert',
          'field_updates'
        ],
        transaction_created: true
      }
    };

    console.log('✅ === DEBUG SUCCESS ===');
    console.log('📦 Response:', response);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ === DEBUG FAILED ===');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    return NextResponse.json({
      error: 'UNEXPECTED_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}