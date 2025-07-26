//components/StickyModal.tsx
'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStickyStore } from '../stores/stickyStore';
// ✨ NEW: Currency imports
import { useCurrencyStore } from '../stores/currencyStore';
import { CurrencyDisplay } from './ui/CurrencyDisplay';
// Import icons
import { FaArrowRight, FaStar } from 'react-icons/fa';

type StickyModalProps = {
  onFinish: () => Promise<void>; // Function to call when finishing picks
};

// Constants
const MAX_PICKS = 8; // Maximum number of picks allowed
const MIN_PICKS = 2; // Minimum picks to be valid

const StickyModal: React.FC<StickyModalProps> = ({ onFinish }) => {
  // Get state from Zustand store
  const { showSticky, multiplier, picks } = useStickyStore();
  
  // ✨ NEW: Currency store
  const { initializeCurrency, isInitialized } = useCurrencyStore();

  // ✨ NEW: Initialize currency system on mount
  useEffect(() => {
    if (!isInitialized) {
      initializeCurrency();
    }
  }, [initializeCurrency, isInitialized]);

  // Calculate combined picks and counts
  const combinedPicks = [...picks.qualy, ...picks.race];
  const totalPicks = combinedPicks.length;

  // Determine if the button should be enabled and if max picks achieved
  const isValid = totalPicks >= MIN_PICKS;
  const isMaxPicks = totalPicks === MAX_PICKS; // Check for max picks
  const wager = 20000; // Base wager amount (adjust if dynamic)
  const potentialWin = isValid ? wager * multiplier : 0;

  // --- SVG Arc Calculation ---
  const radius = 20; // SVG circle radius
  const circumference = 2 * Math.PI * radius;
  // Calculate progress (0 to 1), starting only after MIN_PICKS - 1
  const progress = Math.max(0, Math.min(1, (totalPicks - (MIN_PICKS - 1)) / (MAX_PICKS - (MIN_PICKS - 1))));
  // Calculate the stroke offset for the progress arc
  const strokeDashoffset = circumference * (1 - progress);

  // Render nothing if the modal shouldn't be shown
  if (!showSticky) return null;

  // --- Tailwind Class Definitions ---

  // Base container styles
  const containerBaseClasses = `
    fixed bottom-4 inset-x-4 z-50 /* Positioning */
    border /* Base border */
    rounded-2xl /* More rounded */
    p-3 sm:p-4 /* Padding */
    flex items-center justify-between gap-4 /* Horizontal layout */
    transition-all duration-500 ease-out /* Smooth transition for style changes */
  `;
  // Conditional container styles for normal vs max picks (using solid colors)
  const containerClasses = `
    ${containerBaseClasses}
    ${isMaxPicks
      ? 'bg-gradient-to-t from-amber-950 via-yellow-900 to-amber-800 border-yellow-500 shadow-[0_0_25px_rgba(250,204,21,0.5)]' // Golden gradient, border, shadow
      : 'bg-gradient-to-t from-black via-[#111827] to-gray-900 border-gray-700 shadow-[0_0_20px_rgba(0,191,255,0.25)]' // Default solid gradient, border, shadow
    }
  `;

  const leftSectionClasses = `
    flex items-center gap-3 sm:gap-4 /* Layout for multiplier block and text */
  `;

  // Base multiplier block styles
  const multiplierBlockBaseClasses = `
    relative w-14 h-14 sm:w-16 sm:h-16 /* Size */
    flex items-center justify-center
    rounded-xl /* Rounded corners */
    border
    flex-shrink-0 /* Prevent shrinking */
    shadow-inner /* Inner shadow for depth */
    transition-colors duration-500 ease-out
  `;
   // Conditional multiplier block styles (using solid colors)
  const multiplierBlockClasses = `
    ${multiplierBlockBaseClasses}
    ${isMaxPicks
      ? 'bg-yellow-900 border-amber-600' // Golden state
      : 'bg-gray-800 border-gray-600' // Default state
    }
  `;

   // Base multiplier text styles
   const multiplierTextBaseClasses = `
     font-bold text-lg sm:text-xl leading-none
     bg-clip-text text-transparent /* Base for gradient */
     relative z-10 /* Ensure text is above SVG */
     transition-all duration-500 ease-out
   `;
   // Conditional multiplier text styles
   const multiplierTextClasses = `
     ${multiplierTextBaseClasses}
     ${isMaxPicks
       ? 'bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 scale-105' // Brighter gold gradient, slight scale up
       : 'bg-gradient-to-r from-amber-400 to-orange-400' // Default gradient
     }
   `;

   const wagerWinTextClasses = `
     text-sm sm:text-base font-medium leading-tight
     ${isMaxPicks ? 'text-amber-100' : 'text-gray-200'} /* Brighter text for max */
   `;
   const wagerWinAmountClasses = `
     font-semibold
     ${isMaxPicks ? 'text-yellow-300' : 'text-green-400'} /* Yellow for max, green default */
   `;

   // Base button styles
  const buttonBaseClasses = `
    text-white /* White text */
    font-bold text-sm sm:text-base
    pl-3 pr-4 py-2 sm:pl-4 sm:pr-5 sm:py-2.5 /* Adjusted Padding */
    rounded-full /* Fully rounded */
    shadow-lg
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 /* Focus state */
    transition-all duration-300 ease-out /* Smoother transition */
    flex items-center justify-center gap-2 /* Icon/text layout */
    disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none /* Base disabled */
    flex-shrink-0
  `;
   // Conditional button styles (using solid colors for disabled state)
  const buttonClasses = `
    ${buttonBaseClasses}
    ${isMaxPicks
      ? 'bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 hover:shadow-yellow-400/40 focus:ring-amber-400 disabled:bg-amber-800 disabled:from-amber-800 disabled:to-orange-800 text-black' // Golden button, black text, solid disabled
      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-cyan-400/30 focus:ring-cyan-400 disabled:bg-gray-700 disabled:from-gray-700 disabled:to-gray-800 text-white' // Default cyan button, white text, solid disabled
    }
  `;

  // Pick count circle styles (using solid colors)
  const pickCountCircleClasses = `
    w-6 h-6 sm:w-7 sm:h-7
    flex items-center justify-center
    bg-black text-white /* Solid black circle */
    rounded-full
    text-xs sm:text-sm font-bold
    border ${isMaxPicks ? 'border-yellow-400' : 'border-cyan-400'} /* Conditional solid border */
  `;

  // --- JSX Return ---
  return (
    <AnimatePresence>
      <motion.div
        key="sticky-modal-currency-enabled" // Updated key
        initial={{ y: "110%", opacity: 0 }}
        animate={{ y: "0%", opacity: 1 }}
        exit={{ y: "110%", opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className={containerClasses} // Apply dynamic container styles
      >
        {/* Left Section: Multiplier + Wager/Win */}
        <div className={leftSectionClasses}>
          {/* Multiplier Block with Progress Arc */}
          <motion.div
             className={multiplierBlockClasses} // Apply dynamic block styles
             animate={isMaxPicks ? { scale: [1, 1.05, 1] } : { scale: 1 }}
             transition={isMaxPicks ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          >
            {/* SVG for Progress Arc */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 44 44">
              {/* Background track */}
              <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3" stroke="rgba(75, 85, 99, 0.7)" /> {/* Darker gray track */}
              {/* Progress arc - Animated */}
              <motion.circle
                cx="22" cy="22" r={radius}
                fill="none"
                strokeWidth="3.5"
                stroke={isMaxPicks ? "url(#maxProgressGradient)" : "url(#progressGradient)"}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: strokeDashoffset }}
                transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                transform="rotate(-90 22 22)"
              />
              {/* Define the gradients */}
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fde047" /> {/* yellow-300 */}
                  <stop offset="100%" stopColor="#facc15" /> {/* yellow-400 */}
                </linearGradient>
                 <linearGradient id="maxProgressGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fef9c3" /> {/* yellow-100 */}
                  <stop offset="100%" stopColor="#fbbf24" /> {/* amber-400 */}
                </linearGradient>
              </defs>
            </svg>
            {/* Multiplier Text */}
            <motion.span
              className={multiplierTextClasses} // Apply dynamic text styles
              animate={isMaxPicks ? { scale: [1, 1.1, 1] } : { scale: 1 }}
              transition={isMaxPicks ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            >
              {multiplier}X
            </motion.span>
          </motion.div>

          {/* ✨ UPDATED: Wager Wins Text with Currency Display */}
          <div className="flex flex-col items-start">
             <span className={wagerWinTextClasses}> {/* Dynamic text color */}
               <CurrencyDisplay copAmount={wager} /> gana
             </span>
             <motion.span
                key={potentialWin} // Animate when value changes
                initial={{ opacity: 0.5, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`${wagerWinAmountClasses} text-lg sm:text-xl tabular-nums`} // Dynamic text color + styles
             >
                 <CurrencyDisplay copAmount={potentialWin} suffix="!" />
             </motion.span>
          </div>
        </div>

        {/* Right Section: Finish Button */}
        <motion.button
          onClick={async () => {
            if (!isValid) return;
            try {
              await onFinish();
            } catch (error) {
              console.error('Error opening full modal:', error);
            }
          }}
          disabled={!isValid}
          className={buttonClasses} // Apply dynamic button styles
          initial={false}
          animate={isValid ? { scale: [1, 1.03, 1], opacity: 1 } : { scale: 1, opacity: 0.5 }} // Adjusted pop animation
          transition={{ duration: 0.4, ease: 'backInOut' }}
        >
          {/* Pick Count Circle */}
          <span className={pickCountCircleClasses}> {/* Dynamic border */}
            {isMaxPicks ? <FaStar className="w-3 h-3 text-yellow-300" /> : totalPicks} {/* Show star or number */}
          </span>
          {/* Button Text */}
          <span className="hidden sm:inline">
             {isMaxPicks ? "¡MAX WIN!" : "Finalizar Picks"} {/* Change text on max */}
          </span>
           <span className="sm:hidden">
             {isMaxPicks ? "¡MAX!" : "Finalizar"} {/* Shorter text for small screens */}
          </span>
          {/* <FaArrowRight className="ml-1 text-xs" /> */}
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
};

export default StickyModal;