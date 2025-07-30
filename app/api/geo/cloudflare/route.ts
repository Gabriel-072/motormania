// app/api/geo/cloudflare/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Cloudflare adds geo headers to requests
    const country = request.headers.get('cf-ipcountry') || 
                   request.headers.get('CF-IPCountry') ||
                   request.geo?.country;
                   
    const continent = request.headers.get('cf-ipcontinent') ||
                     request.headers.get('CF-IPContinent') ||
                     request.geo?.region;
                     
    const timezone = request.headers.get('cf-timezone') ||
                    request.headers.get('CF-Timezone');

    // Also check Vercel's geo data if available
    const vercelCountry = request.headers.get('x-vercel-ip-country');
    const vercelRegion = request.headers.get('x-vercel-ip-country-region');

    const geoData = {
      country: country || vercelCountry || null,
      continent: continent || null,
      timezone: timezone || null,
      region: vercelRegion || null,
      source: country ? 'cloudflare' : vercelCountry ? 'vercel' : 'unknown'
    };

    console.log('🌍 Geo detection from headers:', geoData);

    return NextResponse.json(geoData);
  } catch (error) {
    console.error('Cloudflare geo detection error:', error);
    return NextResponse.json({ error: 'Geo detection failed' }, { status: 500 });
  }
}