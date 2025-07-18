// hooks/useFantasyLeaderboards.ts - UPDATED WITH VIP SUPPORT

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';

/** 🔥 UPDATED: Leaderboard entry with VIP support */
export interface LeaderboardEntry {
  user_id: string;
  name: string;
  score: number;
  gp_name: string;
  is_vip?: boolean; // 🔥 NEW: VIP flag
}

interface UseFantasyLeaderboardsReturn {
  globalTop10: LeaderboardEntry[];
  lastGpTop10: LeaderboardEntry[];
  lastGpName: string | null;
  loading: boolean;
  error: string | null;
}

export default function useFantasyLeaderboards(): UseFantasyLeaderboardsReturn {
  const { getToken } = useAuth();
  const [globalTop10, setGlobalTop10] = useState<LeaderboardEntry[]>([]);
  const [lastGpTop10, setLastGpTop10] = useState<LeaderboardEntry[]>([]);
  const [lastGpName, setLastGpName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        const supabase = createAuthClient(token);

        /* ── TOP-10 global with VIP status ── */
        const {
          data: globalRows,
          error: gErr,
        } = await supabase
          .from('leaderboard')
          .select('user_id, name, score, is_vip') // 🔥 UPDATED: Added is_vip
          .order('score', { ascending: false })
          .limit(10);

        if (gErr) throw gErr;

        const globalResult: LeaderboardEntry[] = (globalRows ?? []).map((r) => ({
          user_id: r.user_id,
          name: r.name,
          score: r.score,
          gp_name: '', // Global leaderboard doesn't have GP name
          is_vip: r.is_vip ?? false, // 🔥 NEW: Include VIP status
        }));

        setGlobalTop10(globalResult);

        /* ── TOP-10 last GP ── */
        const {
          data: top10Data,
          error: top10Err,
        } = await supabase
          .from('top10_last_gp')
          .select('*');

        if (top10Err) {
          console.warn('top10_last_gp view not found, using fallback');
          setLastGpTop10([]);
          setLastGpName(null);
        } else if (!top10Data || top10Data.length === 0) {
          setLastGpTop10([]);
          setLastGpName(null);
        } else {
          const lastGpResult: LeaderboardEntry[] = top10Data.map((r) => ({
            user_id: r.user_id,
            name: r.name,
            score: r.score,
            gp_name: r.gp_name,
            is_vip: r.is_vip ?? false, // 🔥 NEW: Include VIP status
          }));

          setLastGpTop10(lastGpResult);
          setLastGpName(lastGpResult[0].gp_name);
        }

        setLoading(false);
      } catch (e: any) {
        console.error('[useFantasyLeaderboards]', e);
        setError(e.message ?? 'Error desconocido');
        setLoading(false);
      }
    })();
  }, [getToken]);

  return { globalTop10, lastGpTop10, lastGpName, loading, error };
}