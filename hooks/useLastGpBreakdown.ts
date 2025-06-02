// hooks/useLastGpBreakdown.ts
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';

export interface BreakdownEntry {
  user_id: string;
  name: string;
  pole_score: number;
  podium_score: number;
  extras_score: number;
  total_score: number;
}

interface UseLastGpBreakdownReturn {
  top10: BreakdownEntry[];
  self?: BreakdownEntry;     // ← acá guardaremos el desglose del propio usuario (si existe)
  loading: boolean;
  error: string | null;
}

/**
 * Hook que:
 *  • Consulta el top 10 general de desglose (prediction_breakdown) para lastGpName.
 *  • También, si le pasas un userId, busca el desglose de ese userId en ese mismo GP, 
 *    incluso si no está en el top 10.
 */
export default function useLastGpBreakdown(
  lastGpName: string | null,
  userId?: string
): UseLastGpBreakdownReturn {
  const { getToken } = useAuth();
  const [top10, setTop10]     = useState<BreakdownEntry[]>([]);
  const [self, setSelf]       = useState<BreakdownEntry | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!lastGpName) {
      setTop10([]);
      setSelf(undefined);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('No se pudo obtener token Supabase.');

        const supabase = createAuthClient(token);

        //
        // 1) TRAER TOP10 DESGLOSE
        //
        const { data: rows10, error: err10 } = await supabase
          .from('prediction_breakdown')
          .select('user_id, pole_score, podium_score, extras_score, total_score')
          .eq('gp_name', lastGpName)
          .order('total_score', { ascending: false })
          .limit(10);

        if (err10) throw err10;

        if (!rows10) {
          if (!isCancelled) {
            setTop10([]);
            setSelf(undefined);
            setLoading(false);
          }
          return;
        }

        //
        // 2) SI PASARON userId, TRAER ESE DESGLOSE PARTICULAR
        //
        let selfRow: BreakdownEntry | undefined = undefined;
        if (userId) {
          const { data: ownRows, error: ownErr } = await supabase
            .from('prediction_breakdown')
            .select('user_id, pole_score, podium_score, extras_score, total_score')
            .eq('gp_name', lastGpName)
            .eq('user_id', userId)
            .maybeSingle();

          if (ownErr && ownErr.code !== 'PGRST116') throw ownErr;
          if (ownRows) {
            selfRow = {
              user_id: ownRows.user_id,
              name: '', // vendrá más abajo
              pole_score: ownRows.pole_score,
              podium_score: ownRows.podium_score,
              extras_score: ownRows.extras_score,
              total_score: ownRows.total_score,
            };
          }
        }

        //
        // 3) QUERER LOS NOMBRES: sacar todos los user_id de rows10 y también el de selfRow (si existe)
        //
        const allIds = new Set<string>();
        rows10.forEach((r) => allIds.add(r.user_id));
        if (selfRow) allIds.add(selfRow.user_id);
        const idArray = Array.from(allIds);

        const { data: usersData, error: usrErr } = await supabase
          .from('clerk_users')
          .select('clerk_id, full_name')
          .in('clerk_id', idArray);

        if (usrErr) throw usrErr;

        // Mapear clerk_id → full_name
        const nameMap: Record<string, string> = {};
        usersData?.forEach((u) => {
          nameMap[u.clerk_id] = u.full_name;
        });

        //
        // 4) CONSTRUIR top10_final y self_final
        //
        const finalTop10: BreakdownEntry[] = rows10.map((r) => ({
          user_id: r.user_id,
          name: nameMap[r.user_id] ?? 'Unknown User',
          pole_score: r.pole_score,
          podium_score: r.podium_score,
          extras_score: r.extras_score,
          total_score: r.total_score,
        }));

        let finalSelf: BreakdownEntry | undefined;
        if (selfRow) {
          finalSelf = {
            user_id: selfRow.user_id,
            name: nameMap[selfRow.user_id] ?? 'Unknown User',
            pole_score: selfRow.pole_score,
            podium_score: selfRow.podium_score,
            extras_score: selfRow.extras_score,
            total_score: selfRow.total_score,
          };
        }

        if (!isCancelled) {
          setTop10(finalTop10);
          setSelf(finalSelf);
          setLoading(false);
        }
      } catch (e: any) {
        if (!isCancelled) {
          console.error('[useLastGpBreakdown]', e);
          setError(e.message ?? 'Error desconocido');
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [getToken, lastGpName, userId]);

  return { top10, self, loading, error };
}