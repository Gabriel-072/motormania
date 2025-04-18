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
      // 🎯 Meta Pixel estándar
      window.fbq?.('track', 'CompleteRegistration');
      window.fbq?.('trackCustom', 'RegistroMMC');

      // 🔥 Meta CAPI
      fetch('/api/fb-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'CompleteRegistration',
          event_source_url: window.location.href,
          // Opcional: puedes incluir hashed_email si lo tienes disponible en algún contexto
        }),
      })
        .then(res => res.json())
        .then(res => console.log('📡 CAPI Event Sent:', res))
        .catch(err => console.error('❌ Error CAPI:', err));

      // ✅ Marcar como enviado
      sessionStorage.setItem('mmc-registration-tracked', 'true');
    }
  }, [isSignedIn, isLoaded, searchParams]);
}