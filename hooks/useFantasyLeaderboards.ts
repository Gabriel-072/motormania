'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';

/** Fila genérica de leaderboard */
export interface LeaderboardEntry {
  user_id: string;
  name: string;
  score: number;
}

interface UseFantasyLeaderboardsReturn {
  globalTop10: LeaderboardEntry[];
  lastGpTop3: LeaderboardEntry[];
  lastGpName: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook que expone:
 *  • TOP-10 global (tabla `leaderboard`)
 *  • TOP-3 del último GP (view `gp_leaderboard`)
 */
export default function useFantasyLeaderboards(): UseFantasyLeaderboardsReturn {
  const { getToken } = useAuth();
  const [globalTop10, setGlobalTop10] = useState<LeaderboardEntry[]>([]);
  const [lastGpTop3, setLastGpTop3]   = useState<LeaderboardEntry[]>([]);
  const [lastGpName, setLastGpName]   = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Obtener JWT para Supabase
        const token = await getToken({ template: 'supabase' });
        const supabase = createAuthClient(token);

        /* ── 1. TOP-10 global ───────────────────────── */
        const { data: globalData, error: gErr } = await supabase
          .from('leaderboard')
          .select('user_id, name, score')
          .order('score', { ascending: false })
          .limit(10);
        if (gErr) throw gErr;
        setGlobalTop10(globalData ?? []);

        /* ── 2. ¿Cuál fue el último GP procesado? ───── */
        // Usamos race_results.created_at para determinar el GP más reciente
        const { data: lastRace, error: rErr } = await supabase
          .from('race_results')
          .select('gp_name, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (rErr) throw rErr;
        if (!lastRace) {
          setLastGpName(null);
          setLoading(false);
          return;
        }
        setLastGpName(lastRace.gp_name);

        /* ── 3. TOP-3 de ese GP ─────────────────────── */
        const { data: gpData, error: gpErr } = await supabase
          .from('gp_leaderboard')                 // ← la VIEW que creaste
          .select('user_id, name, score')
          .eq('gp_name', lastRace.gp_name)
          .order('score', { ascending: false })
          .limit(10);
        if (gpErr) throw gpErr;
        setLastGpTop3(gpData ?? []);

        setLoading(false);
      } catch (e: any) {
        console.error('[useFantasyLeaderboards]', e);
        setError(e.message ?? 'Error desconocido');
        setLoading(false);
      }
    })();
  }, [getToken]);

  return { globalTop10, lastGpTop3, lastGpName, loading, error };
}
