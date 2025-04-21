'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { trackFBEvent } from '@/lib/trackFBEvent';

export default function AuthSyncTracker() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (isSignedIn && user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;

      // 🔁 Asociar eventos previos con usuario autenticado
      trackFBEvent('Lead', { email, forceRetrack: true });
      trackFBEvent('IntentoPrediccion', { email, forceRetrack: true });
    }
  }, [isSignedIn, user]);

  return null;
}