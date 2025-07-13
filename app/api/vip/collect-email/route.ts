//app/api/vip/collect-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@clerk/nextjs/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { orderId, email } = await req.json();

    if (!orderId || !email) {
      return NextResponse.json({
        success: false,
        error: 'Order ID and email are required'
      }, { status: 400 });
    }

    console.log('📧 Processing email collection for order:', orderId, 'email:', email);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: 'Email inválido'
      }, { status: 400 });
    }

    // 1. Get the transaction
    const { data: transaction, error: transactionError } = await sb
      .from('vip_transactions')
      .select('*')
      .eq('order_id', orderId)
      .eq('payment_status', 'paid_no_email')
      .single();

    if (transactionError || !transaction) {
      console.error('❌ Transaction not found:', transactionError);
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 });
    }

    // 2. Check if user already exists
    const clerk = await clerkClient();
    const existingUsers = await clerk.users.getUserList({
      emailAddress: [email]
    });

    if (existingUsers.data && existingUsers.data.length > 0) {
      console.log('👤 User already exists:', email);
      
      // User exists - update transaction and redirect to sign in
      await sb
        .from('vip_transactions')
        .update({
          user_id: existingUsers.data[0].id,
          email: email,
          payment_status: 'paid'
        })
        .eq('order_id', orderId);

      return NextResponse.json({
        success: false,
        user_exists: true,
        message: 'Usuario ya existe, redirigir a login'
      });
    }

    // 3. Create new Clerk user
    console.log('🚀 Creating new user for email:', email);
    
    const customerName = transaction.customer_name || transaction.full_name || '';
    const firstName = customerName.split(' ')[0] || undefined;
    const lastName = customerName.split(' ').slice(1).join(' ') || undefined;

    const newUser = await clerk.users.createUser({
      emailAddress: [email],
      firstName: firstName,
      lastName: lastName,
      skipPasswordRequirement: true,
      skipPasswordChecks: true
    });

    console.log('✅ New Clerk user created:', newUser.id);

    // 4. Store in clerk_users table
    await sb
      .from('clerk_users')
      .upsert({
        clerk_id: newUser.id,
        email: email,
        full_name: customerName,
        created_at: new Date().toISOString(),
        created_via: 'pay_first_email_collection'
      }, { onConflict: 'clerk_id' });

    // 5. Update transaction with real user ID
    await sb
      .from('vip_transactions')
      .update({
        user_id: newUser.id,
        email: email,
        full_name: customerName,
        payment_status: 'paid',
        customer_email: email,
        customer_name: customerName
      })
      .eq('order_id', orderId);

    // 6. Create VIP user record
    const activePlan = transaction.plan_id;
    let planExpiresAt;
    let racePassGp = null;

    if (transaction.plan_id === 'race-pass' && transaction.selected_gp) {
      // Get race date for expiration
      const { data: gpData } = await sb
        .from('gp_schedule')
        .select('race_time')
        .eq('gp_name', transaction.selected_gp)
        .single();

      if (gpData) {
        const raceDate = new Date(gpData.race_time);
        planExpiresAt = new Date(raceDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
        racePassGp = transaction.selected_gp;
      } else {
        planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
    } else if (transaction.plan_id === 'season-pass') {
      planExpiresAt = new Date('2026-12-31').toISOString();
    } else {
      planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // 7. Create VIP user
    const entryTxId = crypto.randomUUID();
    await sb
      .from('vip_users')
      .upsert({
        id: newUser.id,
        entry_tx_id: entryTxId,
        joined_at: transaction.paid_at || new Date().toISOString(),
        full_name: customerName,
        email: email,
        active_plan: activePlan,
        plan_expires_at: planExpiresAt,
        race_pass_gp: racePassGp,
        created_via_pay_first: true
      }, { onConflict: 'id' });

    // 8. Create VIP entry
    await sb
      .from('vip_entries')
      .upsert({
        user_id: newUser.id,
        status: 'approved',
        amount_paid: transaction.amount_cop,
        currency: 'COP',
        bold_order_id: transaction.bold_payment_id || orderId,
        customer_email: email,
        customer_name: customerName,
        account_created: true,
        metadata: { source: 'email_collection_flow' }
      }, { onConflict: 'bold_order_id' });

    // 9. Generate login session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await sb
      .from('vip_login_sessions')
      .insert({
        session_token: sessionToken,
        clerk_user_id: newUser.id,
        order_id: orderId,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    console.log('✅ Account created successfully for:', email);

    return NextResponse.json({
      success: true,
      message: 'Cuenta creada exitosamente',
      user_id: newUser.id,
      email: email,
      login_session_token: sessionToken
    });

  } catch (error) {
    console.error('❌ Error in collect-email:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}