// components/InfiniteLogoCarousel.tsx
'use client';

import React from 'react';
import Image from 'next/image';

interface Logo {
  name: string;
  src: string;
}

interface InfiniteLogoCarouselProps {
  topLineLogos: Logo[];
  middleLineLogos: Logo[];
  bottomLineLogos: Logo[];
  speed?: 'slow' | 'normal' | 'fast'; // Customizable speed
}

export function InfiniteLogoCarousel({ topLineLogos, middleLineLogos, bottomLineLogos, speed = 'normal' }: InfiniteLogoCarouselProps) {
  // Duplicate logos for seamless looping
  const duplicatedTopLogos = [...topLineLogos, ...topLineLogos];
  const duplicatedMiddleLogos = [...middleLineLogos, ...middleLineLogos];
  const duplicatedBottomLogos = [...bottomLineLogos, ...bottomLineLogos];

  // Map speed to animation duration
  const durationMap: Record<string, string> = {
    slow: '30s',
    normal: '20s',
    fast: '15s',
  };
  const duration = durationMap[speed];

  return (
    <div className="relative w-full">
      {/* Top Line: Left to Right */}
      <div className="overflow-hidden w-full mb-1 relative fade-mask"> {/* Kept fade-mask class */}
        <div className="flex animate-scroll-left space-x-4" style={{ '--duration': duration } as React.CSSProperties}>
          {duplicatedTopLogos.map((logo, index) => (
            <div
              key={`top-${index}`}
              className="flex-shrink-0 w-40 h-20 sm:w-48 sm:h-24 relative group"
            >
              <Image
                src={logo.src}
                alt={`${logo.name} partner logo`}
                fill
                className="object-contain drop-shadow-[0_0_5px_rgba(255,191,0,0.3)] group-hover:drop-shadow-[0_0_10px_rgba(255,191,0,0.5)] transition-all duration-300"
                priority
              />
              {(index + 1) % topLineLogos.length === 0 && (
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-12 bg-gray-600 opacity-50" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Middle Line: Right to Left */}
      <div className="overflow-hidden w-full mb-1 relative fade-mask"> {/* Kept fade-mask class */}
        <div className="flex animate-scroll-right space-x-4" style={{ '--duration': duration } as React.CSSProperties}>
          {duplicatedMiddleLogos.map((logo, index) => (
            <div
              key={`middle-${index}`}
              className="flex-shrink-0 w-40 h-20 sm:w-48 sm:h-24 relative group"
            >
              <Image
                src={logo.src}
                alt={`${logo.name} partner logo`}
                fill
                className="object-contain drop-shadow-[0_0_5px_rgba(255,191,0,0.3)] group-hover:drop-shadow-[0_0_10px_rgba(255,191,0,0.5)] transition-all duration-300"
                priority
              />
              {(index + 1) % middleLineLogos.length === 0 && (
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-12 bg-gray-600 opacity-50" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Line: Left to Right */}
      <div className="overflow-hidden w-full mt-1 relative fade-mask"> {/* Kept fade-mask class */}
        <div className="flex animate-scroll-left space-x-4" style={{ '--duration': duration } as React.CSSProperties}>
          {duplicatedBottomLogos.map((logo, index) => (
            <div
              key={`bottom-${index}`}
              className="flex-shrink-0 w-40 h-20 sm:w-48 sm:h-24 relative group"
            >
              <Image
                src={logo.src}
                alt={`${logo.name} partner logo`}
                fill
                className="object-contain drop-shadow-[0_0_5px_rgba(255,191,0,0.3)] group-hover:drop-shadow-[0_0_10px_rgba(255,191,0,0.5)] transition-all duration-300"
                priority
              />
              {(index + 1) % bottomLineLogos.length === 0 && (
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-12 bg-gray-600 opacity-50" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}