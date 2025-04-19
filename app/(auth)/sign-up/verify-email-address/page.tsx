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