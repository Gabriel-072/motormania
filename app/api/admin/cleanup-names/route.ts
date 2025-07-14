import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    // Clean up transactions
    const { data: transactions } = await sb
      .from('vip_transactions')
      .select('id, email, customer_email')
      .like('full_name', '%[PAY_FIRST]%');

    for (const transaction of transactions || []) {
      const email = transaction.customer_email || transaction.email;
      if (email && !email.includes('pending')) {
        const cleanName = email.split('@')[0].replace(/[._]/g, ' ');
        const properName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        
        await sb
          .from('vip_transactions')
          .update({ full_name: properName })
          .eq('id', transaction.id);
      }
    }

    // Clean up VIP users
    const { data: vipUsers } = await sb
      .from('vip_users')
      .select('id, email')
      .like('full_name', '%[PAY_FIRST]%');

    for (const user of vipUsers || []) {
      if (user.email && !user.email.includes('pending')) {
        const cleanName = user.email.split('@')[0].replace(/[._]/g, ' ');
        const properName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        
        await sb
          .from('vip_users')
          .update({ full_name: properName })
          .eq('id', user.id);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Cleaned up PAY_FIRST names',
      transactionsUpdated: transactions?.length || 0,
      usersUpdated: vipUsers?.length || 0
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
  }
}