//app/api/vip/check-account-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID required' },
        { status: 400 }
      );
    }

    // Check transaction status
    const { data: transaction, error: transactionError } = await sb
      .from('vip_transactions')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (transactionError || !transaction) {
      console.error('❌ Transaction not found:', orderId);
      return NextResponse.json({
        status: 'payment_not_found',
        message: 'Orden no encontrada'
      });
    }

    // Check payment status
    if (transaction.status === 'pending') {
      return NextResponse.json({
        status: 'payment_pending',
        message: 'Pago en proceso'
      });
    }

    if (transaction.status === 'failed') {
      return NextResponse.json({
        status: 'payment_failed',
        message: 'Pago falló'
      });
    }

    if (transaction.status === 'paid') {
      // Check if account was created
      const { data: vipUser, error: vipUserError } = await sb
        .from('vip_users')
        .select('*')
        .eq('id', transaction.user_id)
        .single();

      if (vipUserError || !vipUser) {
        return NextResponse.json({
          status: 'account_creating',
          message: 'Creando cuenta...'
        });
      }

      // Account exists, check for login session
      const { data: loginSession, error: sessionError } = await sb
        .from('vip_login_sessions')
        .select('*')
        .eq('order_id', orderId)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      return NextResponse.json({
        status: 'account_ready',
        message: 'Cuenta lista',
        account: {
          email: vipUser.email,
          full_name: vipUser.full_name,
          plan_id: vipUser.active_plan,
          race_pass_gp: vipUser.race_pass_gp,
          login_session_token: loginSession?.session_token || null,
          plan_expires_at: vipUser.plan_expires_at
        }
      });
    }

    return NextResponse.json({
      status: 'unknown',
      message: 'Estado desconocido'
    });

  } catch (error) {
    console.error('❌ Error checking account status:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}