// 📁 /app/api/picks/email-with-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';

const INTERNAL_KEY = process.env.INTERNAL_API_KEY!;
const SITE_URL     = process.env.NEXT_PUBLIC_SITE_URL!;

export async function POST(req: NextRequest) {
  // body viene directamente del frontend, validado en la ruta destino
  const body = await req.text();

  // Llama a la ruta existente, agregando la X-Internal-Key
  const resp = await fetch(`${SITE_URL}/api/send-pick-confirmation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': INTERNAL_KEY
    },
    body
  });

  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}