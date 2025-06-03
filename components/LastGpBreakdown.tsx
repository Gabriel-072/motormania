// components/LastGpBreakdown.tsx
'use client';

import React, { useState } from 'react';           // <-- añadimos useState aquí
import { motion } from 'framer-motion';
import useLastGpBreakdown, { BreakdownEntry } from '@/hooks/useLastGpBreakdown';
import { useUser } from '@clerk/nextjs';
import ScoringSystemModal from '@/components/ScoringSystemModal';

interface Props {
  lastGpName: string | null;
}

export default function LastGpBreakdown({ lastGpName }: Props) {
  const { user } = useUser();
  const userId = user?.id;
  const [showModal, setShowModal] = useState(false);  // <-- estado para controlar el modal

  const { self, loading, error } = useLastGpBreakdown(lastGpName, userId);

  if (!lastGpName) {
    return (
      <p className="py-6 text-center text-gray-400 font-exo2">
        Aún no hay carrera procesada.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="py-6 text-center animate-pulse font-exo2">
        Cargando tu desglose de puntos…
      </p>
    );
  }

  if (error) {
    return (
      <p className="py-6 text-center text-red-500 font-exo2">
        {error}
      </p>
    );
  }

  if (!self) {
    return (
      <p className="py-6 text-center text-gray-400 font-exo2">
        No encontré tu predicción para <strong>{lastGpName}</strong> o no enviaste nada.
      </p>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-neutral-900/80 border border-neutral-700/60 rounded-xl p-4 shadow-xl"
      >
        <h3 className="text-lg font-semibold mb-3 font-exo2 text-orange-400">
          Tu desglose de puntos – {lastGpName}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm sm:text-base font-exo2">
            <thead>
              <tr className="text-left text-gray-300">
                <th className="px-2 py-1">Categoría</th>
                <th className="px-2 py-1 text-center">Puntos</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-800/70">
                <td className="px-2 py-1">Pole</td>
                <td className="px-2 py-1 text-center text-amber-300">
                  {self.pole_score}
                </td>
              </tr>
              <tr className="bg-gray-800/80">
                <td className="px-2 py-1">Podio</td>
                <td className="px-2 py-1 text-center text-blue-300">
                  {self.podium_score}
                </td>
              </tr>
              <tr className="bg-gray-800/70">
                <td className="px-2 py-1">Extras</td>
                <td className="px-2 py-1 text-center text-green-300">
                  {self.extras_score}
                </td>
              </tr>
              <tr className="bg-gray-800/80">
                <td className="px-2 py-1 font-semibold text-white">Total</td>
                <td className="px-2 py-1 text-center font-semibold text-white">
                  {self.total_score}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ───────── Botón para abrir el modal “Sistema de Puntuación” ───────── */}
        <div className="mt-4 flex justify-end">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-exo2 font-semibold rounded-md shadow-sm transition"
            onClick={() => setShowModal(true)}
          >
            SISTEMA DE PUNTUACIÓN
          </button>
        </div>
      </motion.div>

      {/* ───────── Componente del Modal ───────── */}
      <ScoringSystemModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}