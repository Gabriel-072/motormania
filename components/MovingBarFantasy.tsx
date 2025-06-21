// components/MovingBarFantasy.tsx
'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';

export default function MovingBarFantasy() {
  const pathname = usePathname();
  if (pathname !== '/fantasy-vip' && pathname !== '/fantasy-vip-info') return null;

  /* ─── mensaje + separador ─── */
  const message =
  '¡Activa tu Pase VIP, compite por premios en efectivo, merch y un viaje a un GP de la F1 en 2026!';
  const separator = ' • ';

  /* ─── duplicamos texto para el loop ─── */
  const repeats = useMemo(() => Array.from({ length: 12 }), []);

  return (
    <>
      <style jsx>{`
        @keyframes scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .moving-bar {
          display: inline-flex;
          white-space: nowrap;
          animation: scroll 55s linear infinite;
        }
        .moving-bar:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div
        className="
          fixed top-0 left-0 w-full h-8 z-[60]
          bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500
          overflow-hidden shadow-md
        "
      >
        <div className="moving-bar h-full">
          {repeats.map((_, i) => (
            <span
              key={i}
              className="flex-shrink-0 flex items-center h-full px-4 text-sm font-semibold text-black"
            >
              {message}
              {separator}
            </span>
          ))}
          {/* segunda copia para el loop continuo */}
          {repeats.map((_, i) => (
            <span
              key={`dup-${i}`}
              className="flex-shrink-0 flex items-center h-full px-4 text-sm font-semibold text-black"
            >
              {message}
              {separator}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}