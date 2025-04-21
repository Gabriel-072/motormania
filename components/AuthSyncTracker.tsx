// components/AuthSyncTracker.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { trackFBEvent } from '@/lib/trackFBEvent';

export default function AuthSyncTracker() {
  const { isSignedIn, user } = useUser();
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (
      isSignedIn &&
      user?.primaryEmailAddress?.emailAddress &&
      !hasTrackedRef.current &&
      typeof window !== 'undefined'
    ) {
      try {
        const email = user.primaryEmailAddress.emailAddress;

        // 🔁 Asociar eventos previos con usuario autenticado
        trackFBEvent('Lead', { email, forceRetrack: true });
        trackFBEvent('IntentoPrediccion', { email, forceRetrack: true });

        hasTrackedRef.current = true; // Prevent re-tracking
      } catch (err) {
        console.error('❌ Error in AuthSync tracking:', err);
      }
    }
  }, [isSignedIn, user]);

  return null;
}