// /app/api/bold-signature/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, amount, currency, description } = body;

    const secretKey = 'Tleqx9F6wg1ZQgaapnveIw'; // Llave secreta
    const payload = `${orderId}|${amount}|${currency}|${description}`;
    const hash = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');

    return NextResponse.json({ hash });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}