'use client';

import { useFomoFake } from '@/lib/useFomoFake'; // Ensure this path is correct
import { motion, AnimatePresence } from 'framer-motion';
import { FaBolt } from 'react-icons/fa';

/**
 * World-class gamer style FOMO notification bar.
 * Aligned with StickyModal's corner roundness, width, and positioned consistently above it.
 * Features a dark theme, pulsating glowing accents, pulsating icon, and an enhanced subtle shimmer effect.
 * Ensure 'Exo 2' font is configured in Tailwind for 'font-exo2' to apply.
 */
export default function FomoBar() {
  const msg = useFomoFake(3000); // Message rotation duration

  // Bar animation (entrance/exit, and pulsating glow)
  const barVariants = {
    hidden: {
      opacity: 0,
      y: 25,
      scale: 0.95,
      boxShadow: "0 0 10px 0px rgba(250,204,21,0.0), inset 0 0 5px rgba(250,204,21,0.0)" // Initial faint shadow
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      boxShadow: [ // Pulsating shadow
        "0 0 20px 3px rgba(250,204,21,0.20), inset 0 0 10px rgba(250,204,21,0.10)",
        "0 0 28px 4px rgba(250,204,21,0.28), inset 0 0 14px rgba(250,204,21,0.14)", // Peak of pulse
        "0 0 20px 3px rgba(250,204,21,0.20), inset 0 0 10px rgba(250,204,21,0.10)",
      ],
      transition: {
        // Default spring transition for opacity, y, scale
        default: { type: 'spring', stiffness: 180, damping: 20, delay: 0.1 },
        // Specific transition for boxShadow pulsing
        boxShadow: {
          duration: 2.2, // Duration of one pulse cycle
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.1, // Start shadow pulse with or shortly after entrance
          repeatDelay: 0.5, // Pause between pulse cycles
        },
      },
    },
    exit: {
      opacity: 0,
      y: 25,
      scale: 0.95,
      boxShadow: "0 0 10px 0px rgba(250,204,21,0.0), inset 0 0 5px rgba(250,204,21,0.0)", // Fade out shadow
      transition: { duration: 0.2 }
    },
  };

  // Text animation (message change)
  const textVariants = {
    hidden: { opacity: 0, y: -8 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 18, duration: 0.25 } },
    exit: { opacity: 0, y: 8, transition: { duration: 0.15 } },
  };

  // Icon pulsation
  const iconPulseVariants = {
    pulse: {
      scale: [1, 1.15, 1],
      filter: ['brightness(1.1)', 'brightness(1.6)', 'brightness(1.1)'],
      transition: {
        duration: 1.8,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  if (!msg) {
    return null;
  }

  return (
    <motion.div
      key="gamer-fomo-bar-enhanced"
      variants={barVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="
        fixed
        /*
         * Positioning above StickyModal (bottom-4 / 1rem) with a 1rem gap:
         * StickyModal small height (p-3 + h-14 content = 12+56+12 = 80px = 5rem). FomoBar bottom: 1rem (modal offset) + 5rem (modal height) + 1rem (gap) = 7rem.
         * StickyModal large height (sm:p-4 + sm:h-16 content = 16+64+16 = 96px = 6rem). FomoBar bottom: 1rem (modal offset) + 6rem (modal height) + 1rem (gap) = 8rem.
         */
        bottom-[7rem] sm:bottom-[8rem]
        left-4 right-4             /* Viewport placement, same effective width as inset-x-4 */
        z-[60]                     /* Stacking context (above StickyModal z-50) */
        h-11                       /* Height of the bar */
        rounded-2xl                /* Matched corner roundness with StickyModal */
        bg-neutral-900             /* Base dark background */
        ring-1 ring-amber-500/60   /* Sharp amber accent ring */
        /* Shadow is now handled by framer-motion variants for animation */
        flex items-center justify-center /* Content alignment */
        px-4                       /* Horizontal padding */
        select-none pointer-events-none  /* Non-interactive */
        overflow-hidden            /* Contains the shimmer effect */
      "
    >
      {/* Shimmer Overlay Effect */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none z-0"> {/* Ensure shimmer is clipped by rounded corners */}
        <motion.div
          className="absolute top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-amber-400/12 to-transparent" /* Enhanced amber shimmer */
          style={{ transform: 'skewX(-25deg)' }} // Angled shimmer
          initial={{ x: '-150%' }} // Start off-screen to the left
          animate={{ x: '250%' }}  // Animate across to off-screen to the right
          transition={{
            duration: 3.5,       // Duration of one shimmer sweep
            repeat: Infinity,
            ease: 'linear',
            delay: Math.random() * 1.5 + 0.5, // Staggered start
            repeatDelay: 2.0     // Pause between shimmer repeats
          }}
        />
      </div>

      {/*Content Layer (Icon and Text) - Must be above shimmer*/}
      <div className="relative z-10 flex items-center justify-center w-full">
        <motion.div variants={iconPulseVariants} animate="pulse">
          <FaBolt className="mr-2.5 flex-shrink-0 text-amber-400" size={16} />
        </motion.div>
        <AnimatePresence mode="wait"> {/* Ensures smooth text transitions */}
          <motion.span
            key={msg} // Crucial for AnimatePresence to detect message changes
            variants={textVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="
              truncate font-exo2 font-semibold  /* Exo 2 font, semibold; ensure font is configured */
              text-sm sm:text-base             /* Text size */
              text-gray-100                    /* Bright white text for contrast */
              [text-shadow:0_0_10px_rgba(250,204,21,0.5),_0_0_2px_rgba(255,220,150,0.7)] /* Enhanced amber text glow */
            "
          >
            {msg}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}