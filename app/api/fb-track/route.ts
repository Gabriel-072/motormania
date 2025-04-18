// app/api/fb-track/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_TOKEN;

  if (!pixelId || !accessToken) {
    return NextResponse.json({ error: 'Falta Pixel ID o Access Token' }, { status: 500 });
  }

  const eventData = {
    data: [
      {
        event_name: body.event_name || 'CustomEvent',
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: body.event_source_url || 'https://motormaniacolombia.com',
        action_source: 'website',
        user_data: {
          client_user_agent: req.headers.get('user-agent') || '',
          client_ip_address: req.ip ?? '127.0.0.1',
          em: body.hashed_email || undefined, // opcional: hash del email
        },
      },
    ],
  };

  const res = await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...eventData,
      access_token: accessToken,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}