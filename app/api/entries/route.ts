import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server'; // Correct import for Clerk v5
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { userId, getToken } = await auth(); // Call auth() as a function
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwt = await getToken({ template: 'supabase' });
  const supabase = createServerSupabaseClient(jwt ?? undefined);
  const { data, error } = await supabase
    .from('entries')
    .select('numbers')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || {});
}

export async function POST(request: NextRequest) {
  const { userId, getToken } = await auth(); // Call auth() as a function
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwt = await getToken({ template: 'supabase' });
  const supabase = createServerSupabaseClient(jwt ?? undefined);
  const { numbers } = await request.json();

  const { error } = await supabase
    .from('entries')
    .insert({ user_id: userId, numbers, region: 'CO' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}