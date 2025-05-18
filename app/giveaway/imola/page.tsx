'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { FaTrophy } from 'react-icons/fa';

type Winner = {
  id: string;
  name: string;
  username: string;
  total: number;
};

export default function GiveawayImolaPublic() {
  const [step, setStep]     = useState<'start' | 'counting' | 'revealed'>('start');
  const [count, setCount]   = useState(0);
  const [winner, setWinner] = useState<Winner | null>(null);

  const pickWinner = async () => {
    setStep('counting');
    const res  = await fetch('/api/giveaway/imola/select-winner');
    const body = await res.json();
    if (!res.ok) {
      alert(body.error || 'Error inesperado');
      return setStep('start');
    }
    setWinner(body);

    // Animación de conteo
    const target = body.total;
    let current = 0;
    const duration  = 1500;
    const interval  = 30;
    const increment = Math.ceil(target / (duration / interval));

    const timer = setInterval(() => {
      current = Math.min(current + increment, target);
      setCount(current);
      if (current >= target) {
        clearInterval(timer);
        setTimeout(() => {
          confetti({ particleCount: 300, spread: 100, scalar: 0.8 });
          setStep('revealed');
        }, 500);
      }
    }, interval);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black text-white p-6">
      <h1 className="text-4xl font-extrabold mb-6 text-amber-300 text-center">
        ¡Sorteo Imola 2025! 🏆
      </h1>

      {/* Imagen del premio */}
      <div className="mb-8">
        <Image
          src="/images/prize-imola.png"
          alt="Premio Giveaway"
          width={300}
          height={200}
          className="rounded-xl shadow-2xl"
        />
      </div>

      {/* Botón de inicio */}
      {step === 'start' && (
        <button
          onClick={pickWinner}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105"
        >
          <FaTrophy /> Elegir ganador
        </button>
      )}

      {/* Conteo animado */}
      {step === 'counting' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-3xl font-mono"
        >
          Participantes: {count.toLocaleString()}
        </motion.div>
      )}

      {/* Resultado */}
      <AnimatePresence>
        {step === 'revealed' && winner && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-10 bg-gray-800 rounded-2xl p-8 shadow-xl text-center max-w-sm"
          >
            <h2 className="text-2xl font-extrabold text-amber-400 mb-4 flex items-center justify-center gap-2">
              ¡Y el ganador es… <FaTrophy />
            </h2>
            <p className="text-xl mb-1">{winner.name}</p>
            {winner.username && (
              <p className="text-sm text-gray-400 mb-2">@{winner.username}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Entre {winner.total.toLocaleString()} participantes
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}