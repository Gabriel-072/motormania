// hooks/useRegistrationTracking.ts
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { trackFBEvent } from '@/lib/trackFBEvent';

export function useRegistrationTracking() {
  const { isSignedIn, isLoaded, user } = useUser();
  const searchParams = useSearchParams();

  useEffect(() => {
    const from = searchParams.get('from');
    const alreadyTracked = sessionStorage.getItem('mmc-registration-tracked');

    if (
      isSignedIn &&
      isLoaded &&
      from === 'signup' &&
      !alreadyTracked &&
      typeof window !== 'undefined'
    ) {
      try {
        const email = user?.emailAddresses[0]?.emailAddress || '';
        const eventId = `evt_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

        // 🎯 Meta Pixel + CAPI (CompleteRegistration, RegistroMMC)
        trackFBEvent('CompleteRegistration', {
          params: { userId: user?.id },
          email,
          event_id: eventId,
        });

        trackFBEvent('RegistroMMC', {
          params: { userId: user?.id },
          email,
          event_id: eventId,
        });

        // ✅ Marcar como enviado
        sessionStorage.setItem('mmc-registration-tracked', 'true');
      } catch (err) {
        console.error('❌ Error in registration tracking:', err);
      }
    }
  }, [isSignedIn, isLoaded, searchParams, user]);
}