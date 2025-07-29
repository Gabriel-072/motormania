//app/(auth)/sign-up/verify-email-address/page.tsx
'use client';

import { Suspense } from 'react';
import VerifyEmailRedirectHandler from './redirect-handler';

export default function VerifyEmailRedirectPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailRedirectHandler />
    </Suspense>
  );
}