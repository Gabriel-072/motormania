// ============================================================================
// /hooks/useVideoAnalytics.ts
// PERFECTLY ALIGNED with YOUR existing VSL Player Implementation
// ============================================================================

import { useUser } from '@clerk/nextjs';
import { useCallback, useRef } from 'react';

export function useVideoAnalytics() {
  const { user } = useUser();
  const sessionId = useRef<string>('');
  
  // Generate session ID once - matches your video player's sessionId generation
  if (!sessionId.current) {
    sessionId.current = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Core tracking function that sends to your existing API
  const trackVideoProgress = useCallback(async (percentage: number, metadata: any = {}) => {
    try {
      const response = await fetch('/api/analytics/video-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoSessionId: sessionId.current,
          eventType: 'VIP_VideoProgress_Detailed',
          eventData: {
            video_percentage: percentage,
            page_type: 'vip_landing_enhanced',
            video_source: 'vsl',
            user_type: user ? 'authenticated' : 'anonymous',
            session_id: sessionId.current,
            timestamp: Date.now(),
            ...metadata
          },
          pageType: 'vip_landing_enhanced',
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Video progress tracking failed:', error);
      }
    } catch (error) {
      console.error('Video analytics tracking error:', error);
    }
  }, [user]);

  // Track VIP events - designed to work with your existing handler functions
  const trackVipEvent = useCallback(async (eventType: string, eventData: any = {}) => {
    try {
      await fetch('/api/analytics/video-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoSessionId: sessionId.current,
          eventType: `VIP_${eventType}`,
          eventData: {
            ...eventData,
            session_id: sessionId.current,
            user_id: user?.id || null,
            timestamp: Date.now()
          },
          pageType: 'vip_landing_enhanced',
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('VIP event tracking error:', error);
    }
  }, [user]);

  return {
    trackVideoProgress,
    trackVipEvent,
    sessionId: sessionId.current
  };
}