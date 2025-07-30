// components/FullModal.tsx - UPDATED WITH CRYPTO PAYMENTS
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useFomoFake } from '@/lib/useFomoFake';
import {
  FaBolt,
  FaTimes,
  FaTrashAlt,
  FaCheck,
  FaExclamationTriangle,
  FaDollarSign,
  FaSpinner,
  FaWallet,
  FaGlobeAmericas,
  FaBitcoin // Add crypto icon
} from 'react-icons/fa';
import { useUser, useAuth } from '@clerk/nextjs';
import { useStickyStore } from '@/stores/stickyStore';
import { openBoldCheckout } from '@/lib/bold';
import { toast } from 'sonner';
import { createAuthClient } from '@/lib/supabase';
import { PickSelection } from '@/app/types/picks';
import { trackFBEvent } from '@/lib/trackFBEvent';
import { useRouter } from 'next/navigation';

// ✨ Currency imports
import { useCurrencyStore, useCurrencyInfo } from '@/stores/currencyStore';
import { CurrencyDisplay } from './ui/CurrencyDisplay';
import { CurrencyInput } from './ui/CurrencyInput';
import { CurrencySelector } from './ui/CurrencySelector';
import { QuickAmountButtons } from './ui/QuickAmountButtons';
import { CurrencyStatusIndicator } from './ui/CurrencyStatusIndicator';

interface FullModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RegisterPickApiResponse = {
  orderId: string;
  amount: string;
  callbackUrl: string;
  integrityKey: string;
};

type Promo = {
  name: string;
  type: 'multiplier' | 'percentage';
  factor: number;
  min_deposit: number;
  max_bonus_mmc: number;
  max_bonus_fuel: number;
};

type Wallet = {
  mmc_coins: number;
  fuel_coins: number;
  locked_mmc: number;
};

const payoutCombos: Record<number, number> = { 2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100 };
const safetyPayouts: Record<number, number[]> = {
  3: [2, 1],
  4: [5, 1.5],
  5: [10, 1.5, 1],
  6: [20, 1.5, 0.4],
  7: [30, 2.5, 1],
  8: [50, 5, 1.5]
};

export default function FullModal({ isOpen, onClose }: FullModalProps) {
  // stores & auth
  const { picks, setQualyPicks, setRacePicks } = useStickyStore();
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  // ✨ Currency store
  const { initializeCurrency, isInitialized, convertToCOP } = useCurrencyStore();
  const { minimumBet, currency } = useCurrencyInfo();

  // ✨ Dynamic minimum amount based on currency
  const defaultAmount = useMemo(() => {
    if (!isInitialized) return 20000; // COP fallback
    
    const baseDisplayAmount = Math.max(minimumBet.display, currency === 'COP' ? 20 : 5);
    return Math.round(convertToCOP(baseDisplayAmount));
  }, [isInitialized, minimumBet.display, currency, convertToCOP]);

  // local state
  const [amount, setAmount] = useState(20000);
  const [mode, setMode] = useState<'full' | 'safety'>('full');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // wallet
  const [wallet, setWallet] = useState<Wallet | null>(null);

  // promotion
  const [promo, setPromo] = useState<Promo | null>(null);

  // ✨ Payment method state - now includes crypto
  const [paymentMethod, setPaymentMethod] = useState<'bold' | 'wallet' | 'crypto'>('bold');

  // Notificaciones FOMO
  const fomoMsg = useFomoFake(2500);

  // combined picks
  const combinedPicks: PickSelection[] = [
    ...(picks.qualy ?? []),
    ...(picks.race ?? [])
  ];
  const totalPicks = combinedPicks.length;

  // ✨ Initialize currency system
  useEffect(() => {
    if (isOpen && !isInitialized) {
      initializeCurrency();
    }
  }, [isOpen, initializeCurrency, isInitialized]);

  // ✨ Set default amount when currency system is ready
  useEffect(() => {
    if (isInitialized && amount === 20000) {
      setAmount(defaultAmount);
    }
  }, [isInitialized, defaultAmount]);

  // ✨ InitiateCheckout tracking helper
  const trackInitiateCheckout = useCallback((paymentMethodUsed: string) => {
    console.log(`🎯 Tracking InitiateCheckout - ${paymentMethodUsed} payment button clicked`);
    
    if (typeof window !== 'undefined' && window.fbq) {
      const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
      const eventData = {
        value: copAmount / 1000,
        currency: 'COP',
        content_type: 'product',
        content_category: 'sports_betting',
        content_ids: [`mmc_picks_${totalPicks}`],
        content_name: `MMC GO ${mode === 'full' ? 'Full Throttle' : 'Safety Car'} (${totalPicks} picks)`,
        num_items: totalPicks,
        payment_method: paymentMethodUsed,
      };

      window.fbq('track', 'InitiateCheckout', eventData);
      trackFBEvent('InitiateCheckout', {
        params: eventData,
        email: user?.primaryEmailAddress?.emailAddress
      });
      
      console.log('✅ InitiateCheckout tracked:', eventData);
    }
  }, [amount, totalPicks, mode, user, currency, convertToCOP]);

  // Fetch wallet balance
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    (async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) return;
        const sb = createAuthClient(token);
        const { data } = await sb
          .from('wallet')
          .select('mmc_coins,fuel_coins,locked_mmc')
          .eq('user_id', user.id)
          .single();
        if (data) setWallet(data as Wallet);
      } catch (e) {
        console.warn('No se pudo leer saldo wallet', e);
      }
    })();
  }, [isOpen, user, getToken]);

  // Fetch active promo
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) return;
        const supabase = createAuthClient(token);
        const { data: pr } = await supabase
          .from('deposit_promos')
          .select('name,type,factor,min_deposit,max_bonus_mmc,max_bonus_fuel')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (pr) setPromo(pr as Promo);
      } catch (e) {
        console.warn('Failed to fetch promo:', e);
      }
    })();
  }, [getToken]);

  // ✨ UPDATED: Validation with currency-aware minimum
  useEffect(() => {
    let msg: string | null = null;
    const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
    const betMmc = Math.round(copAmount / 1000);
    const minCOPAmount = isInitialized ? convertToCOP(minimumBet.display) : 20000;
    
    if (totalPicks < 2) msg = 'Elige al menos 2 picks';
    else if (totalPicks > 8) msg = 'Máximo 8 picks por jugada';
    else if (combinedPicks.some(p => !p.betterOrWorse))
      msg = 'Completa todos tus picks (Mejor/Peor)';
    else if (copAmount < minCOPAmount) 
      msg = `Monto mínimo ${minimumBet.formatted}`;
    else if (mode === 'safety' && totalPicks < 3)
      msg = 'Safety requiere mínimo 3 picks';
    else if (
      paymentMethod === 'wallet' &&
      wallet &&
      betMmc > wallet.mmc_coins - wallet.locked_mmc
    )
      msg = `Saldo insuficiente: necesitas ${betMmc} MMC Coins`;
    setError(msg);
    setIsValid(!msg);
  }, [combinedPicks, totalPicks, amount, mode, paymentMethod, wallet, isInitialized, minimumBet, currency, convertToCOP]);

  // ✨ Payment method handler
  const handlePaymentMethodChange = useCallback((method: 'bold' | 'wallet' | 'crypto') => {
    setPaymentMethod(method);
  }, []);

  // Helpers para editar picks
  const updatePick = useCallback((idx: number, better: boolean) => {
    const flag = better ? 'mejor' : 'peor';
    if (idx < picks.qualy.length) {
      setQualyPicks(
        picks.qualy.map((p, i) => (i === idx ? { ...p, betterOrWorse: flag } : p))
      );
    } else {
      const rel = idx - picks.qualy.length;
      setRacePicks(
        picks.race.map((p, i) => (i === rel ? { ...p, betterOrWorse: flag } : p))
      );
    }
  }, [picks, setQualyPicks, setRacePicks]);

  const removePick = useCallback((idx: number) => {
    if (idx < picks.qualy.length) {
      setQualyPicks(picks.qualy.filter((_, i) => i !== idx));
    } else {
      const rel = idx - picks.qualy.length;
      setRacePicks(picks.race.filter((_, i) => i !== rel));
    }
  }, [picks, setQualyPicks, setRacePicks]);

  // ✨ NEW: Crypto payment handler
  const handleCryptoPayment = async () => {
    if (!user?.id || isProcessing || !isValid) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) { toast.error('Tu cuenta no tiene email'); return; }

    setIsProcessing(true);
    setError(null);

    try {
      const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
      const orderId = `CRYPTO-${Date.now()}-${user.id}`;

      const res = await fetch('/api/crypto-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(copAmount),
          picks: combinedPicks,
          mode,
          userEmail: email,
          userName: user.fullName ?? 'Jugador MMC',
          orderId
        })
      });

      if (!res.ok) {
        const { error: e } = await res.json().catch(() => ({}));
        throw new Error(e ?? 'Error creando pago crypto.');
      }

      const { checkoutUrl, success } = await res.json();
      
      if (success && checkoutUrl) {
        // Open crypto checkout in new tab
        window.open(checkoutUrl, '_blank');
        toast.success('Redirigido a pago crypto - completa el pago en la nueva ventana');
        
        // Clear picks optimistically
        setQualyPicks([]); 
        setRacePicks([]);
        onClose();
      } else {
        throw new Error('No se pudo crear el checkout crypto');
      }

    } catch (err: any) {
      toast.error(err.message ?? 'Error iniciando pago crypto');
    } finally {
      setIsProcessing(false);
    }
  };

  // Wallet bet handler
  const handleWalletBet = async () => {
    if (!user?.id || !wallet) return;
    setIsProcessing(true);

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Token inválido');
      const sb = createAuthClient(token);

      const copAmount = currency === 'COP' ? amount : convertToCOP(amount);

      const { error } = await sb.rpc('register_picks_with_wallet', {
        p_user_id: user.id,
        p_picks: combinedPicks,
        p_mode: mode,
        p_amount: Math.round(copAmount)
      });
      if (error) throw new Error(error.message);

      await fetch('/api/picks/email-with-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.primaryEmailAddress?.emailAddress,
          name: user.fullName,
          amount: Math.round(copAmount),
          mode,
          picks: combinedPicks,
          orderId: `WALLET-${Date.now()}`
        })
      });

      toast.success('¡Jugaste usando tu saldo! 🎉');
      setQualyPicks([]); setRacePicks([]);
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Error usando saldo');
    } finally {
      setIsProcessing(false);
    }
  };

  // Bold payment handler
  const handleBoldPayment = async () => {
    if (!user?.id || isProcessing || !isValid) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) { toast.error('Tu cuenta no tiene email'); return; }

    setIsProcessing(true);
    setError(null);

    try {
      const copAmount = currency === 'COP' ? amount : convertToCOP(amount);

      const res = await fetch('/api/transactions/register-pick-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: combinedPicks,
          mode,
          amount: Math.round(copAmount),
          gpName: combinedPicks[0]?.gp_name ?? 'GP',
          fullName: user.fullName,
          email
        })
      });
      if (!res.ok) {
        const { error: e } = await res.json().catch(() => ({}));
        throw new Error(e ?? 'Error registrando jugada.');
      }
      const { orderId, amount: amtStr, callbackUrl, integrityKey } =
        (await res.json()) as RegisterPickApiResponse;

      openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
        orderId,
        amount: amtStr,
        currency: 'COP',
        description: `MMC GO (${totalPicks} picks) - ${mode === 'full' ? 'Full' : 'Safety'}`,
        redirectionUrl: callbackUrl,
        integritySignature: integrityKey,
        customerData: JSON.stringify({ email, fullName: user.fullName ?? 'Jugador MMC' }),
        renderMode: 'embedded',
        onSuccess: async () => {
          if (typeof window !== 'undefined' && window.fbq) {
            const eventId = `purchase_${orderId}_${user.id}`;
            window.fbq('track', 'Purchase', {
              value: copAmount / 1000,
              currency: 'COP',
              content_type: 'product',
              content_category: 'sports_betting',
              content_ids: [`mmc_picks_${totalPicks}`],
              content_name: `MMC GO ${mode === 'full' ? 'Full Throttle' : 'Safety Car'} (${totalPicks} picks)`,
              num_items: totalPicks,
              eventID: eventId,
            });
          }

          toast.success('Pago recibido, procesando…');
          try {
            const token = await getToken({ template: 'supabase' });
            if (token) {
              const sb = createAuthClient(token);
              await sb.rpc('consume_locked_mmc', {
                p_user_id: user.id,
                p_bet_mmc: Math.round(copAmount / 1000)
              });
            }
          } catch (err) {
            console.warn('consume_locked_mmc failed', err);
          }
          setQualyPicks([]); setRacePicks([]); onClose();
          setIsProcessing(false);
        },
        onFailed: ({ message }: { message?: string }) => {
          toast.error(`Pago falló: ${message ?? ''}`);
          setIsProcessing(false);
        },
        onPending: () => {
          toast.info('Pago pendiente de confirmación.');
          setIsProcessing(false);
        },
        onClose: () => setIsProcessing(false)
      });
    } catch (err: any) {
      toast.error(err.message ?? 'Error iniciando pago');
      setIsProcessing(false);
    }
  };

  // ✨ Handle auth requirement
  const handleAuthRequired = () => {
    localStorage.setItem('pendingPicks', JSON.stringify(picks));
    
    if (typeof window !== 'undefined' && (window as any).hj) {
      try {
        (window as any).hj('event', 'auth_required_for_betting');
      } catch (e) {}
    }
    
    const currentUrl = window.location.pathname + window.location.search;
    router.push(`/sign-up?redirect_url=${encodeURIComponent(currentUrl)}`);
  };

  // ✨ Main confirm handler
  const handleConfirm = () => {
    if (!isSignedIn) {
      handleAuthRequired();
      return;
    }
    
    trackInitiateCheckout(paymentMethod);
    
    if (paymentMethod === 'wallet') return handleWalletBet();
    if (paymentMethod === 'crypto') return handleCryptoPayment();
    handleBoldPayment(); // Default to Bold
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="w-full max-w-2xl p-4">
            <motion.div
              className="bg-gray-900/80 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50 shadow-xl flex flex-col max-h-[90vh]"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            >
              {/* Header with currency selector */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700/50">
                <h2 className="text-xl font-bold text-amber-400">Revisa tus Picks</h2>
                <div className="flex items-center gap-4">
                  <CurrencySelector />
                  <button onClick={onClose} aria-label="Cerrar"
                    className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/60">
                    <FaTimes size={20} />
                  </button>
                </div>
              </div>

              {/* Promo message */}
              {promo ? (
                <div className="mb-4 text-sm text-gray-300">
                  {amount < promo.min_deposit ? (
                    <p>
                      Deposita al menos{' '}
                      <span className="font-semibold text-amber-400">
                        <CurrencyDisplay copAmount={promo.min_deposit} />
                      </span>{' '}
                      para recibir la promoción.
                    </p>
                  ) : (
                    <p>
                      🎉 Con{' '}
                      <span className="font-semibold text-cyan-400">
                        <CurrencyDisplay copAmount={amount} />
                      </span>{' '}
                      recibes{' '}
                      <span className="font-semibold text-green-400">
                        <CurrencyDisplay copAmount={amount} />
                      </span>{' '}
                      de bonus! (100% Deposit Bonus)
                    </p>
                  )}
                </div>
              ) : (
                <p className="mb-4 text-sm text-gray-300">No hay promoción activa.</p>
              )}

              {/* picks list */}
              <div className="flex-grow overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
                {combinedPicks.length ? combinedPicks.map((pick, idx) => (
                  <motion.div
                    key={`${pick.driver}-${idx}`}
                    layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: .15 } }}
                    className="flex items-center gap-3 bg-gray-800/70 rounded-lg p-3 border border-gray-700/60 hover:border-cyan-600/70"
                  >
                    <Image
                      src={`/images/pilots/${pick.driver.toLowerCase().replace(/ /g, '-')}.png`}
                      alt={pick.driver}
                      width={48} height={48} unoptimized
                      className="rounded-full w-10 h-10 object-cover border-2 border-gray-600"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).src = '/images/pilots/default-pilot.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{pick.driver}</p>
                      <p className="text-gray-400 text-xs truncate">{pick.team}</p>
                      <p className="text-cyan-400 text-xs">
                        Línea ({pick.session_type === 'qualy' ? 'Q' : 'R'}):{' '}
                        <span className="font-semibold">{pick.line.toFixed(1)}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end ml-2 gap-1">
                      <div className="flex gap-1">
                        <button onClick={() => updatePick(idx, true)}
                          className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1
                            ${pick.betterOrWorse === 'mejor'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-600 hover:bg-green-700 text-gray-200'}`}>
                          <FaCheck size={10} /> Mejor
                        </button>
                        <button onClick={() => updatePick(idx, false)}
                          className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1
                            ${pick.betterOrWorse === 'peor'
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-600 hover:bg-red-700 text-gray-200'}`}>
                          <FaTimes size={10} /> Peor
                        </button>
                      </div>
                      <button onClick={() => removePick(idx)}
                        className="text-gray-500 hover:text-red-500 text-[11px] flex items-center gap-1">
                        <FaTrashAlt className="w-3 h-3" /> Eliminar
                      </button>
                    </div>
                  </motion.div>
                )) : (
                  <p className="text-center text-gray-400 py-6">No has seleccionado picks.</p>
                )}
              </div>

              {/* controls */}
              <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
                {/* ✨ Payment Method Selection (only for authenticated users) */}
                {isSignedIn && (
                  <div className="space-y-3">
                    {/* Wallet balance */}
                    {wallet && (
                      <div className="flex items-center justify-between bg-gray-800/70 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-2 text-sm text-gray-200">
                          <FaWallet className="text-amber-400" />
                          <span>{wallet.mmc_coins - wallet.locked_mmc} MMC Coins</span>
                          <span className="text-gray-400">
                            (
                            <CurrencyDisplay copAmount={(wallet.mmc_coins - wallet.locked_mmc) * 1000} />
                            )
                          </span>
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={paymentMethod === 'wallet'}
                            onChange={() => handlePaymentMethodChange(paymentMethod === 'wallet' ? 'bold' : 'wallet')}
                            className="accent-amber-500"
                          />
                          <span>Usar saldo</span>
                        </label>
                      </div>
                    )}

                    {/* ✨ Payment method buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePaymentMethodChange('bold')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
                          paymentMethod === 'bold'
                            ? 'bg-green-600 text-white border-2 border-green-400'
                            : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                        }`}
                      >
                        <FaDollarSign size={16} />
                        <span>Tarjeta</span>
                      </button>
                      
                      <button
                        onClick={() => handlePaymentMethodChange('crypto')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
                          paymentMethod === 'crypto'
                            ? 'bg-orange-600 text-white border-2 border-orange-400'
                            : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                        }`}
                      >
                        <FaBitcoin size={16} />
                        <span>Crypto</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Information banner for users */}
                {isSignedIn && paymentMethod === 'bold' && (
                  <div className="bg-gradient-to-r from-green-800/30 to-blue-800/30 rounded-lg p-4 border border-green-700/50">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">💳</div>
                      <div>
                        <h4 className="text-sm font-semibold text-green-400 mb-1">Pago Seguro</h4>
                        <p className="text-xs text-gray-300">
                          Procesamos tu pago de forma segura con tarjetas a través de Bold
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ✨ Crypto payment info */}
                {isSignedIn && paymentMethod === 'crypto' && (
                  <div className="bg-gradient-to-r from-orange-800/30 to-yellow-800/30 rounded-lg p-4 border border-orange-700/50">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">₿</div>
                      <div>
                        <h4 className="text-sm font-semibold text-orange-400 mb-1">Pago Crypto</h4>
                        <p className="text-xs text-gray-300">
                          Paga con Bitcoin, Ethereum, USDC y otras criptomonedas
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount input */}
                <div className="space-y-2">
                  <CurrencyInput
                    copValue={amount}
                    onCOPChange={setAmount}
                    className="w-full py-2 rounded-lg bg-gray-700/60 border border-gray-600 text-white font-semibold text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Enter amount"
                  />
                  {currency !== 'COP' && (
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <CurrencyStatusIndicator />
                    </div>
                  )}
                </div>

                {/* Quick add buttons */}
                <QuickAmountButtons
                  onAmountAdd={(copAmount) => setAmount(a => a + copAmount)}
                  onClear={() => setAmount(defaultAmount)}
                />

                {/* mode */}
                <div className="flex justify-center bg-gray-800/80 rounded-lg p-1">
                  <button onClick={() => setMode('full')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold
                      ${mode === 'full' ? 'bg-amber-500 text-black' : 'text-gray-300 hover:bg-gray-700/50'}`}>
                    🚀 Full Throttle
                  </button>
                  <button onClick={() => setMode('safety')} disabled={totalPicks < 3}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold
                      ${mode === 'safety' ? 'bg-amber-500 text-black' : 'text-gray-300 hover:bg-gray-700/50'}
                      ${totalPicks < 3 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    🛡️ Safety Car
                  </button>
                </div>

                {/* Payout info */}
                <div className="bg-gray-800/70 p-3 rounded-lg text-sm text-gray-200 space-y-1 border border-gray-700/60">
                  {mode === 'full' ? (
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-xs">{totalPicks} Aciertos</span>
                      <span>
                        <span className="text-cyan-400 font-bold">{payoutCombos[totalPicks] || 0}x</span>
                        <span className="text-gray-400 text-xs"> → </span>
                        <span className="text-green-400 font-bold">
                          <CurrencyDisplay copAmount={amount * (payoutCombos[totalPicks] || 0)} />
                        </span>
                      </span>
                    </div>
                  ) : (
                    (safetyPayouts[totalPicks] || []).map((m, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-400 text-xs">{totalPicks - i} Aciertos</span>
                        <span>
                          <span className="text-cyan-400 font-bold">{m}x</span>
                          <span className="text-gray-400 text-xs"> → </span>
                          <span className="text-white font-semibold">
                            <CurrencyDisplay copAmount={m * amount} />
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* FOMO Bar */}
                {fomoMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="
                      flex items-center justify-center h-9 rounded-lg
                      bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-700
                      text-white font-bold text-sm tracking-wide
                      shadow-[0_0_10px_rgba(255,215,0,0.35)]
                      select-none
                    "
                  >
                    <FaBolt className="mr-1 text-yellow-300" /> {fomoMsg}
                  </motion.div>
                )}

                {/* error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-center text-red-400 text-sm flex items-center justify-center gap-1"
                    >
                      <FaExclamationTriangle /> {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* ✨ UPDATED: Confirm Button with dynamic text */}
                <button
                  onClick={handleConfirm}
                  disabled={!isValid || isProcessing}
                  className={`
                    w-full py-3 rounded-lg font-bold text-lg flex justify-center gap-2
                    ${isProcessing
                      ? 'bg-yellow-600 text-white cursor-wait'
                      : isValid
                        ? paymentMethod === 'crypto'
                          ? 'bg-gradient-to-r from-orange-500 to-yellow-600 text-white'
                          : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                        : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                  `}
                >
                  {isProcessing ? (
                    <>
                      <FaSpinner className="animate-spin" /> Procesando…
                    </>
                  ) : !isSignedIn ? (
                    <>Confirmar y Pagar <CurrencyDisplay copAmount={amount} /></>
                  ) : paymentMethod === 'wallet' ? (
                    <>🎮 Jugar <CurrencyDisplay copAmount={amount} /></> 
                  ) : paymentMethod === 'crypto' ? (
                    <>
                      <FaBitcoin /> Pagar con Crypto <CurrencyDisplay copAmount={amount} />
                    </>
                  ) : (
                    <>
                      <FaDollarSign /> Confirmar y Pagar <CurrencyDisplay copAmount={amount} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}  