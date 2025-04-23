import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwt = await getToken({ template: 'supabase' });
  const supabase = createServerSupabaseClient(jwt ?? undefined);
  const { data, error } = await supabase
    .from('entries')
    .select('numbers')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || {});
}

export async function POST(request: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwt = await getToken({ template: 'supabase' });
  const supabase = createServerSupabaseClient(jwt ?? undefined);

  // Obtener datos adicionales del cuerpo de la solicitud
  const { name, email, region } = await request.json();

  // Verificar si el usuario ya tiene una entrada
  const { data: existing } = await supabase
    .from('entries')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: 'Entry already exists' }, { status: 200 });
  }

  // Generar 5 números aleatorios
  const freeNumbers = Array.from({ length: 5 }, () =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );

  // Insertar la nueva entrada
  const { error } = await supabase.from('entries').insert({
    user_id: userId,
    numbers: freeNumbers,
    paid_numbers_count: 0,
    name: name || null,
    email: email || null,
    region: region || 'CO',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Entry created successfully' }, { status: 201 });
}