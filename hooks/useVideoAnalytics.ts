// ============================================================================
// FILE 1: /hooks/useVideoAnalytics.ts
// ALIGNED with Enhanced VSL Player
// ============================================================================

import { useUser } from '@clerk/nextjs';
import { useCallback, useRef } from 'react';

export function useVideoAnalytics() {
  const { user } = useUser();
  const sessionId = useRef<string>('');

  // Generate session ID once - aligned with your video player
  if (!sessionId.current) {
    sessionId.current = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Track video progress - ALIGNED with your enhanced player events
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
  }, []);

  // Track VIP events - ALIGNED with your enhanced tracking
  const trackVipEvent = useCallback(async (eventType: string, eventData: any = {}) => {
    try {
      await fetch('/api/analytics/video-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoSessionId: sessionId.current,
          eventType: `VIP_${eventType}`,
          eventData,
          pageType: 'vip_landing_enhanced',
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('VIP event tracking error:', error);
    }
  }, []);

  return {
    trackVideoProgress,
    trackVipEvent,
    sessionId: sessionId.current
  };
}