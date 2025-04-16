// ──────────────────────────────────────────────────────────────────────────────
// PicksResumen.tsx — Componente para visualizar picks actuales y anteriores
// ──────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { PickSelection } from '@/app/types/picks';

interface PickRow {
  gp_name: string;
  session_type: string;
  picks: PickSelection[];
  multiplier: number;
  wager_amount: number;
  potential_win: number;
  created_at: string;
  mode: string; // full o safety
}

export default function PicksResumen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [currentPicks, setCurrentPicks] = useState<PickRow[]>([]);
  const [pastPicks, setPastPicks] = useState<PickRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPicks = async () => {
      setLoading(true);
      const token = await getToken({ template: 'supabase' });
      const supabase = createAuthClient(token!);

      const { data, error } = await supabase
        .from('picks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) return console.error('Error fetching picks:', error);
      if (!data) return;

      const now = new Date();

      const upcoming = data.filter(pick => new Date(pick.created_at) > now);
      const past = data.filter(pick => new Date(pick.created_at) <= now);

      setCurrentPicks(upcoming);
      setPastPicks(past);
      setLoading(false);
    };

    fetchPicks();
  }, [user]);

  const renderPickCard = (pick: PickRow, idx: number) => (
    <motion.div
      key={idx}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.1 }}
      className="bg-[#0b1f27] p-4 rounded-xl border border-white/10 shadow hover:shadow-cyan-500/10 transition-all"
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-white text-sm font-bold">{pick.gp_name} — {pick.session_type}</h4>
        <span className={`text-xs font-medium ${pick.session_type === 'full' ? 'text-amber-400' : 'text-cyan-400'}`}>
          {pick.session_type === 'full' ? '🎯 Full Throttle' : '🛡️ Safety Car'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {pick.picks.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-xs text-gray-300 bg-[#0e2b35] px-3 py-2 rounded-lg">
            <span className="font-semibold">{p.driver}</span>
            <span className="italic">{p.betterOrWorse === 'mejor' ? '⬆️ Mejor' : '⬇️ Peor'} que {p.line}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-sm text-white">
        <p><span className="text-cyan-300">Monto:</span> ${pick.wager_amount.toLocaleString()}</p>
        <p><span className="text-green-400">Posible Ganancia:</span> ${pick.potential_win.toLocaleString()} ({pick.multiplier}x)</p>
      </div>
    </motion.div>
  );

  return (
    <div className="mt-12 space-y-10">
      <div>
        <h3 className="text-xl font-bold text-white mb-4">📌 Picks Actuales</h3>
        {loading ? <p className="text-gray-400 animate-pulse">Cargando...</p> : currentPicks.length === 0 ? <p className="text-gray-500">No hay picks activos.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentPicks.map(renderPickCard)}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-bold text-white mb-4">🕓 Picks Anteriores</h3>
        {loading ? <p className="text-gray-400 animate-pulse">Cargando...</p> : pastPicks.length === 0 ? <p className="text-gray-500">Aún no has jugado ninguna vez.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastPicks.map(renderPickCard)}
          </div>
        )}
      </div>
    </div>
  );
}
