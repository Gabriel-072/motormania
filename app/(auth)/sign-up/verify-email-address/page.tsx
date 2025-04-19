'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function VerifyEmailRedirectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const redirectUrl = searchParams.get('redirect_url') || '/dashboard';
    router.replace(redirectUrl);
  }, [searchParams, router]);

  return null;
}