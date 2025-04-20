// app/(auth)/sign-up/verify-email-address/redirect-handler.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import LoadingAnimation from '@/components/LoadingAnimation';

export default function VerifyEmailRedirectHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [readyToRedirect, setReadyToRedirect] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setReadyToRedirect(true);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!readyToRedirect) return;

    const redirectUrl = searchParams.get('redirect_url') || '/dashboard';
    console.log('Redirecting to:', redirectUrl); // Debug log
    router.replace(redirectUrl);
  }, [readyToRedirect, searchParams, router]);

  return <LoadingAnimation text="¡Verificación completada! Redirigiendo..." animationDuration={3} />;
}