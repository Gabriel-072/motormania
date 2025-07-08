// ============================================================================
// FILE 1: /app/api/analytics/video-tracking/route.ts
// FIXED - Proper TypeScript Types
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define proper types
interface VideoTrackingRequest {
  videoSessionId: string;
  eventType: string;
  eventData: Record<string, any>;
  pageType?: string;
  timestamp?: number;
}

interface AnalyticsData {
  event_type: string;
  video_percentage: number;
  event_data: Record<string, any>;
}

interface VipEventData {
  event_type: string;
  event_data: Record<string, any>;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const body: VideoTrackingRequest = await req.json();
    
    const { 
      videoSessionId,
      eventType, 
      eventData = {},
      pageType = 'vip_landing_enhanced',
      timestamp = Date.now()
    } = body;

    if (!videoSessionId || !eventType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Enhanced metadata from your VSL player
    const enhancedMetadata = {
      userAgent: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
      timestamp,
      pageType,
      source: 'enhanced_vsl_player'
    };

    // Handle different event types from your enhanced player
    let analyticsData: AnalyticsData = {
      event_type: 'video_progress',
      video_percentage: 0,
      event_data: {}
    };
    let vipEventData: VipEventData | null = null;

    switch (eventType) {
      case 'VIP_VideoLoad':
        analyticsData = {
          event_type: 'video_load',
          video_percentage: 0,
          event_data: {
            ...eventData,
            video_duration: eventData.video_duration || 300,
            video_quality: eventData.video_quality || 'auto',
            video_source: 'vsl_enhanced',
            engagement_level: 'initial'
          }
        };
        break;

      case 'VIP_VideoStart':
        analyticsData = {
          event_type: 'video_start',
          video_percentage: 0,
          event_data: {
            ...eventData,
            start_method: eventData.start_method || 'user_click',
            device_type: eventData.device_type || 'unknown',
            connection_type: eventData.connection_type || 'unknown',
            engagement_level: 'started'
          }
        };
        break;

      case 'VIP_VideoProgress_Detailed':
        const percentage = (eventData.video_percentage as number) || 0;
        analyticsData = {
          event_type: 'video_progress',
          video_percentage: percentage,
          event_data: {
            ...eventData,
            watch_time_seconds: eventData.watch_time_seconds || 0,
            play_count: eventData.play_count || 0,
            pause_count: eventData.pause_count || 0,
            seek_count: eventData.seek_count || 0,
            mute_toggles: eventData.mute_toggles || 0,
            engagement_level: percentage >= 80 ? 'high' : percentage >= 50 ? 'medium' : 'low'
          }
        };

        // Create VIP events for key milestones
        if (percentage === 25) {
          vipEventData = {
            event_type: 'video_quarter_milestone',
            event_data: {
              milestone: 25,
              attribution_value: 'medium',
              engagement_level: 'qualified_viewer',
              funnel_stage: 'interest'
            }
          };
        } else if (percentage === 75) {
          vipEventData = {
            event_type: 'video_mostly_complete',
            event_data: {
              milestone: 75,
              attribution_value: 'high',
              engagement_level: 'highly_engaged_viewer',
              funnel_stage: 'consideration'
            }
          };
        }
        break;

      case 'VIP_VideoQuarter':
        analyticsData = {
          event_type: 'video_quarter',
          video_percentage: 25,
          event_data: {
            ...eventData,
            engagement_level: 'qualified_viewer',
            attribution_checkpoint: true
          }
        };
        vipEventData = {
          event_type: 'lead_qualification_checkpoint',
          event_data: {
            qualification_method: 'video_engagement_25',
            lead_quality: 'medium',
            attribution_value: 'medium'
          }
        };
        break;

      case 'VIP_VideoMostly_Complete':
        analyticsData = {
          event_type: 'video_mostly_complete',
          video_percentage: 75,
          event_data: {
            ...eventData,
            engagement_level: 'highly_engaged_viewer',
            attribution_checkpoint: true
          }
        };
        vipEventData = {
          event_type: 'high_engagement_milestone',
          event_data: {
            engagement_level: 'high_intent',
            attribution_value: 'high',
            funnel_stage: 'decision'
          }
        };
        break;

      case 'VIP_VideoSeek':
        analyticsData = {
          event_type: 'video_seek',
          video_percentage: (eventData.seek_to as number) || 0,
          event_data: {
            ...eventData,
            seek_behavior: eventData.seek_direction === 'forward' ? 'skip_forward' : 'rewatch',
            engagement_pattern: (eventData.seek_amount as number) > 30 ? 'aggressive_seek' : 'micro_adjustment'
          }
        };
        break;

      case 'VIP_VideoAudio':
        analyticsData = {
          event_type: 'video_audio_toggle',
          video_percentage: (eventData.video_percentage as number) || 0,
          event_data: {
            ...eventData,
            audio_engagement_critical: eventData.action === 'unmuted',
            user_intent_level: eventData.action === 'unmuted' ? 'high' : 'medium'
          }
        };
        
        if (eventData.action === 'unmuted') {
          vipEventData = {
            event_type: 'audio_engagement_activated',
            event_data: {
              engagement_level: 'high_intent',
              audio_preference: 'engaged_listening',
              conversion_indicator: 'positive'
            }
          };
        }
        break;

      case 'VIP_VideoFullscreen':
        analyticsData = {
          event_type: 'video_fullscreen',
          video_percentage: (eventData.video_percentage as number) || 0,
          event_data: {
            ...eventData,
            engagement_level: 'high_intent',
            immersion_level: eventData.action === 'enter_fullscreen' ? 'full_immersion' : 'standard'
          }
        };
        break;

      case 'VIP_AccederButton_Click':
        analyticsData = {
          event_type: 'cta_click',
          video_percentage: 0,
          event_data: {
            ...eventData,
            cta_type: 'acceder_button',
            conversion_intent: 'high',
            funnel_stage: eventData.button_location === 'hero_section' ? 'awareness' : 'decision'
          }
        };
        vipEventData = {
          event_type: 'cta_engagement',
          event_data: {
            button_type: 'acceder',
            location: eventData.button_location,
            intent_level: 'high_purchase_intent',
            funnel_progression: true
          }
        };
        break;

      case 'VIP_StickyButton_Click':
        analyticsData = {
          event_type: 'sticky_cta_click',
          video_percentage: 0,
          event_data: {
            ...eventData,
            persistent_interest: true,
            scroll_engagement: true,
            conversion_intent: 'very_high'
          }
        };
        vipEventData = {
          event_type: 'persistent_engagement',
          event_data: {
            engagement_type: 'sticky_cta',
            scroll_position: eventData.scroll_position,
            user_behavior: 'persistent_interest',
            conversion_likelihood: 'high'
          }
        };
        break;

      case 'VIP_PlanView':
        analyticsData = {
          event_type: 'plan_view',
          video_percentage: 0,
          event_data: {
            ...eventData,
            product_interest: true,
            funnel_stage: 'consideration'
          }
        };
        vipEventData = {
          event_type: 'product_consideration',
          event_data: {
            plan_id: Array.isArray(eventData.content_ids) ? eventData.content_ids[0] : undefined,
            plan_name: eventData.content_name,
            plan_value: eventData.value,
            consideration_stage: 'active_evaluation'
          }
        };
        break;

      case 'VIP_PlanHover':
        analyticsData = {
          event_type: 'plan_hover',
          video_percentage: 0,
          event_data: {
            ...eventData,
            micro_engagement: true,
            interest_indicator: 'positive'
          }
        };
        break;

      default:
        // Handle custom events
        analyticsData = {
          event_type: eventType.toLowerCase(),
          video_percentage: (eventData.video_percentage as number) || 0,
          event_data: eventData
        };
    }

    // Insert video analytics
    const { error: analyticsError } = await supabase
      .from('video_analytics')
      .insert({
        user_id: userId || null,
        session_id: videoSessionId,
        video_percentage: analyticsData.video_percentage || 0,
        page_url: '/fantasy-vip-info',
        event_type: analyticsData.event_type,
        metadata: {
          ...enhancedMetadata,
          ...analyticsData.event_data
        },
        timestamp: new Date().toISOString()
      });

    // Insert VIP-specific events if present
    if (vipEventData) {
      await supabase
        .from('vip_events')
        .insert({
          session_id: videoSessionId,
          user_id: userId || null,
          event_type: vipEventData.event_type,
          event_data: vipEventData.event_data,
          timestamp: new Date().toISOString()
        });
    }

    if (analyticsError) {
      console.error('Enhanced video analytics error:', analyticsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      event_tracked: eventType,
      session_id: videoSessionId,
      vip_event_created: !!vipEventData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Enhanced video tracking API error:', error);
    return NextResponse.json({ 
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
