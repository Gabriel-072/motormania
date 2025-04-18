// components/AuthRequiredModalWrapper.tsx
'use client';

import { Suspense } from 'react';
import AuthRequiredModal from './AuthRequiredModal';

export default function AuthRequiredModalWrapper({ show }: { show: boolean }) {
  return (
    <Suspense fallback={null}>
      <AuthRequiredModal show={show} />
    </Suspense>
  );
}