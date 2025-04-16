// 📄 app/api/entries/paid/route.ts
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jwt = await getToken({ template: 'supabase' });
  const supabase = createServerSupabaseClient(jwt ?? undefined);

  const { data: existing } = await supabase
    .from('entries')
    .select('numbers, paid_numbers_count')
    .eq('user_id', userId)
    .single();

  if (!existing) return NextResponse.json({ error: 'User entry not found' }, { status: 404 });

  const newNumbers = Array.from({ length: 5 }, () =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );

  const updatedNumbers = [...existing.numbers, ...newNumbers];
  const updatedPaidCount = (existing.paid_numbers_count || 0) + 5;

  const { error } = await supabase
    .from('entries')
    .update({ numbers: updatedNumbers, paid_numbers_count: updatedPaidCount })
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, newNumbers });
}  
