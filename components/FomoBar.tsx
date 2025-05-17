// components/FomoBar.tsx
'use client';

import { useFomoFake } from '@/lib/useFomoFake';
import { useStickyStore } from '@/stores/stickyStore';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBolt } from 'react-icons/fa';

const HEADER_H = 4;   // h-16
const GAP = 0.25;     // 0.25rem (≈4 px)

export default function FomoBar() {
  const msg = useFomoFake(3000);
  const { picks } = useStickyStore();
  const total = picks ? [...picks.qualy, ...picks.race].length : 0;
  if (total < 1 || !msg) return null;

  /* Animaciones */
  const barVariants = {
    hidden: { opacity: 0, y: -16, scale: 0.95 },
    visible: {
      opacity: 1, y: 0, scale: 1,
      transition: { default: { type: 'spring', stiffness: 180, damping: 20, delay: 0.05 } },
    },
    exit: { opacity: 0, y: -16, scale: 0.95, transition: { duration: 0.2 } },
  };
  const textVariants = {
    hidden: { opacity: 0, y: -8 },
    visible: {
      opacity: 1, y: 0,
      transition: { type: 'spring', stiffness: 200, damping: 18, duration: 0.25 },
    },
    exit: { opacity: 0, y: 8, transition: { duration: 0.15 } },
  };
  const iconPulse = {
    pulse: {
      scale: [1, 1.15, 1],
      filter: ['brightness(1.1)', 'brightness(1.6)', 'brightness(1.1)'],
      transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
    },
  };

  return (
    /* ───── Sticky wrapper: controla la posición, no el ancho ───── */
    <div
      className="sticky z-40 pointer-events-none"
      style={{ top: `calc(${HEADER_H}rem + ${GAP}rem)` }}
    >
      {/* ───── Container: iguala ancho y paddings al layout ───── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          key="fomo-bar"
          variants={barVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="
            w-full h-11             /* mismo grosor, ancho = container */
            rounded-2xl bg-neutral-900 ring-1 ring-amber-500/60
            flex items-center justify-center
            overflow-hidden
          "
        >
          {/* Shimmer */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl z-0 pointer-events-none">
            <motion.div
              className="absolute top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-amber-400/12 to-transparent"
              style={{ transform: 'skewX(-25deg)' }}
              initial={{ x: '-150%' }}
              animate={{ x: '250%' }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: 'linear',
                delay: Math.random() * 1.5 + 0.5,
                repeatDelay: 2,
              }}
            />
          </div>

          {/* Contenido */}
          <div className="relative z-10 flex items-center">
            <motion.div variants={iconPulse} animate="pulse">
              <FaBolt className="mr-2.5 flex-shrink-0 text-amber-400" size={16} />
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.span
                key={msg}
                variants={textVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="
                  truncate font-exo2 font-semibold
                  text-sm sm:text-base text-gray-100
                  [text-shadow:0_0_10px_rgba(250,204,21,0.5),_0_0_2px_rgba(255,220,150,0.7)]
                "
              >
                {msg}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}