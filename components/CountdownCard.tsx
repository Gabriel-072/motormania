// components/CountdownCard.tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { GpSchedule } from '@/app/types/standings';

interface CountdownCardProps {
  currentGp: GpSchedule | null;
  qualyCountdown: { days: number; hours: number; minutes: number; seconds: number };
  raceCountdown: { days: number; hours: number; minutes: number; seconds: number };
  showQualy: boolean;
}

const gpFlags: Record<string, string> = {
  'Japanese Grand Prix': '/flags/japan.gif',
  'Monaco Grand Prix': '/flags/monaco.gif',
  'British Grand Prix': '/flags/uk.gif',
};

const formatCountdown = (countdown: { days: number; hours: number; minutes: number; seconds: number }) => {
  return `${String(countdown.days).padStart(2, '0')}d ${String(countdown.hours).padStart(2, '0')}h ${String(
    countdown.minutes
  ).padStart(2, '0')}m ${String(countdown.seconds).padStart(2, '0')}s`;
};

export default function CountdownCard({ currentGp, qualyCountdown, raceCountdown, showQualy }: CountdownCardProps) {
  return (
    <div
      className="animate-rotate-border rounded-xl p-px"
      style={{
        background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, red 20deg, white 30deg, red 40deg, transparent 50deg, transparent 360deg)`,
        animationDuration: '4s',
      }}
    >
      <div className="relative group bg-gradient-to-br from-[#1e3a8a] to-[#38bdf8] p-3 sm:p-4 rounded-xl shadow-lg z-10 min-h-40 flex flex-col justify-between overflow-hidden">
        {currentGp && gpFlags[currentGp.gp_name] && (
          <motion.img
            src={gpFlags[currentGp.gp_name]}
            alt={`Bandera ondeante de ${currentGp.gp_name}`}
            className="absolute inset-0 w-full h-full opacity-30 group-hover:opacity-100 transition-opacity duration-300 object-cover z-0"
            whileHover={{ rotate: 2, scale: 1.05 }}
            transition={{ duration: 0.3 }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-black/50 backdrop-blur-sm z-5 pointer-events-none" />
        <div className="relative z-10 flex flex-col justify-between h-full">
          <motion.h2
            className="text-sm sm:text-base font-bold text-white font-exo2 leading-tight mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {currentGp ? `Próximo GP: ${currentGp.gp_name}` : 'Próximo GP'}
          </motion.h2>
          <div className="flex flex-col items-center justify-center flex-grow gap-1">
            <p className="text-xs sm:text-sm font-exo2 text-white drop-shadow-md">
              {showQualy ? 'QUALY' : 'Carrera'}
            </p>
            <motion.p
              key={showQualy ? 'qualy' : 'race'}
              className="font-semibold text-lg sm:text-xl text-white drop-shadow-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              {showQualy ? formatCountdown(qualyCountdown) : formatCountdown(raceCountdown)}
            </motion.p>
          </div>
          <p className="text-white text-[10px] sm:text-xs font-exo2 leading-tight drop-shadow-md">
            {currentGp
              ? new Date(currentGp.race_time).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
              : 'Pendiente'}
          </p>
        </div>
      </div>
    </div>
  );
}