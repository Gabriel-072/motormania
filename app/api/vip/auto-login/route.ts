//app/api/vip/auto-login/route.ts - SIMPLIFIED AUTO-LOGIN

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { sessionToken, orderId } = await req.json();

    if (!sessionToken || !orderId) {
      return NextResponse.json(
        { error: 'Session token and order ID required' },
        { status: 400 }
      );
    }

    // Verify session token
    const { data: loginSession, error: sessionError } = await sb
      .from('vip_login_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('order_id', orderId)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !loginSession) {
      console.error('❌ Invalid or expired session token:', sessionToken);
      return NextResponse.json({
        success: false,
        error: 'Token de sesión inválido o expirado'
      });
    }

    // Mark session token as used
    await sb
      .from('vip_login_sessions')
      .update({ 
        used: true, 
        used_at: new Date().toISOString() 
      })
      .eq('session_token', sessionToken);

    // 🔥 SIMPLIFIED: Return success and let client handle redirect
    // Instead of trying to create Clerk session server-side, 
    // we'll let the client redirect to Clerk sign-in with the verified user
    
    return NextResponse.json({
      success: true,
      message: 'Session verificada exitosamente',
      userId: loginSession.clerk_user_id,
      shouldRedirectToSignIn: true
    });

  } catch (error) {
    console.error('❌ Auto-login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}