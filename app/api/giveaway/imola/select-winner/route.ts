// GET /api/giveaway/imola/select-winner
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role en server
);

export async function GET() {
  // 1 ▸ Traer predicciones de Imola
  const { data: preds, error } = await supabase
    .from('predictions')
    .select('user_id')
    .eq('gp_name', 'Emilia Romagna Grand Prix');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!preds?.length) return NextResponse.json({ error: 'Sin participantes' }, { status: 404 });

  // 2 ▸ Deduplicar y elegir un ID al azar
  const uniqueIds = [...new Set(preds.map(p => p.user_id))];
  const winnerId  = uniqueIds[Math.floor(Math.random() * uniqueIds.length)];

  // 3 ▸ Obtener nombre y username del ganador
  const { data: user, error: userErr } = await supabase
    .from('clerk_users')
    .select('full_name, username')
    .eq('clerk_id', winnerId)
    .single();

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  return NextResponse.json({
    id:       winnerId,
    name:     user.full_name ?? user.username ?? 'Usuario',
    username: user.username ?? '',
    total:    uniqueIds.length
  });
}