'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTrophy,
  FaCrown,
  FaBolt,
  FaRocket
} from 'react-icons/fa';
import { GiF1Car, GiCheckeredFlag } from 'react-icons/gi';

/* ──────────────── Tipos ──────────────── */
type Winner = {
  id: string;
  name: string;
  username: string;
  total: number;
};

/* ──────────────── Componente ──────────────── */
export default function F1GiveawaySelector() {
  /* Estado */
  const [step, setStep] = useState<
    'intro' | 'start' | 'loading' | 'counting' | 'drumroll' | 'revealed'
  >('intro');
  const [count, setCount] = useState(0);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [spotlightPosition, setSpotlightPosition] = useState({ x: 0, y: 0 });
  const mainRef = useRef<HTMLDivElement>(null);

  /* Obtener ganador */
  const selectWinner = async (): Promise<Winner> => {
    const res = await fetch('/api/giveaway/spain/select-winner', {
      method: 'GET',
      cache: 'no-store'
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Error' }));
      throw new Error(error);
    }
    return res.json();
  };

  /* Spotlight */
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect();
        setSpotlightPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  /* Elegir ganador */
  const handlePick = async () => {
    try {
      setStep('loading');
      const data = await selectWinner();
      setWinner(data);
      setStep('counting');

      /* Fijar conteo simulado a 23,456 */
      const totalSimulado = 23456;
      let current = 0;
      const duration = 2200;
      const fps = 60;
      const increment = Math.ceil(totalSimulado / (duration / (1000 / fps)));

      const timer = setInterval(() => {
        current += increment;
        if (current >= totalSimulado) {
          current = totalSimulado;
          clearInterval(timer);
          setStep('drumroll');
          setTimeout(() => setStep('revealed'), 1700);
        }
        setCount(current);
      }, 1000 / fps);
    } catch {
      alert('No se pudo obtener el ganador. Intenta más tarde.');
      setStep('start');
    }
  };

  /* ────────── Render ────────── */
  return (
    <main
      ref={mainRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-900 to-black text-white"
    >
      {/* Halo dorado */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at ${spotlightPosition.x}px ${spotlightPosition.y}px,rgba(255,215,0,0.14) 0%,transparent 60%)`
        }}
      />

      {/* Carritos (ocultos en móvil) */}
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-red-600/10 hidden sm:block"
          initial={{ x: -120, y: Math.random() * window.innerHeight }}
          animate={{ x: window.innerWidth + 120 }}
          transition={{ duration: 15 + Math.random() * 5, repeat: Infinity, ease: 'linear' }}
        >
          <GiF1Car className="text-4xl" />
        </motion.div>
      ))}

      {/* ───────────────── INTRO ───────────────── */}
      {step === 'intro' && (
        <motion.section
          className="z-10 flex flex-col items-center gap-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="relative scale-90 sm:scale-100">
            <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-red-600 via-yellow-400 to-red-600 blur-2xl opacity-20" />
            <div className="relative rounded-full bg-neutral-800 p-6 sm:p-10 shadow-lg">
              <GiCheckeredFlag className="text-6xl sm:text-8xl" />
            </div>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 bg-clip-text text-transparent">
            F1 Fantasy
          </h1>
          <h2 className="text-xl sm:text-3xl text-yellow-300 font-medium">
            Giveaway · GP de España 2025
          </h2>

          <button
            onClick={() => setStep('start')}
            className="mt-4 flex items-center gap-3 rounded-full bg-red-600 px-8 py-3 text-lg sm:text-xl font-bold uppercase tracking-wider transition-transform hover:scale-105"
          >
            <FaRocket className="text-2xl" /> Iniciar
          </button>
        </motion.section>
      )}

      {/* ───────────────── START ───────────────── */}
      {step === 'start' && (
        <motion.section
          className="z-10 flex flex-col items-center gap-8 text-center max-w-md sm:max-w-lg"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-lg sm:text-xl text-neutral-200">
            Elegiremos al ganador entre todos los que enviaron sus predicciones
            para el Gran Premio de España.
          </p>

          <button
            onClick={handlePick}
            className="flex items-center gap-3 rounded-full bg-gradient-to-r from-red-600 to-red-800 px-10 py-4 text-lg sm:text-xl font-bold uppercase tracking-wider transition-transform hover:scale-105"
          >
            <FaBolt className="text-2xl" /> Seleccionar ganador
          </button>
        </motion.section>
      )}

      {/* ───────────────── LOADING ───────────────── */}
      {step === 'loading' && (
        <motion.section
          className="z-10 flex flex-col items-center gap-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          <p className="text-neutral-300">Obteniendo participantes…</p>
        </motion.section>
      )}

      {/* ───────────────── COUNTING ───────────────── */}
      {step === 'counting' && (
        <motion.section
          className="z-10 flex flex-col items-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="flex h-40 w-40 sm:h-52 sm:w-52 items-center justify-center rounded-full border-4 border-yellow-500 bg-neutral-900 shadow-inner"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
          >
            <span className="text-4xl sm:text-5xl font-extrabold text-yellow-400">
              {count.toLocaleString()}
            </span>
          </motion.div>
          <span className="text-neutral-400 text-sm sm:text-base">Participantes</span>
        </motion.section>
      )}

      {/* ───────────────── DRUMROLL ───────────────── */}
      {step === 'drumroll' && (
        <motion.section
          className="z-10 flex flex-col items-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.h3
            className="text-3xl sm:text-5xl font-extrabold text-yellow-400"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          >
            ¡Atención!
          </motion.h3>
          <motion.div
            className="flex gap-2"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            {[0, 1, 2].map(i => (
              <GiF1Car key={i} className="text-4xl text-red-600" />
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* ───────────────── REVEALED ───────────────── */}
      <AnimatePresence>
        {step === 'revealed' && winner && (
          <motion.section
            className="z-10 flex flex-col items-center gap-8 text-center max-w-sm sm:max-w-md"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400 bg-clip-text text-transparent">
              ¡Felicidades {winner.name}!
            </h2>

            <div className="relative rounded-2xl bg-neutral-800/80 px-6 py-8 shadow-lg ring-1 ring-yellow-500/30 backdrop-blur-sm">
              <div className="space-y-2 text-left text-sm sm:text-base text-neutral-200">
                <p>
                  <span className="font-semibold text-yellow-400">Usuario:</span>{' '}
                  {winner.username}
                </p>
                <p>
                  <span className="font-semibold text-yellow-400">ID:</span>{' '}
                  <span className="font-mono">{winner.id}</span>
                </p>
                <p>
                  <span className="font-semibold text-yellow-400">Total participantes:</span>{' '}
                  23,456
                </p>
              </div>
            </div>

            <div>
              <button
                onClick={() =>
                  navigator.clipboard?.writeText(
                    `🏁 ${winner.name} ganó el Giveaway F1 Fantasy GP España 2025`
                  )
                }
                className="rounded-full bg-red-700 px-8 py-3 text-sm sm:text-base font-semibold transition-transform hover:scale-105"
              >
                Copiar resultado
              </button>
            </div>

            {/* Confeti simple (ligero) */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 35 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-yellow-400"
                  initial={{
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    scale: 0
                  }}
                  animate={{ scale: [0, 1, 0], rotate: 360 }}
                  transition={{
                    duration: 3 + Math.random() * 2,
                    delay: Math.random() * 2,
                    repeat: Infinity
                  }}
                >
                  {i % 2 === 0 ? (
                    <FaCrown className="text-xl" />
                  ) : (
                    <GiCheckeredFlag className="text-xl" />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Franjas */}
      <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 opacity-30" />
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 opacity-30" />
    </main>
  );
}