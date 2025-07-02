// ============================================================================
// STEP 1: API ENDPOINT - /app/api/analytics/video/route.ts
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await req.json();
    
    const { 
      sessionId, 
      videoPercentage, 
      pageUrl = '/fantasy-vip-info' 
    } = body;

    if (!sessionId || videoPercentage === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert analytics data
    const { error } = await supabase
      .from('video_analytics')
      .insert({
        user_id: userId || null,
        session_id: sessionId,
        video_percentage: Math.floor(videoPercentage),
        page_url: pageUrl
      });

    if (error) {
      console.error('Video analytics error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Video analytics API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}