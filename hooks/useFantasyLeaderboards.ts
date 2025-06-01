'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';

/** Fila genérica de leaderboard, ahora con gp_name */
export interface LeaderboardEntry {
  user_id: string;
  name:    string;
  score:   number;
  gp_name: string;
}

interface UseFantasyLeaderboardsReturn {
  globalTop10: LeaderboardEntry[];
  lastGpTop10: LeaderboardEntry[];
  lastGpName:  string | null;
  loading:     boolean;
  error:       string | null;
}

/**
 * Hook que expone:
 *  • TOP-10 global (tabla `leaderboard`)
 *  • TOP-10 del último GP (vista `top10_last_gp`)
 */
export default function useFantasyLeaderboards(): UseFantasyLeaderboardsReturn {
  const { getToken } = useAuth();
  const [globalTop10, setGlobalTop10] = useState<LeaderboardEntry[]>([]);
  const [lastGpTop10, setLastGpTop10] = useState<LeaderboardEntry[]>([]);
  const [lastGpName, setLastGpName]   = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 1️⃣ Obtener JWT para Supabase
        const token = await getToken({ template: 'supabase' });
        const supabase = createAuthClient(token);

        /* ── 2. TOP-10 global ───────────────────────────── */
        // Aquí usamos dos genéricos: 'leaderboard' es el nombre real de la tabla
        // y Pick<LeaderboardEntry, 'user_id' | 'name' | 'score'> define solo esos tres campos.
        const {
          data: globalRows,
          error: gErr,
        } = await supabase
          .from<'leaderboard', Pick<LeaderboardEntry, 'user_id' | 'name' | 'score'>>('leaderboard')
          .select('user_id, name, score')
          .order('score', { ascending: false })
          .limit(10);

        if (gErr) throw gErr;

        // Mapeamos a LeaderboardEntry rellenando gp_name = ''
        const globalResult: LeaderboardEntry[] = (globalRows ?? []).map((r) => ({
          user_id: r.user_id,
          name:    r.name,
          score:   r.score,
          gp_name: '', // en la tabla leaderboard este campo no existe, pero TS lo exige
        }));

        setGlobalTop10(globalResult);

        /* ── 3. TOP-10 del último GP usando la vista top10_last_gp ── */
        // Asegúrate de que tu vista SQL esté definida así:
        //
        //   CREATE OR REPLACE VIEW public.top10_last_gp AS
        //   SELECT
        //     ps.user_id,
        //     cu.full_name AS name,
        //     ps.score,
        //     ps.gp_name
        //   FROM public.prediction_scores ps
        //   JOIN public.clerk_users cu ON cu.clerk_id = ps.user_id
        //   JOIN public.last_gp lgp
        //     ON lgp.gp_name   = ps.gp_name
        //    AND lgp.race_date = ps.race_date
        //   ORDER BY ps.score DESC
        //   LIMIT 10;
        //
        // Cada fila de esa vista tendrá exactamente los cuatro campos de LeaderboardEntry.

        const {
          data: top10Data,
          error: top10Err,
        } = await supabase
          .from<'top10_last_gp', LeaderboardEntry>('top10_last_gp')
          .select('*');

        if (top10Err) throw top10Err;

        if (!top10Data || top10Data.length === 0) {
          // Si la vista no devolvió nada, no hay GP aún
          setLastGpTop10([]);
          setLastGpName(null);
        } else {
          // Guardamos las diez filas completas
          setLastGpTop10(top10Data);

          // Extraemos el nombre del GP de la primera fila
          setLastGpName(top10Data[0].gp_name);
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