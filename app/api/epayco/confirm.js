// app/api/epayco/confirm.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { x_ref_payco, x_amount, x_transaction_id, x_cod_response } = req.body;

  if (!x_ref_payco || !x_amount || !x_transaction_id || !x_cod_response) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    if (x_cod_response === '1') { // Transaction approved
      const userId = req.body.x_extra1;
      const amount = parseFloat(x_amount);

      const { data: wallet, error: walletError } = await supabase
        .from('wallet')
        .select('balance_cop')
        .eq('user_id', userId)
        .single();

      if (walletError) throw walletError;

      const newBalance = wallet.balance_cop + amount;

      const { error: updateError } = await supabase
        .from('wallet')
        .update({ balance_cop: newBalance })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'deposit',
        amount,
        date: new Date().toISOString(),
        description: `Depósito vía ePayco (Ref: ${x_ref_payco})`,
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Error procesando la confirmación' });
  }
}