// 📁 app/api/track-source/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await req.json();

    const { error } = await sb.from('traffic_sources').insert({
      user_id: userId,
      session_id: body.session_id,
      utm_source: body.utm_source,
      utm_medium: body.utm_medium,
      utm_campaign: body.utm_campaign,
      utm_term: body.utm_term,
      utm_content: body.utm_content,
      referrer: body.referrer,
      page_url: body.page_url
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track source error:', error);
    return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
  }
}