// components/LastGpBreakdown.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import useLastGpBreakdown, { BreakdownEntry } from '@/hooks/useLastGpBreakdown';
import { useUser } from '@clerk/nextjs';

interface Props {
  lastGpName: string | null;
}

export default function LastGpBreakdown({ lastGpName }: Props) {
  const { user } = useUser();
  const userId = user?.id ?? undefined;

  const { top10, self, loading, error } = useLastGpBreakdown(lastGpName, userId);

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
        Cargando desglose de puntos…
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
  if (top10.length === 0 && !self) {
    return (
      <p className="py-6 text-center text-gray-400 font-exo2">
        No hay predicciones para este GP todavía.
      </p>
    );
  }

  // ----------------------------------------
  // 1) Componer la lista “ordenada”:
  //    • empezar por los TOP10 (si existen)
  //    • si 'self' no está en ese arreglo de top10 (user fuera del top10), 
  //      lo agregamos al final indicando su posición real = “(Fuera del Top 10)”
  // ----------------------------------------
  const rows: (BreakdownEntry & { isYou: boolean; rankLabel: string })[] = [];

  top10.forEach((r, idx) => {
    rows.push({
      ...r,
      isYou: r.user_id === userId,
      rankLabel: `${idx + 1}.`,
    });
  });

  // Si hay self y no estaba en top10, lo agregamos
  if (self && !top10.find((r) => r.user_id === self.user_id)) {
    // Podemos averiguar su posición real consultando “prediction_breakdown” sin límite.
    // Pero aquí, por simplicidad, diremos “Fuera del Top 10” y lo ponemos al final.
    rows.push({
      ...self,
      isYou: true,
      rankLabel: 'Fuera del Top 10',
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-neutral-900/80 border border-neutral-700/60 rounded-xl p-4 shadow-xl"
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold mb-3 font-exo2 text-orange-400">
        Desglose de Puntos – {lastGpName}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full table-auto text-sm sm:text-base font-exo2">
          <thead>
            <tr className="text-left text-gray-300">
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">Nombre</th>
              <th className="px-2 py-1 text-center">Pole</th>
              <th className="px-2 py-1 text-center">Podio</th>
              <th className="px-2 py-1 text-center">Extras</th>
              <th className="px-2 py-1 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.user_id + (row.isYou ? '_you' : '')}
                className={`${
                  idx % 2 === 0 ? 'bg-gray-800/60' : 'bg-gray-800/80'
                } ${row.isYou ? 'border-l-4 border-amber-500' : ''}`}
              >
                <td className="px-2 py-1 font-mono">{row.rankLabel}</td>
                <td className="px-2 py-1">
                  {row.name}
                  {row.isYou && (
                    <span className="ml-1 text-xs text-amber-300 font-exo2">(Tú)</span>
                  )}
                </td>
                <td className="px-2 py-1 text-center text-amber-300">
                  {row.pole_score}
                </td>
                <td className="px-2 py-1 text-center text-blue-300">
                  {row.podium_score}
                </td>
                <td className="px-2 py-1 text-center text-green-300">
                  {row.extras_score}
                </td>
                <td className="px-2 py-1 text-center font-semibold text-white">
                  {row.total_score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}