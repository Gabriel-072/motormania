// 📁 app/mmc-go/page.tsx
'use client';

import dynamic from 'next/dynamic';
import LoadingAnimation from '@/components/LoadingAnimation';

/**
 * Cargamos MMCGoContent únicamente en el navegador para
 * evitar el desajuste de hidratación (React error #300).
 */
const MMCGoContent = dynamic(
  () => import('@/components/MMCGoContent'),
  {
    ssr    : false,                                         // ⬅️  Sin render SSR
    loading: () => (
      <LoadingAnimation
        text="Cargando MMC-GO…"
        animationDuration={3}
      />
    ),
  }
);

export default function MMCGoPage() {
  return <MMCGoContent />;
}