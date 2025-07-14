//app/api/vip/collect-email/route.ts - FIXED: Handle already processed transactions

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

    // 🔥 FIXED: Declare all variables at function scope
    let userId: string;
    let isNewUser: boolean = true;
    let customerName: string;
    let sessionToken: string;
    let activePlan: string;
    let planExpiresAt: string;
    let racePassGp: string | null = null;
    let autoLoginToken: string | null = null;

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

    // 1. 🔥 FIXED: Check for transaction with multiple statuses
    const { data: transaction, error: transactionError } = await sb
      .from('vip_transactions')
      .select('*')
      .eq('order_id', orderId)
      .in('payment_status', ['paid_no_email', 'paid']) // Check both statuses
      .single();

    if (transactionError || !transaction) {
      console.error('❌ Transaction not found:', transactionError);
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 });
    }

    // 2. 🔥 NEW: Check if already processed
    if (transaction.payment_status === 'paid' && transaction.user_id && !transaction.user_id.startsWith('PENDING_')) {
      console.log('✅ Transaction already processed, checking VIP status...');
      
      // Check if VIP access already exists
      const { data: existingVipUser } = await sb
        .from('vip_users')
        .select('*')
        .eq('id', transaction.user_id)
        .single();

      if (existingVipUser) {
        // Already has VIP access, create login session and return success
        sessionToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await sb
          .from('vip_login_sessions')
          .insert({
            session_token: sessionToken,
            clerk_user_id: transaction.user_id,
            order_id: orderId,
            expires_at: expiresAt.toISOString(),
            used: false
          });

        return NextResponse.json({
          success: true,
          message: 'Acceso VIP ya activado',
          user_id: transaction.user_id,
          email: transaction.email,
          login_session_token: sessionToken,
          is_new_user: false,
          plan_activated: existingVipUser.active_plan,
          already_processed: true
        });
      }
    }

    // 3. Check if user already exists
    const clerk = await clerkClient();
    const existingUsers = await clerk.users.getUserList({
      emailAddress: [email]
    });

    customerName = transaction.customer_name || transaction.full_name || '';

    if (existingUsers.data && existingUsers.data.length > 0) {
      console.log('👤 User already exists:', email);
      userId = existingUsers.data[0].id;
      isNewUser = false;
      
      const existingUserName = `${existingUsers.data[0].firstName || ''} ${existingUsers.data[0].lastName || ''}`.trim();
      if (existingUserName) {
        customerName = existingUserName;
      }
    } else {
      // Create new Clerk user
      console.log('🚀 Creating new user for email:', email);
      
      const firstName = customerName.split(' ')[0] || undefined;
      const lastName = customerName.split(' ').slice(1).join(' ') || undefined;

      const newUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName: firstName,
        lastName: lastName,
        skipPasswordRequirement: true,
        skipPasswordChecks: true
      });
      
      userId = newUser.id;
      console.log('✅ New Clerk user created:', userId);
      
      // 🔥 NEW: Create a sign-in token for immediate authentication
      try {
        const signInToken = await clerk.signInTokens.createSignInToken({
          userId: userId,
          expiresInSeconds: 600, // 10 minutes
        });
        
        console.log('✅ Sign-in token created for auto-login');
        autoLoginToken = signInToken.token;
        
      } catch (tokenError) {
        console.error('⚠️ Could not create sign-in token:', tokenError);
        // Continue without auto-login - user will need to sign in manually
      }

      await sb
        .from('clerk_users')
        .upsert({
          clerk_id: userId,
          email: email,
          full_name: customerName,
          created_at: new Date().toISOString(),
          created_via: 'pay_first_email_collection'
        }, { onConflict: 'clerk_id' });
    }

    // 4. Update transaction with user ID
    await sb
      .from('vip_transactions')
      .update({
        user_id: userId,
        email: email,
        full_name: customerName,
        payment_status: 'paid',
        customer_email: email,
        customer_name: customerName
      })
      .eq('order_id', orderId);

    // 5. Grant VIP access
    activePlan = transaction.plan_id;

    if (transaction.plan_id === 'race-pass' && transaction.selected_gp) {
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

    const entryTxId = crypto.randomUUID();
    await sb
      .from('vip_users')
      .upsert({
        id: userId,
        entry_tx_id: entryTxId,
        joined_at: transaction.paid_at || new Date().toISOString(),
        full_name: customerName,
        email: email,
        active_plan: activePlan,
        plan_expires_at: planExpiresAt,
        race_pass_gp: racePassGp,
        created_via_pay_first: isNewUser
      }, { onConflict: 'id' });

    await sb
      .from('vip_entries')
      .upsert({
        user_id: userId,
        status: 'approved',
        amount_paid: transaction.amount_cop,
        currency: 'COP',
        bold_order_id: transaction.bold_payment_id || orderId,
        customer_email: email,
        customer_name: customerName,
        account_created: isNewUser,
        metadata: { 
          source: 'email_collection_flow',
          existing_user: !isNewUser,
          plan_type: activePlan
        }
      }, { onConflict: 'bold_order_id' });

    // 6. Generate login session
    sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await sb
      .from('vip_login_sessions')
      .insert({
        session_token: sessionToken,
        clerk_user_id: userId,
        order_id: orderId,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    console.log(`✅ VIP access granted for ${isNewUser ? 'new' : 'existing'} user:`, email);

    // 7. Send confirmation email
    try {
      const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/vip/send-confirmation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          customerName: customerName,
          planType: activePlan,
          racePassGp: racePassGp,
          amount: transaction.amount_cop,
          orderId: orderId
        })
      });
    
      if (emailResponse.ok) {
        console.log('✅ Confirmation email sent to:', email);
      } else {
        console.log('⚠️ Failed to send confirmation email, but continuing...');
      }
    } catch (emailError) {
      console.log('⚠️ Email sending error (non-critical):', emailError);
    }

    // 8. Return success response
    return NextResponse.json({
      success: true,
      message: isNewUser ? 'Cuenta creada exitosamente' : 'Acceso VIP activado para cuenta existente',
      user_id: userId,
      email: email,
      login_session_token: sessionToken,
      is_new_user: isNewUser,
      plan_activated: activePlan,
      // 🔥 NEW: Include auto-login token if available
      auto_login_token: autoLoginToken
    });

  } catch (error) {
    console.error('❌ Error in collect-email:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}