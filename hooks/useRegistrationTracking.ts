'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

export function useRegistrationTracking() {
  const { isSignedIn, isLoaded } = useUser();
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
      // 🔥 Pixel normal
      window.fbq?.('track', 'CompleteRegistration');
      window.fbq?.('trackCustom', 'RegistroMMC');

      // 🔥 Conversions API
      fetch('/api/fb-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'CompleteRegistration',
          event_source_url: window.location.href,
        }),
      });

      // ✅ Guardamos para que no se dispare de nuevo
      sessionStorage.setItem('mmc-registration-tracked', 'true');
    }
  }, [isSignedIn, isLoaded, searchParams]);
}