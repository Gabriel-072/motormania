// 📁 app/api/promocodes/redeem/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth }                     from '@clerk/nextjs/server';
import { createClient }             from '@supabase/supabase-js';
import { Resend }                   from 'resend';

/* ────── ENV ────── */
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = 'MotorMania <noreply@motormania.app>';
const SITE_URL   = 'https://motormania.app';

/* ────── CLIENTES ────── */
const resend   = new Resend(RESEND_API_KEY);

/**
 * POST /api/promocodes/redeem
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const { code } = await req.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    // 🔥 FIXED: Use new cash-only promo system
    const { data: result, error } = await supabase.rpc('redeem_promo_code', {
      p_user_id: userId,
      p_code: code
    });

    if (error) {
      console.error('Promo redemption error:', error);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    const redemption = result[0];
    if (!redemption.success) {
      return NextResponse.json({ error: redemption.error_message }, { status: 400 });
    }

    // Send confirmation email
    const { data: userRow } = await supabase
      .from('clerk_users')
      .select('email, full_name')
      .eq('clerk_id', userId)
      .maybeSingle();

    if (userRow?.email) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: userRow.email,
          subject: '¡Tu código promocional fue canjeado!',
          html: `
            <p>Hola ${userRow.full_name || 'Jugador'},</p>
            <p>Tu código promocional <strong>${code}</strong> ha sido aplicado con éxito.</p>
            <p>Has recibido: <strong>$${redemption.cash_amount.toLocaleString('es-CO')} COP</strong></p>
            <p>Ya puedes ver tu saldo actualizado en tu <a href="${SITE_URL}/wallet">billetera</a>.</p>
            <p>¡Gracias por jugar con MotorMania!</p>
          `
        });
      } catch (emailErr) {
        console.error('Error enviando email de confirmación de promo code:', emailErr);
      }
    }

    return NextResponse.json({
      message: `¡Código aplicado! +$${redemption.cash_amount.toLocaleString('es-CO')} COP`
    });

  } catch (err: any) {
    console.error('Promo code redemption failed:', err);
    return NextResponse.json({ error: 'Error procesando código' }, { status: 500 });
  }
}