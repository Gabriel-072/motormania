'use client';

import { Suspense, useEffect } from 'react';
import AuthRequiredModal from '@/components/AuthRequiredModal';

export default function AuthRequiredModalWrapper({ show }: { show: boolean }) {
  useEffect(() => {
    if (show) {
      console.log('🧩 Wrapper está mostrando el modal');
    }
  }, [show]);

  return (
    <Suspense fallback={null}>
      <AuthRequiredModal show={show} />
    </Suspense>
  );
}