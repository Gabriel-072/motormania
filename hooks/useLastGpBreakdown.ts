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
  self?: BreakdownEntry;
  loading: boolean;
  error: string | null;
}

/**
 * Hook que:
 *  • Consulta en prediction_breakdown el desglose para un usuario dado (userId)
 *    en el último GP (lastGpName), y devuelve solo la fila propia.
 */
export default function useLastGpBreakdown(
  lastGpName: string | null,
  userId?: string
): UseLastGpBreakdownReturn {
  const { getToken } = useAuth();
  const [self, setSelf]       = useState<BreakdownEntry | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    // Si no hay GP o no hay userId, reseteamos y salimos
    if (!lastGpName || !userId) {
      setSelf(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1) Obtener token y cliente Supabase
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('No se pudo obtener token de Supabase.');
        const supabase = createAuthClient(token);

        // 2) Traer DESGLOSE (prediction_breakdown) para este usuario y GP
        const { data: breakdownRow, error: breakdownErr } = await supabase
          .from('prediction_breakdown')
          .select(
            'user_id, pole_score, podium_score, extras_score, total_score'
          )
          .eq('gp_name', lastGpName)
          .eq('user_id', userId)
          .maybeSingle();

        if (breakdownErr && breakdownErr.code !== 'PGRST116') {
          throw breakdownErr;
        }
        if (!breakdownRow) {
          // Si no existe fila, dejamos self = undefined
          if (!isCancelled) {
            setSelf(undefined);
            setLoading(false);
          }
          return;
        }

        // 3) Obtener el nombre completo desde clerk_users
        const { data: userData, error: userErr } = await supabase
          .from('clerk_users')
          .select('full_name')
          .eq('clerk_id', userId)
          .maybeSingle();

        if (userErr && userErr.code !== 'PGRST116') {
          throw userErr;
        }

        const name = userData?.full_name ?? 'Unknown User';

        // 4) Construir el objeto final
        const finalSelf: BreakdownEntry = {
          user_id: breakdownRow.user_id,
          name,
          pole_score: breakdownRow.pole_score,
          podium_score: breakdownRow.podium_score,
          extras_score: breakdownRow.extras_score,
          total_score: breakdownRow.total_score,
        };

        if (!isCancelled) {
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

  return { self, loading, error };
}