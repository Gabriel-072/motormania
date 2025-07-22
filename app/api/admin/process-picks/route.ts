//api/admin/process-picks/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  console.log("🚀 process_picks_results invocado");  // ← este log
  const response = await fetch(
    'https://zbytlqhtgwbwksrnaxnw.functions.supabase.co/process_picks_results',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}