// app/mmc-go/layout.tsx
import SpecialHeader from '@/components/SpecialHeader';
import { ReactNode } from 'react';

export default function MMCGoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      {/* Esto debería salir SIEMPRE en /mmc-go */}
      <SpecialHeader />

      {/* Aquí se inyecta tu MMCGoContent */}
      <main className="pt-12 pb-24">
        {children}
      </main>
    </div>
  );
}
