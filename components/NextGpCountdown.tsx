// components/NextGpCountdown.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper Functions ---
const formatCountdownDetailed = (time: CountdownTime): string => {
  if (time.days <= 0 && time.hours <= 0 && time.minutes <= 0 && time.seconds <= 0) {
    return "¡CERRADO!";
  }
  const h = String(time.hours).padStart(2, '0');
  const m = String(time.minutes).padStart(2, '0');
  const s = String(time.seconds).padStart(2, '0');
  if (time.days > 0) {
    return `${time.days}d ${h}:${m}:${s}`;
  }
  return `${h}:${m}:${s}`;
};

const formatDisplayDateCompact = (date: Date): string => {
  let formattedDate = date.toLocaleDateString('es-CO', {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Bogota',
  });
  // Capitalizar primera letra del mes y remover espacio antes de AM/PM
  formattedDate = formattedDate.replace(/^\w/, c => c.toUpperCase()).replace(/\s(?=[ap]\.?m\.?)/i, '');
  return formattedDate.replace(/\.$/, ''); // Remover punto final si existe (ej. p.m.)
};

// --- Type Definitions ---
interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}
interface GpInfo {
  gp_name: string;
  qualy_time: string;
  race_time: string;
  [key: string]: any;
}
interface NextGpCountdownProps {
  currentGp: GpInfo | null;
  isQualyView: boolean;
  gpFlags?: { [key: string]: string };
}

// --- Component Definition ---
export default function NextGpCountdown({
  currentGp,
  isQualyView,
  gpFlags = {},
}: NextGpCountdownProps) {
  const [countdown, setCountdown] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!currentGp) {
      setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }
    const targetDateString = isQualyView ? currentGp.qualy_time : currentGp.race_time;
    const targetTime = new Date(targetDateString);
    let intervalId: number | undefined = undefined;
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetTime.getTime() - now.getTime();
      if (diff > 0) {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        if (typeof intervalId === 'number') clearInterval(intervalId);
      }
    };
    updateCountdown();
    intervalId = window.setInterval(updateCountdown, 1000);
    return () => {
      if (typeof intervalId === 'number') clearInterval(intervalId);
    };
  }, [currentGp, isQualyView]);

  if (!currentGp) {
    return (
      <div className="flex items-center justify-center p-3 bg-gradient-to-r from-slate-800/90 to-slate-700/80 rounded-lg shadow-lg w-full min-h-[60px] border border-slate-600/80">
        <p className="text-xs text-slate-300">Cargando próximo GP...</p>
      </div>
    );
  }

  const eventTypeLabel = isQualyView ? 'Qualy' : 'Carrera';
  const displayDate = isQualyView ? new Date(currentGp.qualy_time) : new Date(currentGp.race_time);
  const flagSrc = gpFlags[currentGp.gp_name];
  const countdownKey = currentGp.gp_name + (isQualyView ? '-qualy' : '-race');

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-900/90 via-purple-950/20 to-slate-900/90 backdrop-blur-sm rounded-lg shadow-xl hover:shadow-purple-500/30 w-full border border-purple-700/40 hover:border-purple-600/60 transition-all duration-300 ease-out group">
      {/* Left Section: GP Info */}
      <div className="flex items-center gap-2.5 min-w-0"> {/* Aumentado gap aquí */}
        {flagSrc && (
          <img
            src={flagSrc}
            alt={`${currentGp.gp_name} flag`}
            className="h-6 w-auto rounded-sm flex-shrink-0 shadow-md group-hover:scale-105 transition-transform duration-300" // Bandera un poco más grande y con efecto hover
            style={{ aspectRatio: '3/2', objectFit: 'cover' }}
          />
        )}
        <div className="truncate">
          <h2 className="text-sm sm:text-md font-semibold text-slate-100 group-hover:text-white transition-colors duration-300 truncate" title={currentGp.gp_name}>
            {currentGp.gp_name}
          </h2>
          <span className="inline-block mt-0.5 bg-purple-600/90 text-purple-50 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full tracking-normal shadow-sm">
            {eventTypeLabel.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Right Section: Countdown & Date */}
      <div className="text-right flex-shrink-0 pl-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={countdownKey}
            className="font-mono text-md sm:text-lg font-extrabold text-white tracking-tight group-hover:text-purple-300 transition-colors duration-300" // Contador más grande y grueso, cambio de color en hover
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2, ease: 'circOut' }}
          >
            {formatCountdownDetailed(countdown)}
          </motion.p>
        </AnimatePresence>
        <p className="text-[10px] sm:text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors duration-300 leading-tight pt-0.5">
          {formatDisplayDateCompact(displayDate)}
        </p>
      </div>
    </div>
  );
}