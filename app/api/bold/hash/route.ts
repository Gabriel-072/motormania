import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { orderId, amount, currency } = await req.json();
    if (!orderId || !amount || !currency) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const secretKey = process.env.BOLD_SECRET_KEY!;
    const raw = `${orderId}${amount}${currency}${secretKey}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');

    return NextResponse.json({ hash });
  } catch (err: any) {
    console.error('Hash generation error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}