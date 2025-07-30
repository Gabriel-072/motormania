// app/api/geo/vercel/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Extract all Vercel geo headers
    const country = request.headers.get('x-vercel-ip-country');
    const region = request.headers.get('x-vercel-ip-country-region');
    const city = request.headers.get('x-vercel-ip-city');
    const latitude = request.headers.get('x-vercel-ip-latitude');
    const longitude = request.headers.get('x-vercel-ip-longitude');
    const timezone = request.headers.get('x-vercel-ip-timezone');

    // Also check standard headers
    const userAgent = request.headers.get('user-agent');
    const acceptLanguage = request.headers.get('accept-language');

    const geoData = {
      country,
      region,
      city,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      timezone,
      userAgent,
      acceptLanguage,
      source: 'vercel'
    };

    console.log('🗺️ Vercel geo detection:', geoData);

    return NextResponse.json(geoData);
  } catch (error) {
    console.error('Vercel geo detection error:', error);
    return NextResponse.json({ error: 'Geo detection failed' }, { status: 500 });
  }
}