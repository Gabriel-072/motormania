// 📁 components/QuickEntryBanner.tsx
'use client';

import QuickEntryButton from '@/components/QuickEntryButton';
import { FaBolt } from 'react-icons/fa';
import { motion } from 'framer-motion';

type QuickEntryBannerProps = {
  qualyLines: any[];
  raceLines: any[];
  qualyEnabled: boolean;
  raceEnabled: boolean;
  onOpen: () => void;
};

export default function QuickEntryBanner({
  qualyLines,
  raceLines,
  qualyEnabled,
  raceEnabled,
  onOpen,
}: QuickEntryBannerProps) {
  const bannerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 150, damping: 25, delay: 0.1 },
    },
  };

  const iconContainerVariants = {
    initial: { scale: 1 },
    pulse: {
      scale: [1, 1.05, 1],
      filter: [
        'drop-shadow(0 0 2px rgba(251,191,36,0.4)) drop-shadow(0 0 4px rgba(251,191,36,0.3))',
        'drop-shadow(0 0 4px rgba(251,191,36,0.6)) drop-shadow(0 0 8px rgba(251,191,36,0.45))',
        'drop-shadow(0 0 2px rgba(251,191,36,0.4)) drop-shadow(0 0 4px rgba(251,191,36,0.3))',
      ],
      transition: {
        scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
        filter: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.1 },
      },
    },
  };

  return (
    <motion.div
      variants={bannerVariants}
      initial="hidden"
      animate="visible"
      className="
        col-span-full flex items-center justify-between gap-2 sm:gap-2.5
        rounded-xl bg-gradient-to-br from-neutral-900 via-[#202020] to-neutral-800
        p-2.5 ring-1 ring-amber-500/40 shadow-lg shadow-black/30
        overflow-hidden w-full
      "
    >
      {/* Izquierda: icono + texto */}
      <div className="flex items-center gap-2">
        <motion.div variants={iconContainerVariants} animate="pulse" className="flex-shrink-0">
          <FaBolt className="text-2xl text-amber-400" />
        </motion.div>
        <div className="text-left">
          <p className="text-xs font-medium uppercase text-gray-400 leading-tight">
            ENTRADA RÁPIDA
          </p>
          <p className="text-sm font-bold text-white leading-tight [text-shadow:0_0_5px_rgba(251,191,36,0.3)]">
            ¡8 picks aleatorios en un click!
          </p>
        </div>
      </div>

      {/* Derecha: botón con flags */}
      <div className="shrink-0">
        <QuickEntryButton
          qualyLines={qualyLines}
          raceLines={raceLines}
          qualyEnabled={qualyEnabled}
          raceEnabled={raceEnabled}
          onOpen={onOpen}
        />
      </div>
    </motion.div>
  );
}