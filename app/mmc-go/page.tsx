// app/mmc-go/page.tsx
import { Suspense } from 'react';
import MMCGoContent from '@/components/MMCGoContent';
import LoadingAnimation from '@/components/LoadingAnimation';

export default function MMCGoPageWrapper() {
  return (
    <Suspense fallback={<LoadingAnimation text="Cargando página MMC-GO..." animationDuration={3} />}>
      <MMCGoContent />
    </Suspense>
  );
}
