// 📁 components/MMCGoSubHeader.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaWallet, FaQuestionCircle } from 'react-icons/fa';

type Props = {
  onOpenTutorial: () => void;
  isQualyView: boolean;
  isQualyEnabled: boolean;
  isRaceEnabled: boolean;
  setIsQualyView: (v: boolean) => void;
  setSession: (s: 'qualy' | 'race') => void;
  onSessionChange?: (s: 'qualy' | 'race') => void;
  soundManager: { click: { play: () => void } };
};

export default function MMCGoSubHeader({
  onOpenTutorial,
  isQualyView,
  isQualyEnabled,
  isRaceEnabled,
  setIsQualyView,
  setSession,
  onSessionChange,
  soundManager,
}: Props) {
  const router = useRouter();

  return (
    <AnimatePresence>
      <motion.div
        key="subHeader"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="fixed inset-x-0 top-0 z-50 bg-gradient-to-br from-gray-950 via-black to-gray-800 border-b border-amber-600/25"
      >
        {/* Contenedor para alinear con grid y countdown */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex w-full items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm font-exo2">
            {/* BOTÓN RECARGA YA */}
            <button
              onClick={() => router.push('/wallet')}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-2 rounded-full bg-amber-500 px-3 sm:px-5 py-2 font-bold text-black transition hover:scale-105 hover:bg-amber-400 active:scale-95 shadow-xl min-w-0"
            >
              <FaWallet className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">RECARGA&nbsp;YA</span>
            </button>

            {/* BOTÓN ¿CÓMO JUGAR? */}
            <button
              onClick={onOpenTutorial}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 sm:px-5 py-2 font-bold text-black transition hover:scale-105 active:scale-95 shadow-xl min-w-0"
            >
              <FaQuestionCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">¿CÓMO&nbsp;JUGAR?</span>
            </button>

            {/* TOGGLE QUALY / CARRERA - MEJORADO */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex-1 min-w-0"
            >
              <div className="relative flex w-full h-9 sm:h-10 items-center rounded-full bg-gray-800/90 p-0.5 sm:p-1 shadow-lg border border-gray-700/50">
                {/* Slider mejorado */}
                <motion.span
                  layout
                  className="absolute h-7 sm:h-8 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 shadow-md"
                  style={{
                    width: 'calc(50% - 2px)',
                    left: isQualyView ? '2px' : 'calc(50% + 0px)',
                  }}
                  animate={{ 
                    x: 0,
                    transition: { type: 'spring', stiffness: 400, damping: 35 }
                  }}
                />

                {/* Botón Qualy */}
                <button
                  disabled={!isQualyEnabled}
                  onClick={() => {
                    if (!isQualyView && isQualyEnabled) {
                      soundManager.click.play();
                      setIsQualyView(true);
                      setSession('qualy');
                      onSessionChange?.('qualy');
                    }
                  }}
                  className={`relative z-10 flex-1 text-center text-xs sm:text-sm font-semibold transition-all duration-200 rounded-full py-1.5 sm:py-2 px-1 sm:px-2 ${
                    !isQualyEnabled
                      ? 'cursor-not-allowed text-gray-500'
                      : isQualyView
                      ? 'text-white drop-shadow-sm'
                      : 'text-gray-300 hover:text-gray-100'
                  }`}
                >
                  <span className="block truncate">Qualy</span>
                </button>

                {/* Botón Carrera */}
                <button
                  disabled={!isRaceEnabled}
                  onClick={() => {
                    if (isQualyView && isRaceEnabled) {
                      soundManager.click.play();
                      setIsQualyView(false);
                      setSession('race');
                      onSessionChange?.('race');
                    }
                  }}
                  className={`relative z-10 flex-1 text-center text-xs sm:text-sm font-semibold transition-all duration-200 rounded-full py-1.5 sm:py-2 px-1 sm:px-2 ${
                    !isRaceEnabled
                      ? 'cursor-not-allowed text-gray-500'
                      : !isQualyView
                      ? 'text-white drop-shadow-sm'
                      : 'text-gray-300 hover:text-gray-100'
                  }`}
                >
                  <span className="block truncate">Carrera</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}