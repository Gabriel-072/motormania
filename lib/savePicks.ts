// ──────────────────────────────────────────────────────────────────────────────
// savePicks.ts — Guarda picks en Supabase
// ──────────────────────────────────────────────────────────────────────────────
import { createAuthClient } from '@/lib/supabase';
import { PickSelection } from '../app/types/picks';

export async function savePicks({
  userId,
  fullName,
  token,
  gpName,
  sessionType,
  picks,
}: {
  userId: string;
  fullName: string;
  token: string;
  gpName: string;
  sessionType: 'qualy' | 'race';
  picks: PickSelection[];
}): Promise<{ success: boolean; message: string }> {
  const supabase = createAuthClient(token);

  const multiplier =
    picks.length === 2 ? 3 :
    picks.length === 4 ? 10 :
    picks.length === 6 ? 35 :
    picks.length === 8 ? 100 : 1;

  const wagerAmount = 10000; // COP
  const potentialWin = wagerAmount * multiplier;

  const { error } = await supabase.from('picks').insert({
    user_id: userId,
    name: fullName,
    gp_name: gpName,
    session_type: sessionType,
    picks,
    multiplier,
    wager_amount: wagerAmount,
    potential_win: potentialWin,
  });

  if (error) {
    console.error('Error saving picks:', error);
    return { success: false, message: `No se pudieron guardar los picks: ${error.message}` };
  }

  return { success: true, message: '¡Picks guardados exitosamente!' };
}
