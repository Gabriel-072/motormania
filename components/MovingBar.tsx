// components/MovingBar.tsx
'use client';

import React from 'react';

export default function MovingBar() {
  const message = "Participa ahora por un Coleccionable Lego McLaren P1";
  const separator = " • ";

  // repeat enough times to guarantee coverage; you can bump this up if your message is very short
  const repeats = Array.from({ length: 12 });

  return (
    <>
      <style jsx>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .moving-bar {
          display: inline-flex;
          white-space: nowrap;
          animation: scroll 60s linear infinite;
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
              {message}{separator}
            </span>
          ))}
          {/* second copy for the seamless loop */}
          {repeats.map((_, i) => (
            <span
              key={`dup-${i}`}
              className="flex-shrink-0 flex items-center h-full px-4 text-sm font-semibold text-black"
            >
              {message}{separator}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}