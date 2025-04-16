// /app/api/send-coins-confirmation/route.ts
import { NextResponse } from 'next/server';
import { sendCoinsConfirmationEmail } from '@/lib/email/sendCoinsConfirmation';

export async function POST(req: Request) {
  try {
    const { to, amount, mmc, fc } = await req.json();

    if (!to || !amount || mmc === undefined || fc === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const result = await sendCoinsConfirmationEmail({ to, amount, mmc, fc });

    if (!result) {
      return NextResponse.json({ error: 'Error al enviar el correo' }, { status: 500 });
    }

    return NextResponse.json({ message: '📨 Correo enviado exitosamente.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 });
  }
}