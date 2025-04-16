// ✅ /app/api/process-picks/route.ts — Intermediario que llama la Edge Function

import { NextResponse } from 'next/server';

export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;

  if (!serviceKey || !projectRef) {
    return NextResponse.json({ error: 'Faltan variables de entorno necesarias' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://${projectRef}.functions.supabase.co/process_picks_results`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ Error al llamar la Edge Function:', error);
    return NextResponse.json({ error: 'Error al ejecutar función de Supabase' }, { status: 500 });
  }
}
