// ============================================================================
// /app/api/analytics/video-tracking/route.ts
// PERFECTLY ALIGNED with YOUR existing VSL Player Events
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface VideoTrackingRequest {
  videoSessionId: string;
  eventType: string;
  eventData: Record<string, any>;
  pageType?: string;
  timestamp?: number;
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

    // Enhanced metadata
    const enhancedMetadata = {
      userAgent: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
      timestamp,
      pageType,
      source: 'vsl_player_enhanced'
    };

    // Process events from YOUR existing VSL player
    let analyticsData = {
      event_type: 'unknown',
      video_percentage: 0,
      event_data: {}
    };
    let vipEventData = null;

    switch (eventType) {
      // ========================================================================
      // YOUR EXISTING VIDEO PLAYER EVENTS
      // ========================================================================
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
            engagement_level: 'started'
          }
        };
        break;

      case 'VIP_VideoProgress_Detailed':
        const percentage = Number(eventData.video_percentage) || 0;
        analyticsData = {
          event_type: 'video_progress',
          video_percentage: percentage,
          event_data: {
            ...eventData,
            engagement_level: percentage >= 80 ? 'high' : percentage >= 50 ? 'medium' : 'low'
          }
        };

        // Auto-create VIP events for key milestones (matching your player logic)
        if (percentage === 25) {
          vipEventData = {
            event_type: 'video_quarter_milestone',
            event_data: {
              milestone: 25,
              attribution_value: 'medium',
              engagement_level: 'qualified_viewer'
            }
          };
        } else if (percentage === 75) {
          vipEventData = {
            event_type: 'video_mostly_complete',
            event_data: {
              milestone: 75,
              attribution_value: 'high',
              engagement_level: 'highly_engaged_viewer'
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
            lead_quality: 'medium'
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
            attribution_value: 'high'
          }
        };
        break;

      case 'VIP_VideoSeek':
        analyticsData = {
          event_type: 'video_seek',
          video_percentage: Number(eventData.seek_to) || 0,
          event_data: {
            ...eventData,
            seek_behavior: eventData.seek_direction === 'forward' ? 'skip_forward' : 'rewatch'
          }
        };
        break;

      case 'VIP_VideoAudio':
        analyticsData = {
          event_type: 'video_audio_toggle',
          video_percentage: Number(eventData.video_percentage) || 0,
          event_data: {
            ...eventData,
            audio_engagement_critical: eventData.action === 'unmuted'
          }
        };
        
        if (eventData.action === 'unmuted') {
          vipEventData = {
            event_type: 'audio_engagement_activated',
            event_data: {
              engagement_level: 'high_intent',
              audio_preference: 'engaged_listening'
            }
          };
        }
        break;

      case 'VIP_VideoFullscreen':
        analyticsData = {
          event_type: 'video_fullscreen',
          video_percentage: Number(eventData.video_percentage) || 0,
          event_data: {
            ...eventData,
            engagement_level: 'high_intent'
          }
        };
        break;

      case 'VIP_VideoResume':
        analyticsData = {
          event_type: 'video_resume',
          video_percentage: Number(eventData.resume_percentage) || 0,
          event_data: eventData
        };
        break;

      case 'VIP_VideoPause':
        analyticsData = {
          event_type: 'video_pause',
          video_percentage: Number(eventData.pause_percentage) || 0,
          event_data: eventData
        };
        break;

      // ========================================================================
      // YOUR EXISTING CONVERSION FUNNEL EVENTS
      // ========================================================================
      case 'VIP_AccederButton_Click':
        analyticsData = {
          event_type: 'cta_click',
          video_percentage: 0,
          event_data: {
            ...eventData,
            cta_type: 'acceder_button',
            conversion_intent: 'high'
          }
        };
        vipEventData = {
          event_type: 'cta_engagement',
          event_data: {
            button_type: 'acceder',
            location: eventData.button_location,
            intent_level: 'high_purchase_intent'
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
            conversion_intent: 'very_high'
          }
        };
        vipEventData = {
          event_type: 'persistent_engagement',
          event_data: {
            engagement_type: 'sticky_cta',
            user_behavior: 'persistent_interest'
          }
        };
        break;

      case 'VIP_PlanView':
        analyticsData = {
          event_type: 'plan_view',
          video_percentage: 0,
          event_data: {
            ...eventData,
            product_interest: true
          }
        };
        vipEventData = {
          event_type: 'product_consideration',
          event_data: {
            plan_id: Array.isArray(eventData.content_ids) ? eventData.content_ids[0] : eventData.content_ids,
            plan_name: eventData.content_name,
            plan_value: eventData.value
          }
        };
        break;

      case 'VIP_PlanHover':
        analyticsData = {
          event_type: 'plan_hover',
          video_percentage: 0,
          event_data: {
            ...eventData,
            micro_engagement: true
          }
        };
        break;

      case 'VIP_DeepScroll':
        analyticsData = {
          event_type: 'deep_scroll',
          video_percentage: 0,
          event_data: {
            ...eventData,
            engagement_depth: 'high'
          }
        };
        break;

      case 'VIP_ROI_Section_View':
        analyticsData = {
          event_type: 'roi_section_view',
          video_percentage: 0,
          event_data: {
            ...eventData,
            value_proposition_interest: true
          }
        };
        break;

      case 'VIP_StickyButton_Shown':
        analyticsData = {
          event_type: 'sticky_button_shown',
          video_percentage: 0,
          event_data: eventData
        };
        break;

      case 'VIP_PaymentModal_Open':
        analyticsData = {
          event_type: 'payment_modal_open',
          video_percentage: 0,
          event_data: {
            ...eventData,
            checkout_step: 2
          }
        };
        break;

      // ========================================================================
      // YOUR CUSTOM VIP EVENTS (from your handlers)
      // ========================================================================
      case 'VIP_lead_qualification':
        analyticsData = {
          event_type: 'lead_qualification',
          video_percentage: Number(eventData.video_percentage) || 20,
          event_data: eventData
        };
        vipEventData = {
          event_type: 'lead_qualification',
          event_data: eventData
        };
        break;

      case 'VIP_checkout_initiated':
        analyticsData = {
          event_type: 'checkout_initiated',
          video_percentage: 0,
          event_data: eventData
        };
        vipEventData = {
          event_type: 'checkout_initiated',
          event_data: eventData
        };
        break;

      case 'VIP_plan_view':
        analyticsData = {
          event_type: 'plan_view_custom',
          video_percentage: 0,
          event_data: eventData
        };
        vipEventData = {
          event_type: 'plan_view',
          event_data: eventData
        };
        break;

      // Default handler for any other events from your VSL
      default:
        const cleanEventType = eventType.toLowerCase().replace('vip_', '');
        analyticsData = {
          event_type: cleanEventType,
          video_percentage: Number(eventData.video_percentage) || 0,
          event_data: eventData
        };
        
        if (eventType.startsWith('VIP_')) {
          vipEventData = {
            event_type: cleanEventType,
            event_data: eventData
          };
        }
        break;
    }

    // ========================================================================
    // DATABASE OPERATIONS
    // ========================================================================

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
      console.error('Video analytics error:', analyticsError);
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
    console.error('Video tracking API error:', error);
    return NextResponse.json({ 
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}