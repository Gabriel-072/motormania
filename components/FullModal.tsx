'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { FaTimes } from 'react-icons/fa';
import { useStickyStore } from '@/stores/stickyStore';
import { openBoldCheckout } from '@/lib/bold';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { PickSelection } from '../app/types/picks';

export type SessionType = 'qualy' | 'race';

interface FullModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FullModal: React.FC<FullModalProps> = ({ isOpen, onClose }) => {
  const { picks, setQualyPicks, setRacePicks } = useStickyStore();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [amount, setAmount] = useState<number>(10000);
  const [mode, setMode] = useState<'full' | 'safety'>('full');
  const [estimatedPayout, setEstimatedPayout] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);

  const combinedPicks: PickSelection[] = [...(picks.qualy || []), ...(picks.race || [])];

  const payoutCombos: Record<number, number> = {
    2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100,
  };

  const safetyPayouts: Record<number, number[]> = {
    3: [2, 1],
    4: [5, 1.5],
    5: [10, 1.5, 1],
    6: [20, 1.5, 0.4],
    7: [30, 2.5, 1],
    8: [50, 5, 1.5],
  };

  useEffect(() => {
    const multiplier = payoutCombos[combinedPicks.length] || 0;
    setEstimatedPayout(multiplier * amount);
  }, [combinedPicks.length, amount, mode]);

  useEffect(() => {
    let msg: string | null = null;
    if (combinedPicks.length < 2) msg = 'Elige al menos 1 pick más';
    else if (combinedPicks.length > 8) msg = 'Máximo 8 picks por jugada';
    else if (combinedPicks.some((p: PickSelection) => p.betterOrWorse === null))
      msg = 'Completa todos tus picks con Mejor o Peor';

    setError(msg);
    setIsValid(!msg);
  }, [combinedPicks]);

  const updatePick = (index: number, better: boolean): void => {
    const qualyCount = picks.qualy.length;
    if (index < qualyCount) {
      const updated = picks.qualy.map((p: PickSelection, i: number) =>
        i === index ? { ...p, betterOrWorse: better ? 'mejor' : 'peor' } as PickSelection : p
      );
      setQualyPicks(updated);
    } else {
      const raceIndex = index - qualyCount;
      const updated = picks.race.map((p: PickSelection, i: number) =>
        i === raceIndex ? { ...p, betterOrWorse: better ? 'mejor' : 'peor' } as PickSelection : p
      );
      setRacePicks(updated);
    }
  };

  const removePick = (index: number): void => {
    const qualyCount = picks.qualy.length;
    if (index < qualyCount) {
      const updated = picks.qualy.filter((_, i) => i !== index);
      setQualyPicks(updated);
    } else {
      const raceIndex = index - qualyCount;
      const updated = picks.race.filter((_, i) => i !== raceIndex);
      setRacePicks(updated);
    }
  };

  const handleBoldPayment = async () => {
    if (!user) return;
    const orderId = `MMC-${Date.now()}`;
    const response = await fetch('/api/bold/hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount, currency: 'COP' }),
    });

    const { hash } = await response.json();

    openBoldCheckout({
      apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
      orderId,
      amount,
      currency: 'COP',
      description: `PICKS ${mode === 'full' ? 'Full Throttle' : 'Safety Car'}`,
      redirectionUrl: 'https://motormaniacolombia.com/dashboard',
      integritySignature: hash,
      customerData: {
        email: user?.primaryEmailAddress?.emailAddress || '',
        fullName: user?.fullName || 'Jugador MMC',
      },
      onSuccess: async () => {
        console.log('✅ Bold pago exitoso, ejecutando lógica de picks + monedas...');
        try {
          const token = await getToken({ template: 'supabase' });
          const supabase = createAuthClient(token!);
      
          const mmcCoins = Number((amount / 1000).toFixed(2)); // <-- ya es tipo numeric
const fuelCoins = Number(amount.toFixed(2));
const copAmount = Number(amount.toFixed(2)); // este también
      
          // 1. Guardar picks
          const { data: insertedPick, error: pickError } = await supabase
            .from('picks')
            .insert({
              user_id: user.id,
              gp_name: combinedPicks[0]?.gp_name || 'GP Desconocido',
              session_type: 'combined',
              picks: combinedPicks,
              multiplier: payoutCombos[combinedPicks.length] || 0,
              wager_amount: amount,
              potential_win: (payoutCombos[combinedPicks.length] || 0) * amount,
              name: user.fullName || 'Jugador MMC',
              mode: mode === 'full' ? 'Full Throttle' : 'Safety Car',
            })
            .select()
            .single();
      
          if (pickError) {
            console.error('❌ Error guardando pick:', pickError.message);
            return;
          }
      
          // 2. Registrar coin_purchases
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
      
          if (purchaseError) {
            console.error('❌ Error registrando coin_purchases:', purchaseError.message);
            return;
          }
      
          // 3. Actualizar saldos en wallet
          const { error: walletError } = await supabase.rpc('increment_wallet_balances', {
            uid: user.id,
            mmc_amount: mmcCoins,
            fuel_amount: fuelCoins,
            cop_amount: amount,
          });
      
          if (walletError) {
            console.error('❌ Error actualizando wallet:', walletError.message);
            return;
          }
      
          // 4. Enviar email de confirmación de monedas
          await fetch('/api/send-coins-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: user?.primaryEmailAddress?.emailAddress,
              amount,
              mmc: mmcCoins,
              fc: fuelCoins,
            }),
          });
      
          // 5. Enviar email de resumen de picks
          await fetch('/api/send-pick-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: user?.primaryEmailAddress?.emailAddress,
              name: user?.fullName || 'Jugador MMC',
              picks: combinedPicks,
              mode: mode === 'full' ? 'Full Throttle' : 'Safety Car',
              wager_amount: amount,
              potential_win: (payoutCombos[combinedPicks.length] || 0) * amount,
            }),
          });
      
          console.log('✅ Todo guardado y correos enviados');
        } catch (err) {
          console.error('❌ Error general en onSuccess:', err);
        }
      }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full sm:max-w-2xl bg-[#051C24] rounded-t-2xl sm:rounded-xl p-4 sm:p-6"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 180 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Revisa tus Picks</h2>
              <button onClick={onClose} className="text-white hover:text-red-400 transition">
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {combinedPicks.map((pick, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 bg-[#0A2B37] rounded-xl px-4 py-3 border border-white/10"
                >
                  <Image
                    src={`/images/pilots/${pick.driver.toLowerCase().replace(/ /g, '-')}.png`}
                    alt={pick.driver}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm sm:text-base">{pick.driver}</p>
                    <p className="text-gray-300 text-xs">{pick.team}</p>
                    <p className="text-cyan-400 text-xs">
                      Línea: <span className="font-semibold">{pick.line.toFixed(1)}</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      <button
                        onClick={() => updatePick(idx, true)}
                        className={`text-xs px-2 py-1 rounded font-bold ${
                          pick.betterOrWorse === 'mejor' ? 'bg-green-600' : 'bg-gray-700'
                        } text-white`}
                      >
                        Mejor
                      </button>
                      <button
                        onClick={() => updatePick(idx, false)}
                        className={`text-xs px-2 py-1 rounded font-bold ${
                          pick.betterOrWorse === 'peor' ? 'bg-red-600' : 'bg-gray-700'
                        } text-white`}
                      >
                        Peor
                      </button>
                    </div>
                    <button
                      onClick={() => removePick(idx)}
                      className="text-gray-300 hover:text-red-400 text-xs"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              <input
                type="number"
                value={amount === 0 ? '' : amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setAmount(0);
                  } else {
                    const num = parseInt(val);
                    if (!isNaN(num)) setAmount(num);
                  }
                }}
                placeholder="$10.000"
                className="w-full py-2 px-4 rounded-xl bg-white text-gray-900 font-bold"
              />
              <div className="flex justify-center gap-3">
                {[10000, 50000, 100000, 200000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount((prev) => prev + amt)}
                    className="px-4 py-1 rounded-full text-sm font-semibold bg-gray-700 text-white hover:bg-gray-600 transition"
                  >
                    +${amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setMode('full')}
                  className={`px-3 py-2 rounded-xl font-bold text-sm ${
                    mode === 'full' ? 'bg-amber-500 text-gray-900' : 'bg-gray-700 text-white'
                  }`}
                >
                  Full Throttle
                </button>
                <button
                  onClick={() => setMode('safety')}
                  className={`px-3 py-2 rounded-xl font-bold text-sm ${
                    mode === 'safety' ? 'bg-amber-500 text-gray-900' : 'bg-gray-700 text-white'
                  }`}
                >
                  Safety Car
                </button>
              </div>
              <div className="bg-gray-800 p-3 rounded-xl text-white space-y-1 text-sm">
                {mode === 'full' ? (
                  <p>
                    {combinedPicks.length} Aciertos = {(payoutCombos[combinedPicks.length] || 0)}x → $
                    {(amount * (payoutCombos[combinedPicks.length] || 0)).toLocaleString()}
                  </p>
                ) : (
                  (safetyPayouts[combinedPicks.length] || []).map((mult, idx) => (
                    <p key={idx}>
                      {combinedPicks.length - idx} Aciertos = {mult}x → ${(mult * amount).toLocaleString()}
                    </p>
                  ))
                )}
              </div>
              <button onClick={handleBoldPayment} disabled={!isValid} className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${isValid ? 'bg-green-500 hover:bg-green-400 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>{error ? error : 'Confirmar y Pagar con Bold'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullModal;