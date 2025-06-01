'use client';

import React from 'react';
import useFantasyLeaderboards from '@/hooks/useFantasyLeaderboards';
import { motion } from 'framer-motion';
import { FaTrophy, FaChevronRight } from 'react-icons/fa';

export default function LeaderboardsSection() {
  const {
    globalTop10,
    lastGpTop10,
    lastGpName,
    loading,
    error,
  } = useFantasyLeaderboards();

  if (loading)
    return <p className="py-6 text-center animate-pulse">Cargando…</p>;

  if (error)
    return (
      <p className="py-6 text-center text-red-500">
        {error}
      </p>
    );

  return (
    <section className="grid gap-6 md:grid-cols-2">
      {/* ────────── TOP-10 GLOBAL ────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-neutral-900/80 border border-neutral-700/60 rounded-xl p-4 shadow-xl"
      >
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <FaTrophy className="text-yellow-500" />
          Leaderboard Global (Top 10)
        </h3>

        <ol className="space-y-2">
          {globalTop10.map((u, i) => (
            <li key={u.user_id} className="flex justify-between">
              <span>
                <span className="w-6 inline-block font-mono">
                  {i + 1}.
                </span>{' '}
                {u.name}
              </span>
              <span className="font-semibold">
                {u.score.toLocaleString('es-CO')}
              </span>
            </li>
          ))}
        </ol>
      </motion.div>

      {/* ────────── TOP-10 ÚLTIMO GP ────────── */}
      {lastGpName && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-neutral-900/80 border border-neutral-700/60 rounded-xl p-4 shadow-xl"
        >
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <FaTrophy className="text-orange-400" />
            Top 10 – {lastGpName}
          </h3>

          <ol className="space-y-2">
            {lastGpTop10.map((u, i) => (
              <li key={u.user_id} className="flex justify-between">
                <span>
                  <span
                    className={`w-6 inline-block font-mono ${
                      i === 0
                        ? 'text-amber-400'
                        : i === 1
                        ? 'text-gray-300'
                        : 'text-amber-700'
                    }`}
                  >
                    {i + 1}.
                  </span>{' '}
                  {u.name}
                </span>
                <span className="font-semibold">
                  {u.score.toLocaleString('es-CO')}
                </span>
              </li>
            ))}
          </ol>
        </motion.div>
      )}
    </section>
  );
}