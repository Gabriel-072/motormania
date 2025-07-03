// FILE 2: /app/api/analytics/video/route.ts  
// Enhanced Video Analytics API
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
      pageUrl = '/fantasy-vip-info',
      eventType = 'video_progress',
      metadata = {}
    } = body;

    if (!sessionId || videoPercentage === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Enhanced metadata with browser info
    const enhancedMetadata = {
      ...metadata,
      timestamp: Date.now(),
      userAgent: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
    };

    // Insert enhanced analytics data
    const { error: analyticsError } = await supabase
      .from('video_analytics')
      .insert({
        user_id: userId || null,
        session_id: sessionId,
        video_percentage: Math.floor(videoPercentage),
        page_url: pageUrl,
        event_type: eventType,
        metadata: enhancedMetadata,
        timestamp: new Date().toISOString()
      });

    if (analyticsError) {
      console.error('Video analytics error:', analyticsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Track special VIP events
    const promises = [];

    if (videoPercentage === 20) {
      // Lead qualification point - correlates with Facebook Lead event
      promises.push(
        supabase.from('vip_events').insert({
          session_id: sessionId,
          user_id: userId || null,
          event_type: 'lead_qualification',
          event_data: { 
            video_percentage: 20, 
            page_url: pageUrl,
            qualification_method: 'video_engagement_threshold',
            lead_quality: 'medium'
          },
          timestamp: new Date().toISOString()
        })
      );
    }
    
    if (videoPercentage === 50) {
      // Content unlock point - correlates with Facebook ViewContent event
      promises.push(
        supabase.from('vip_events').insert({
          session_id: sessionId,
          user_id: userId || null,
          event_type: 'content_unlock',
          event_data: { 
            video_percentage: 50, 
            unlock_method: 'auto', 
            page_url: pageUrl,
            user_intent_level: 'high'
          },
          timestamp: new Date().toISOString()
        })
      );
    }

    if (videoPercentage === 100) {
      // Video completion - high engagement signal
      promises.push(
        supabase.from('vip_events').insert({
          session_id: sessionId,
          user_id: userId || null,
          event_type: 'video_complete',
          event_data: { 
            video_percentage: 100, 
            page_url: pageUrl,
            engagement_level: 'very_high',
            completion_method: 'full_watch'
          },
          timestamp: new Date().toISOString()
        })
      );
    }

    // Execute all VIP event insertions
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    return NextResponse.json({ 
      success: true, 
      tracked_events: promises.length,
      session_id: sessionId,
      video_percentage: Math.floor(videoPercentage)
    });

  } catch (error) {
    console.error('Video analytics API error:', error);
    return NextResponse.json({ 
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}