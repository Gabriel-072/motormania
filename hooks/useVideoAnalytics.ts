// ============================================================================
// FILE 3: Enhanced useVideoAnalytics Hook
// /hooks/useVideoAnalytics.ts
// ============================================================================

import { useUser } from '@clerk/nextjs';
import { useCallback, useRef } from 'react';

export function useVideoAnalytics() {
  const { user } = useUser();
  const sessionId = useRef<string>('');
  const trackedPercentages = useRef<Set<number>>(new Set());

  // Generate session ID once
  if (!sessionId.current) {
    sessionId.current = `vip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  const trackVideoProgress = useCallback(async (percentage: number, metadata: any = {}) => {
    const roundedPercentage = Math.floor(percentage);
    
    // Track key milestones: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    const milestones = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const milestone = milestones.find(m => 
      roundedPercentage >= m && !trackedPercentages.current.has(m)
    );

    if (!milestone) return;

    trackedPercentages.current.add(milestone);

    try {
      const response = await fetch('/api/analytics/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.current,
          videoPercentage: milestone,
          pageUrl: window.location.pathname,
          eventType: 'video_progress',
          metadata: {
            ...metadata,
            milestone: milestone,
            browser: navigator.userAgent,
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            referrer: document.referrer,
            timestamp: Date.now()
          }
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Video tracking failed:', result);
      }

    } catch (error) {
      console.error('Video analytics tracking error:', error);
    }
  }, []);

  // Track specific VIP events
  const trackVipEvent = useCallback(async (eventType: string, eventData: any = {}) => {
    try {
      await fetch('/api/analytics/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.current,
          videoPercentage: eventData.videoPercentage || 0,
          pageUrl: window.location.pathname,
          eventType: eventType,
          metadata: {
            ...eventData,
            timestamp: Date.now(),
            event_source: 'vip_action'
          }
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