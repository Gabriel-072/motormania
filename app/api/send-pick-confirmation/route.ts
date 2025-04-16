// app/api/send-pick-confirmation/route.ts

import { NextResponse } from 'next/server';
import { sendPickConfirmationEmail } from '@/lib/email/sendPickConfirmation';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    await sendPickConfirmationEmail({
      to: body.to,
      name: body.name,
      amount: body.amount,
      mode: body.mode,
      picks: body.picks,
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('❌ Error en /api/send-pick-confirmation:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}