'use client';

import { useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';

const TestSimulatePick = () => {
  const { user } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (!user) return;

    const runSimulation = async () => {
      console.log('🧪 Iniciando test de simulación...');
      const amount = 10000;
      const mmcCoins = Math.floor(amount / 1000);
      const fuelCoins = amount;

      const picks = [
        {
          driver: 'Max Verstappen',
          team: 'Red Bull',
          line: 6.5,
          betterOrWorse: 'mejor',
          session_type: 'race',
        },
        {
          driver: 'Charles Leclerc',
          team: 'Ferrari',
          line: 7.0,
          betterOrWorse: 'peor',
          session_type: 'qualy',
        },
      ];

      try {
        const token = await getToken({ template: 'supabase' });
        const supabase = createAuthClient(token!);

        // 1. Guardar picks
        const { error: pickError } = await supabase
          .from('picks')
          .insert({
            user_id: user.id,
            gp_name: 'GP Test',
            session_type: 'combined',
            picks,
            multiplier: 3,
            wager_amount: amount,
            potential_win: 30000,
            name: user.fullName || 'Tester MMC',
            mode: 'Full Throttle',
          });

        if (pickError) throw new Error('Error insertando picks: ' + pickError.message);

        // 2. Coin Purchase
        const { error: purchaseError } = await supabase
          .from('coin_purchases')
          .insert({
            user_id: user.id,
            mmc_coins_purchased: mmcCoins,
            fuel_coins_received: fuelCoins,
            amount_paid: amount,
            payment_status: 'paid',
            package_id: null,
          });

        if (purchaseError) throw new Error('Error coin_purchases: ' + purchaseError.message);

        // 3. Wallet RPC
        const { error: walletError } = await supabase.rpc('increment_wallet_balances', {
          p_user_id: user.id,
          p_mmc: mmcCoins,
          p_fc: fuelCoins,
        });

        if (walletError) throw new Error('Error RPC wallet: ' + walletError.message);

        // 4. Emails
        await fetch('/api/send-coins-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: user.primaryEmailAddress?.emailAddress, amount, mmc: mmcCoins, fc: fuelCoins }),
        });

        await fetch('/api/send-pick-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.primaryEmailAddress?.emailAddress,
            name: user.fullName || 'Tester MMC',
            amount,
            mode: 'Full Throttle',
            picks,
          }),
        });

        console.log('✅ Simulación completada con éxito (picks + wallet + emails)');
      } catch (err: any) {
        console.error('❌ Error general:', err.message || err);
      }
    };

    runSimulation();
  }, [user]);

  return <div className="p-6 text-white">🧪 Simulación ejecutándose en consola...</div>;
};

export default TestSimulatePick;