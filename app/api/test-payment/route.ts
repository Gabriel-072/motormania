import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  const user_id = 'user_2vetmie1dzrys8jtayUURvVLvk8';
  const amount = 25000;
  const mmc = Math.floor(amount / 1000); // 25 MMC
  const fc = amount; // 25.000 FC

  try {
    // 1. Insertar pick de prueba
    const { error: pickError } = await supabase.from('picks').insert({
      user_id,
      gp_name: 'Test GP',
      session_type: 'combined',
      picks: [
        {
          driver: 'Max Verstappen',
          line: 6.5,
          betterOrWorse: 'mejor',
          session_type: 'race',
        },
      ],
      multiplier: 3,
      wager_amount: amount,
      potential_win: amount * 3,
      name: 'Tester',
      mode: 'Full Throttle',
    });

    if (pickError) throw new Error('Error al guardar pick: ' + pickError.message);

    // 2. Registrar coin purchase
    const { error: purchaseError } = await supabase.from('coin_purchases').insert({
      user_id,
      mmc_coins_purchased: mmc,
      fuel_coins_received: fc,
      amount_paid: amount,
      payment_status: 'paid',
    });

    if (purchaseError) throw new Error('Error al guardar coin_purchase: ' + purchaseError.message);

    // 3. Actualizar wallet con RPC
    const { error: walletError } = await supabase.rpc('increment_wallet_balances', {
      p_user_id: user_id,
      p_mmc: mmc,
      p_fc: fc,
    });

    if (walletError) throw new Error('Error en RPC wallet: ' + walletError.message);

    // 4. Insertar log en tabla de transacciones
    const { error: txError } = await supabase.from('transactions').insert({
      user_id,
      type: 'recarga',
      amount,
      description: `Recarga de $${amount.toLocaleString('es-CO')} COP — ${mmc} MMC y ${fc.toLocaleString('es-CO')} FC`,
    });

    if (txError) throw new Error('Error al registrar transacción: ' + txError.message);

    // 5. Enviar correo de confirmación
    await resend.emails.send({
      from: 'MotorManía <noreply@motormaniacolombia.com>',
      to: ['toroveg2@gmail.com'], // o mejor: recuperar desde la tabla de usuarios
      subject: 'Recarga exitosa 🔥',
      html: `
        <div style="font-family: sans-serif; font-size: 16px; color: #111;">
          <h2>✅ ¡Recarga completada!</h2>
          <p>Has recibido <strong>${mmc} MMC</strong> y <strong>${fc.toLocaleString('es-CO')} Fuel Coins</strong> por tu depósito de <strong>$${amount.toLocaleString('es-CO')} COP</strong>.</p>
          <p>Puedes ver tu balance en tu <a href="https://motormaniacolombia.com/wallet" style="color: #0ea5e9;">billetera</a>.</p>
          <p>Gracias por ser parte de MotorManía. 🏎️</p>
        </div>
      `,
    });

    return NextResponse.json({ message: '✅ Simulación completada con éxito.' });
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}