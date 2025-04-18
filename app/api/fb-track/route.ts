import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_TOKEN;

  if (!pixelId || !accessToken) {
    return new NextResponse(
      JSON.stringify({ error: 'Falta Pixel ID o Access Token' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const userAgent = req.headers.get('user-agent') || '';
  if (
    userAgent.toLowerCase().includes('curl') ||
    userAgent.toLowerCase().includes('postman') ||
    userAgent.toLowerCase().includes('insomnia') ||
    userAgent === ''
  ) {
    return new NextResponse(
      JSON.stringify({ error: 'User-Agent bloqueado por seguridad' }),
      { status: 403, headers: corsHeaders }
    );
  }

  const referer = req.headers.get('referer') || '';
  if (!referer.includes('motormaniacolombia.com')) {
    return new NextResponse(
      JSON.stringify({ error: 'Acceso no autorizado' }),
      { status: 403, headers: corsHeaders }
    );
  }

  const eventData = {
    data: [
      {
        event_name: body.event_name || 'CustomEvent',
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: body.event_source_url || 'https://motormaniacolombia.com',
        action_source: 'website',
        user_data: {
          client_user_agent: userAgent,
          client_ip_address: req.ip ?? '127.0.0.1',
          em: body.hashed_email || undefined,
        },
      },
    ],
  };

  const fbRes = await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...eventData, access_token: accessToken }),
  });

  const data = await fbRes.json();
  return new NextResponse(JSON.stringify(data), { headers: corsHeaders });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.motormaniacolombia.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};