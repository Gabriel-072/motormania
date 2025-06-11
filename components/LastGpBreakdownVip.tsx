// components/LastGpBreakdown.tsx

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import useLastGpBreakdownVip, { BreakdownEntry } from '../hooks/useLastGpBreakdownVip';
import { useUser } from '@clerk/nextjs';
import ScoringSystemModal from '@/components/ScoringSystemModal';

interface Props {
  lastGpName: string | null;
}

export default function LastGpBreakdown({ lastGpName }: Props) {
  const { user } = useUser();
  const userId = user?.id;
  const [showModal, setShowModal] = useState(false);

  const { self, loading, error } = useLastGpBreakdownVip(lastGpName, userId);

  if (!lastGpName) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-neutral-900/90 to-neutral-800/90 backdrop-blur-sm border border-neutral-700/30 rounded-2xl p-8 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-amber-500/5"></div>
        <div className="relative flex flex-col items-center justify-center min-h-[120px]">
          <div className="w-16 h-16 rounded-full bg-neutral-800/50 flex items-center justify-center mb-4">
            <div className="w-8 h-8 rounded-full border-2 border-neutral-600 border-dashed"></div>
          </div>
          <p className="text-center text-neutral-400 font-exo2 text-lg">
            Aún no hay carrera procesada.
          </p>
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-neutral-900/90 to-neutral-800/90 backdrop-blur-sm border border-neutral-700/30 rounded-2xl p-8 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
        <div className="relative flex flex-col items-center justify-center min-h-[120px]">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-800"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-center text-neutral-300 font-exo2 text-lg animate-pulse">
            Cargando tu desglose de puntos…
          </p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-red-900/20 to-neutral-900/90 backdrop-blur-sm border border-red-500/30 rounded-2xl p-8 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-red-600/5"></div>
        <div className="relative flex flex-col items-center justify-center min-h-[120px]">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <div className="w-8 h-8 text-red-400">⚠</div>
          </div>
          <p className="text-center text-red-400 font-exo2 text-lg">
            {error}
          </p>
        </div>
      </motion.div>
    );
  }

  if (!self) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-neutral-900/90 to-neutral-800/90 backdrop-blur-sm border border-neutral-700/30 rounded-2xl p-8 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-gray-500/5 to-neutral-500/5"></div>
        <div className="relative flex flex-col items-center justify-center min-h-[120px]">
          <div className="w-16 h-16 rounded-full bg-neutral-800/50 flex items-center justify-center mb-4">
            <div className="w-8 h-8 text-neutral-500">❓</div>
          </div>
          <p className="text-center text-neutral-400 font-exo2 text-lg">
            No encontré tu predicción para <strong className="text-white">{lastGpName}</strong> o no enviaste nada.
          </p>
        </div>
      </motion.div>
    );
  }

  const scoreCards = [
    {
      label: 'Pole',
      value: self.pole_score,
      color: 'from-amber-500 to-yellow-500',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-300',
      icon: '🏁'
    },
    {
      label: 'Podio',
      value: self.podium_score,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-300',
      icon: '🏆'
    },
    {
      label: 'Extras',
      value: self.extras_score,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-300',
      icon: '⭐'
    }
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-neutral-900/95 to-neutral-800/95 backdrop-blur-sm border border-neutral-700/40 rounded-2xl shadow-2xl"
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-amber-500/5"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>
        
        <div className="relative p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <h3 className="text-2xl font-bold font-exo2 bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-2">
              Tu desglose de puntos
            </h3>
            <p className="text-neutral-400 font-exo2 text-lg">
              {lastGpName}
            </p>
          </motion.div>

          {/* Score Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {scoreCards.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className={`relative overflow-hidden ${card.bgColor} backdrop-blur-sm border border-neutral-700/50 rounded-xl p-4 group hover:scale-105 transition-all duration-300`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-neutral-400 font-exo2">
                      {card.label}
                    </span>
                    <span className="text-lg opacity-60">
                      {card.icon}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold ${card.textColor} font-exo2`}>
                    {card.value}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Total Score */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="relative overflow-hidden bg-gradient-to-r from-neutral-800/80 to-neutral-700/80 backdrop-blur-sm border border-neutral-600/50 rounded-xl p-6 mb-6"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-white font-exo2 mb-1">
                  Puntuación Total
                </h4>
                <p className="text-sm text-neutral-400 font-exo2">
                  Suma de todos los puntos obtenidos
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-white font-exo2 mb-1">
                  {self.total_score}
                </div>
                <div className="text-sm text-neutral-400 font-exo2">
                  puntos
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex justify-end"
          >
            <button
              className="group relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-exo2 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              onClick={() => setShowModal(true)}
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center gap-2">
                <span>SISTEMA DE PUNTUACIÓN</span>
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  →
                </motion.div>
              </div>
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Modal */}
      <ScoringSystemModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}