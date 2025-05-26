'use client';

import React, { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { PickSelection } from '@/app/types/picks';

interface PickRow {
  id: string;
  gp_name: string;
  session_type: string;
  picks: PickSelection[];
  multiplier: number;
  wager_amount: number;
  potential_win: number;
  created_at: string;
  mode: string; // 'Full Throttle' | 'Safety Car'
}

interface PickResultRow {
  pick_id: string;
  correct_count: number;
  total_picks: number;
  result: 'won' | 'partial' | 'lost';
  payout: number;
  processed_at: string;
}

type CombinedPick = PickRow & Partial<PickResultRow>;

export default function PicksResumen() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [currentPicks, setCurrentPicks] = useState<PickRow[]>([]);
  const [pastPicks, setPastPicks]       = useState<CombinedPick[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      setLoading(true);
      const token = await getToken({ template: 'supabase' });
      const supabase = createAuthClient(token!);

      // 1) Traer picks
      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (picksError) {
        console.error('Error fetching picks:', picksError);
        setLoading(false);
        return;
      }

      // 2) Traer resultados procesados
      const { data: results, error: resultsError } = await supabase
        .from('pick_results')
        .select('*')
        .eq('user_id', user.id);
      if (resultsError) {
        console.error('Error fetching pick results:', resultsError);
      }

      // 3) Convertir a lookup
      const resultsMap: Record<string, PickResultRow> = {};
      results?.forEach(r => {
        resultsMap[r.pick_id] = r;
      });

      const now = new Date();

      // 4) Separar actuales vs pasados
      const upcoming = (picks as PickRow[]).filter(
        p => new Date(p.created_at) > now
      );
      const past     = (picks as PickRow[])
        .filter(p => new Date(p.created_at) <= now)
        .map<CombinedPick>(pick => ({
          ...pick,
          ...resultsMap[pick.id]
        }));

      setCurrentPicks(upcoming);
      setPastPicks(past);
      setLoading(false);
    };

    fetchAll();
  }, [user, getToken]);

  const renderPickCard = (pick: CombinedPick, idx: number) => {
    const isFull = pick.mode === 'Full Throttle';
    const payout = pick.payout ?? 0;

    return (
      <motion.div
        key={pick.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: idx * 0.1 }}
        className="relative bg-[#0b1f27] p-4 rounded-xl border border-white/10 shadow hover:shadow-cyan-500/10 transition-all"
      >
        {/* Badge con estado del pick */}
        {pick.result && (
          <div
            className={
              `absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-semibold ` +
              (pick.result === 'won'
                ? 'bg-green-500 text-white'
                : pick.result === 'partial'
                ? 'bg-yellow-500 text-black'
                : 'bg-red-500 text-white')
            }
          >
            {pick.result === 'won'
              ? '🏆 ¡Ganaste!'
              : pick.result === 'partial'
              ? '⚖️ Parcial'
              : '❌ Perdiste'}
          </div>
        )}

        <div className="flex justify-between items-center mb-2">
          <h4 className="text-white text-sm font-bold">
            {pick.gp_name} — {pick.session_type}
          </h4>
          <span className={`text-xs font-medium ${isFull ? 'text-amber-400' : 'text-cyan-400'}`}>
            {isFull ? '🎯 Full Throttle' : '🛡️ Safety Car'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {pick.picks.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs text-gray-300 bg-[#0e2b35] px-3 py-2 rounded-lg"
            >
              <span className="font-semibold">{p.driver}</span>
              <span className="italic">
                {p.betterOrWorse === 'mejor' ? '⬆️ Mejor' : '⬇️ Peor'} que {p.line}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 text-sm text-white space-y-1">
          <p>
            <span className="text-cyan-300">Monto:</span> ${pick.wager_amount.toLocaleString()}
          </p>
          <p>
            <span className="text-green-400">Posible Ganancia:</span> ${pick.potential_win.toLocaleString()} ({pick.multiplier}x)
          </p>

          {pick.result && (
            <div className="mt-2 p-2 bg-gray-800 rounded space-y-1">
              <p>
                <strong>Resultado:</strong> {pick.result.toUpperCase()}
              </p>
              <p>
                <strong>Aciertos:</strong> {pick.correct_count}/{pick.total_picks}
              </p>
              <p>
                <strong>Payout:</strong>{' '}
                {payout.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
              </p>
              <p className="text-xs text-gray-500">
                Procesado: {pick.processed_at ? new Date(pick.processed_at).toLocaleDateString('es-CO') : '-'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="mt-12 space-y-10">
      {/* Picks Actuales */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">📌 Picks Actuales</h3>
        {loading ? (
          <p className="text-gray-400 animate-pulse">Cargando...</p>
        ) : currentPicks.length === 0 ? (
          <p className="text-gray-500">No hay picks activos.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentPicks.map(renderPickCard)}
          </div>
        )}
      </div>

      {/* Picks Anteriores */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">🕓 Picks Anteriores</h3>
        {loading ? (
          <p className="text-gray-400 animate-pulse">Cargando...</p>
        ) : pastPicks.length === 0 ? (
          <p className="text-gray-500">Aún no has jugado ninguna vez.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastPicks.map(renderPickCard)}
          </div>
        )}
      </div>
    </div>
  );
}
