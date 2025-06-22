import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto'; // Add crypto for hashing email

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.motormania.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function OPTIONS() {
  return NextResponse.json({}, {
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
  const blockedAgents = ['curl', 'postman', 'insomnia', 'httpclient'];
  if (blockedAgents.some(agent => userAgent.toLowerCase().includes(agent)) || userAgent.trim() === '') {
    return new NextResponse(
      JSON.stringify({ error: 'User-Agent bloqueado por seguridad' }),
      { status: 403, headers: corsHeaders }
    );
  }

  const referer = req.headers.get('referer') || '';
  const allowedDomains = [
    'https://motormania.app',
    'https://www.motormania.app',
    'https://www.motormaniacolombia.com',
    'https://motormaniacolombia.com',
    'http://localhost:3000',
    'https://mmc.ngrok.app',
  ];

  if (!allowedDomains.some(domain => referer.startsWith(domain))) {
    return new NextResponse(
      JSON.stringify({ error: 'Acceso no autorizado' }),
      { status: 403, headers: corsHeaders }
    );
  }

  // Hash email for user_data if provided
  const email = body.params?.email || null;
  const hashedEmail = email
    ? createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
    : null;

  const eventData = {
    data: [
      {
        event_name: body.event_name || 'CustomEvent',
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.event_id || undefined,
        event_source_url: body.event_source_url || referer,
        action_source: 'website',
        user_data: {
          client_user_agent: userAgent,
          client_ip_address: req.ip ?? '127.0.0.1',
          em: hashedEmail || undefined, // Add hashed email to user_data
        },
        custom_data: body.params || {},
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