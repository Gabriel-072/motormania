'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStickyStore } from '../stores/stickyStore';

type StickyModalProps = {
  onFinish: () => Promise<void>;
};

const StickyModal: React.FC<StickyModalProps> = ({ onFinish }) => {
  const { showSticky, multiplier, potentialWin, picks } = useStickyStore();
  const combinedPicks = [...picks.qualy, ...picks.race];
  const totalPicks = combinedPicks.length;
  const isValid = totalPicks >= 2;
  const wager = 10000;

  const qualyCount = picks.qualy.length;
  const raceCount = picks.race.length;

  if (!showSticky) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-gray-900 to-black border-t border-amber-500/20 z-50 shadow-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm sm:text-base font-exo2 text-white">
          <span>
            <strong className="text-cyan-400">Multiplicador:</strong> {multiplier}X
          </span>
          <span>
            <strong className="text-green-400">Ganancia Potencial:</strong> ${potentialWin.toLocaleString('es-CO')} COP
          </span>
          <span>
            <strong className="text-amber-400">Picks:</strong> {combinedPicks.length} &nbsp;
            <span className="text-blue-400">({qualyCount} Qualy</span> ·{' '}
            <span className="text-red-400">{raceCount} Race)</span>
          </span>
          {multiplier > 0 && (
            <span className="text-lime-400 font-bold">
              ${wager.toLocaleString('es-CO')} gana ${(wager * multiplier).toLocaleString('es-CO')} COP
            </span>
          )}
        </div>
        <button
  onClick={onFinish}
  disabled={!isValid}
  className={`bg-amber-500 text-black font-bold px-6 py-2 rounded hover:bg-amber-400 transition-all duration-300 ${!isValid ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  Finalizar Picks
</button>
      </motion.div>
    </AnimatePresence>
  );
};

export default StickyModal;