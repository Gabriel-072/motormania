// app/mmc-go/layout.tsx
'use client';

import SpecialHeader from '@/components/SpecialHeader';
import { ReactNode } from 'react';

export default function MMCGoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white pt-12">
      <SpecialHeader />
      <main className="pt-4 pb-24">
        {children}
      </main>
    </div>
  );
}