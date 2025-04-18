// app/mmc-go/page.tsx
import { Suspense } from 'react';
import MMCGoContent from '@/components/MMCGoContent';

export default function MMCGoPageWrapper() {
  return (
    <Suspense fallback={null}>
      <MMCGoContent />
    </Suspense>
  );
}
