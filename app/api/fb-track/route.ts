//api/fb-track/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

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

  // Relax referer check for internal webhook calls
  const referer = req.headers.get('referer') || '';
  const allowedDomains = [
    'https://motormania.app',
    'https://www.motormania.app',
    'http://localhost:3000',
    'https://mmc.ngrok.app',
  ];
  const isWebhookCall = req.headers.get('x-webhook-source') === 'bold'; // Custom header to identify Bold webhook
  if (!isWebhookCall && !allowedDomains.some(domain => referer.startsWith(domain))) {
    return new NextResponse(
      JSON.stringify({ error: 'Acceso no autorizado' }),
      { status: 403, headers: corsHeaders }
    );
  }

  // ✅ FIXED: Handle both parameter formats
  const customData = body.custom_data || body.params || {};
  
  // Hash email for user_data if provided
  const email = customData.email || body.user_data?.em || null;
  const hashedEmail = email && typeof email === 'string'
    ? createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
    : body.user_data?.em || null;

  const eventData = {
    data: [
      {
        event_name: body.event_name || 'CustomEvent',
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.event_id || undefined,
        event_source_url: body.event_source_url || referer || 'https://www.motormania.app',
        action_source: 'website',
        user_data: {
          client_user_agent: userAgent,
          client_ip_address: req.ip ?? '127.0.0.1',
          em: hashedEmail,
          external_id: body.user_data?.external_id || undefined,
          fbc: body.user_data?.fbc || undefined,
          fbp: body.user_data?.fbp || undefined,
        },
        custom_data: customData,
      },
    ],
  };

  console.log(`📊 Sending FB event: ${body.event_name}`, {
    event_id: body.event_id,
    custom_data_keys: Object.keys(customData),
    user_data_keys: Object.keys(eventData.data[0].user_data).filter(k => (eventData.data[0].user_data as any)[k])
  });

  const fbRes = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events`, { // Updated to v20.0
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...eventData, access_token: accessToken }),
  });

  const data = await fbRes.json();
  
  if (!fbRes.ok) {
    console.error('❌ Facebook API error:', data);
    return new NextResponse(JSON.stringify({ error: 'Facebook API failed', details: data }), { 
      status: fbRes.status, 
      headers: corsHeaders 
    });
  }

  console.log('✅ Facebook event sent successfully:', data);
  return new NextResponse(JSON.stringify(data), { headers: corsHeaders });
}