// app/api/vip/check-access/route.ts
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ 
        hasAccess: false, 
        error: 'Not authenticated' 
      });
    }

    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Check vip_users table
    const { data, error } = await supabase
      .from('vip_users')
      .select('id, active_plan, plan_expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('VIP check error:', error);
      return NextResponse.json({ 
        hasAccess: false, 
        error: error.message 
      });
    }

    // Check if user has valid VIP access
    if (data && data.plan_expires_at) {
      const isExpired = new Date(data.plan_expires_at) < new Date();
      return NextResponse.json({ 
        hasAccess: !isExpired,
        plan: data.active_plan,
        expiresAt: data.plan_expires_at
      });
    }

    return NextResponse.json({ hasAccess: false });
    
  } catch (error) {
    console.error('VIP access check error:', error);
    return NextResponse.json({ 
      hasAccess: false, 
      error: 'Internal server error' 
    });
  }
}