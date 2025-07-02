import { useUser } from '@clerk/nextjs';
import { useCallback, useRef } from 'react';

export function useVideoAnalytics() {
  const { user } = useUser();
  const sessionId = useRef<string>('');
  const trackedPercentages = useRef<Set<number>>(new Set());

  // Generate session ID once
  if (!sessionId.current) {
    sessionId.current = `vsl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  const trackVideoProgress = useCallback(async (percentage: number) => {
    const roundedPercentage = Math.floor(percentage);
    
    // Track key milestones: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    const milestones = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const milestone = milestones.find(m => 
      roundedPercentage >= m && !trackedPercentages.current.has(m)
    );

    if (!milestone) return;

    trackedPercentages.current.add(milestone);

    try {
      await fetch('/api/analytics/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.current,
          videoPercentage: milestone,
          pageUrl: window.location.pathname
        })
      });
    } catch (error) {
      console.error('Video analytics tracking error:', error);
    }
  }, []);

  return {
    trackVideoProgress,
    sessionId: sessionId.current
  };
}