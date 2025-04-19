// components/FantasyAuthRequiredModalWrapper.tsx
'use client';

import { Suspense } from 'react';
import FantasyAuthRequiredModal from './FantasyAuthRequiredModal';

export default function FantasyAuthRequiredModalWrapper({ show }: { show: boolean }) {
  return (
    <Suspense fallback={null}>
      <FantasyAuthRequiredModal show={show} />
    </Suspense>
  );
}