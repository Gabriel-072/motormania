// components/FullModal.tsx - Complete with Anonymous Payment Support
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
  FaBitcoin,
  FaCreditCard,
  FaPlay // Add additional icons for better UX
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
import { EmbeddedCryptoCheckout } from './EmbeddedCryptoCheckout';
// ✨ Payment Support Modal
import { PaymentSupportModal } from './PaymentSupportModal';

interface FullModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RegisterPickApiResponse = {
  orderId: string;
  amount: string;
  callbackUrl: string;
  integrityKey: string;
  isAnonymous?: boolean;
  sessionId?: string;
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

  // ✨ Hide crypto for Colombian users
  const showCryptoOption = currency !== 'COP';

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

  // 🆕 Anonymous payment state (simplified - no showGuestForm needed)
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  // wallet
  const [wallet, setWallet] = useState<Wallet | null>(null);

  // promotion
  const [promo, setPromo] = useState<Promo | null>(null);

  // ✨ Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'bold' | 'wallet' | 'crypto'>('bold');

  // ✨ Payment Support Modal states
  const [showPaymentSupport, setShowPaymentSupport] = useState(false);
  const [paymentError, setPaymentError] = useState<string>('');

  // Notificaciones FOMO
  const fomoMsg = useFomoFake(2500);

  // combined picks
  const combinedPicks: PickSelection[] = [
    ...(picks.qualy ?? []),
    ...(picks.race ?? [])
  ];
  const totalPicks = combinedPicks.length;

  // 🆕 Check if user is authenticated
  const isAuthenticated = !!user?.id;

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

  // 🆕 Pre-fill user data if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setEmail(user.primaryEmailAddress?.emailAddress || '');
      setFullName(user.fullName || '');
    }
  }, [isAuthenticated, user]);

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

  // 🆕 Generate anonymous session ID
  const generateAnonymousSession = useCallback(() => {
    const sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('anonymousSession', sessionId);
    return sessionId;
  }, []);

  // 🔧 SIMPLIFIED: Validation logic - no more showGuestForm dependency
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
    // For anonymous users, always check email/name since form is always visible
    else if (!isAuthenticated && (!email || !fullName))
      msg = 'Completa tu nombre y email';
    else if (!isAuthenticated && email && !email.includes('@'))
      msg = 'Email inválido';
    else if (
      paymentMethod === 'wallet' &&
      wallet &&
      betMmc > wallet.mmc_coins - wallet.locked_mmc
    )
      msg = `Saldo insuficiente: necesitas ${betMmc} MMC Coins`;
    setError(msg);
    setIsValid(!msg);
  }, [combinedPicks, totalPicks, amount, mode, paymentMethod, wallet, isAuthenticated, email, fullName, isInitialized, minimumBet, currency, convertToCOP]);

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

  // 🔧 SIMPLIFIED: Bold payment handler (no more guest form check)
  const handleBoldPayment = async () => {
    if (isProcessing || !isValid) return;

    // For authenticated users, check email
    if (isAuthenticated) {
      const userEmail = user?.primaryEmailAddress?.emailAddress;
      if (!userEmail) { 
        toast.error('Tu cuenta no tiene email'); 
        return; 
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
      const sessionId = !isAuthenticated ? generateAnonymousSession() : null;

      const res = await fetch('/api/transactions/register-pick-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: combinedPicks,
          mode,
          amount: Math.round(copAmount),
          gpName: combinedPicks[0]?.gp_name ?? 'GP',
          fullName: isAuthenticated ? user?.fullName : fullName,
          email: isAuthenticated ? user?.primaryEmailAddress?.emailAddress : email,
          anonymousSessionId: sessionId
        })
      });
      
      if (!res.ok) {
        const { error: e } = await res.json().catch(() => ({}));
        throw new Error(e ?? 'Error registrando jugada.');
      }
      
      const { orderId, amount: amtStr, callbackUrl, integrityKey, isAnonymous } =
        (await res.json()) as RegisterPickApiResponse;

      // Store session for anonymous users
      if (isAnonymous && sessionId) {
        localStorage.setItem('pendingPayment', JSON.stringify({
          orderId, amountStr: amtStr, callbackUrl, integrityKey, sessionId
        }));
      }

      openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
        orderId,
        amount: amtStr,
        currency: 'COP',
        description: `MMC GO (${totalPicks} picks) - ${mode === 'full' ? 'Full' : 'Safety'}`,
        redirectionUrl: callbackUrl,
        integritySignature: integrityKey,
        customerData: JSON.stringify({ 
          email: isAuthenticated ? user?.primaryEmailAddress?.emailAddress : email, 
          fullName: isAuthenticated ? user?.fullName ?? 'Jugador MMC' : fullName 
        }),
        renderMode: 'embedded',
        onSuccess: async () => {
          if (typeof window !== 'undefined' && window.fbq) {
            const eventId = `purchase_${orderId}_${user?.id || 'anonymous'}`;
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
          
          // Only consume locked MMC for authenticated users
          if (isAuthenticated && user?.id) {
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
          }
          
          clearDraftPicks();
          onClose();
          setIsProcessing(false);
        },
        onFailed: ({ message }: { message?: string }) => {
          setPaymentError(`Pago con tarjeta falló: ${message || 'Error desconocido'}`);
          setShowPaymentSupport(true);
          setIsProcessing(false);
        },
        onPending: () => {
          toast.info('Pago pendiente de confirmación.');
          setIsProcessing(false);
        },
        onClose: () => setIsProcessing(false)
      });
    } catch (err: any) {
      setPaymentError(`Error iniciando pago: ${err.message || 'Error desconocido'}`);
      setShowPaymentSupport(true);
      setIsProcessing(false);
    }
  };

  // 🔧 SIMPLIFIED: Crypto payment handler (no more guest form check)  
  const handleCryptoPayment = async () => {
    if (isProcessing || !isValid) return;

    // For authenticated users, check email
    if (isAuthenticated) {
      const userEmail = user?.primaryEmailAddress?.emailAddress;
      if (!userEmail) { 
        toast.error('Tu cuenta no tiene email'); 
        return; 
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
      const sessionId = !isAuthenticated ? generateAnonymousSession() : null;
      const orderId = !isAuthenticated 
        ? `CRYPTO-ANON-${Date.now()}`
        : `CRYPTO-${Date.now()}-${user?.id}`;

      const res = await fetch('/api/crypto-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(copAmount),
          picks: combinedPicks,
          mode,
          userEmail: isAuthenticated ? user?.primaryEmailAddress?.emailAddress : email,
          userName: isAuthenticated ? user?.fullName ?? 'Jugador MMC' : fullName,
          orderId,
          anonymousSessionId: sessionId
        })
      });

      if (!res.ok) {
        const { error: e } = await res.json().catch(() => ({}));
        throw new Error(e ?? 'Error creando pago crypto.');
      }

      const { checkoutUrl, success } = await res.json();
      
      if (success && checkoutUrl) {
        // Store session for anonymous users
        if (!isAuthenticated && sessionId) {
          localStorage.setItem('cryptoOrderId', orderId);
        }
        
        window.open(checkoutUrl, '_blank');
        toast.success('Abriendo pago crypto - completa en la nueva ventana');
        clearDraftPicks();
        onClose();
      } else {
        throw new Error('No se pudo crear el checkout crypto');
      }

    } catch (err: any) {
      setPaymentError(`Error con pago crypto: ${err.message || 'Error desconocido'}`);
      setShowPaymentSupport(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Wallet bet handler (authenticated users only)
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
      clearDraftPicks();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Error usando saldo');
    } finally {
      setIsProcessing(false);
    }
  };

  // Show authentication prompt (for existing auth flow)
  const showAuthPrompt = () => {
    router.push(`/sign-in?redirect_url=${encodeURIComponent('/mmc-go')}`);
  };

  // ✨ Handle modal close with support offer
  const handleClose = () => {
    // If user has valid picks but closes modal, offer support (but still close)
    if (isValid && !isProcessing && isSignedIn) {
      setPaymentError('¿Necesitas ayuda para completar tu pago?');
      setShowPaymentSupport(true);
    }
    // Always close the modal
    onClose();
  };

  // ✨ Save picks to localStorage on changes
  useEffect(() => {
    if (combinedPicks.length > 0) {
      localStorage.setItem('mmc_draft_picks', JSON.stringify({
        picks: { qualy: picks.qualy, race: picks.race },
        amount,
        mode,
        timestamp: Date.now()
      }));
    }
  }, [picks.qualy, picks.race, amount, mode, combinedPicks.length]);

  // ✨ Restore picks from localStorage on mount
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('mmc_draft_picks');
        if (saved) {
          const data = JSON.parse(saved);
          // Only restore if less than 24 hours old
          if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            if (data.picks.qualy?.length || data.picks.race?.length) {
              setQualyPicks(data.picks.qualy || []);
              setRacePicks(data.picks.race || []);
              setAmount(data.amount || defaultAmount);
              setMode(data.mode || 'full');
            }
          }
        }
      } catch (e) {
        console.warn('Failed to restore picks:', e);
      }
    }
  }, [isOpen, setQualyPicks, setRacePicks, defaultAmount]);

  // ✨ Clear draft picks on successful payment
  const clearDraftPicks = () => {
    localStorage.removeItem('mmc_draft_picks');
    setQualyPicks([]);
    setRacePicks([]);
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
                  <button onClick={handleClose} aria-label="Cerrar"
                    className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/60">
                    <FaTimes size={20} />
                  </button>
                </div>
              </div>

              {/* 🆕 FRICTION-FREE: Show guest form immediately for anonymous users */}
              {!isAuthenticated && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 space-y-3 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30"
                >
                  <div className="text-center mb-3">
                    <h4 className="text-sm font-bold text-green-400 mb-1">
                      🎯 Completa para Apostar
                    </h4>
                    <p className="text-xs text-gray-300">
                      Solo tu información básica • Pago seguro • Crea cuenta después
                    </p>
                  </div>
                  
                  {/* Mobile-optimized form */}
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-base"
                      style={{ fontSize: '16px' }} // Prevents zoom on iOS
                      placeholder="Tu nombre completo"
                      autoComplete="name"
                      autoFocus
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-base"
                      style={{ fontSize: '16px' }} // Prevents zoom on iOS
                      placeholder="tu@email.com"
                      autoComplete="email"
                    />
                  </div>
                  
                  {/* Trust signals */}
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span>Pago Seguro</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Sin Spam</span>
                    </div>
                  </div>
                </motion.div>
              )}

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
                {/* ✨ Simplified: Just wallet toggle if available */}
                {isSignedIn && wallet && (
                  <div className="flex items-center justify-between bg-gray-800/70 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <FaWallet className="text-amber-400" />
                      <span>{wallet.mmc_coins - wallet.locked_mmc} MMC Coins</span>
                      <span className="text-gray-400">
                        (<CurrencyDisplay copAmount={(wallet.mmc_coins - wallet.locked_mmc) * 1000} />)
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

                {/* 🔥 Social Proof + Live Activity */}
                {fomoMsg ? (
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
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-4 py-2 text-xs text-gray-400"
                  >
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>🔥 {Math.floor(Math.random() * 50) + 120} jugadores conectados</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1">
                      <span>⚡ {Math.floor(Math.random() * 20) + 15} apuestas en vivo</span>
                    </div>
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

                {/* 🚀 MOBILE-FIRST OPTIMIZED PAYMENT BUTTONS */}
                {!isAuthenticated ? (
                  <div className="space-y-3">
                    {/* Main Payment Buttons */}
                    {showCryptoOption ? (
                      // International users: Cash + Crypto (mobile-first layout)
                      <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-3">
                        <button
                          onClick={() => {
                            trackInitiateCheckout('bold');
                            handleBoldPayment();
                          }}
                          disabled={!isValid || isProcessing}
                          className={`
                            w-full sm:flex-1 py-4 rounded-lg font-bold text-lg flex justify-center items-center gap-2 transition-all duration-200 touch-manipulation
                            ${isProcessing
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : isValid
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 active:scale-95 shadow-lg hover:shadow-xl'
                                : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                          `}
                          style={{ minHeight: '48px' }} // Larger touch target
                        >
                          <FaDollarSign className="text-lg" />
                          <span>Tarjeta/PSE</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            trackInitiateCheckout('crypto');
                            handleCryptoPayment();
                          }}
                          disabled={!isValid || isProcessing}
                          className={`
                            w-full sm:flex-1 py-3 rounded-lg font-semibold text-base flex justify-center items-center gap-2 border border-orange-500/30 transition-all duration-200 touch-manipulation
                            ${isProcessing
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : isValid
                                ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 active:scale-95'
                                : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                          `}
                          style={{ minHeight: '44px' }}
                        >
                          <FaBitcoin className="text-lg" />
                          <span>Crypto</span>
                        </button>
                      </div>
                    ) : (
                      // Colombian users: Single optimized button
                      <button
                        onClick={() => {
                          trackInitiateCheckout('bold');
                          handleBoldPayment();
                        }}
                        disabled={!isValid || isProcessing}
                        className={`
                          w-full py-4 rounded-lg font-bold text-lg flex justify-center items-center gap-2 transition-all duration-200 touch-manipulation
                          ${isProcessing
                            ? 'bg-yellow-600 text-white cursor-wait'
                            : isValid
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 active:scale-95 shadow-lg hover:shadow-xl'
                              : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                        `}
                        style={{ minHeight: '56px' }} // Extra large for main CTA
                      >
                        {isProcessing ? (
                          <>
                            <FaSpinner className="animate-spin text-lg" /> 
                            <span>Procesando...</span>
                          </>
                        ) : (
                          <>
                            <FaDollarSign className="text-lg" /> 
                            <span>Apostar <CurrencyDisplay copAmount={amount} /></span>
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-4 py-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <span>SSL Seguro</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Datos Protegidos</span>
                      </div>
                    </div>
                    
                    {/* Secondary Action - Smaller */}
                    <button
                      onClick={showAuthPrompt}
                      className="w-full py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors touch-manipulation"
                      style={{ minHeight: '40px' }}
                    >
                      ¿Ya tienes cuenta? Inicia sesión
                    </button>
                  </div>
                ) : isAuthenticated && paymentMethod === 'wallet' ? (
                  // Wallet payment button
                  <button
                    onClick={() => {
                      trackInitiateCheckout('wallet');
                      handleWalletBet();
                    }}
                    disabled={!isValid || isProcessing}
                    className={`
                      w-full py-3 rounded-lg font-bold text-lg flex justify-center gap-2
                      ${isProcessing
                        ? 'bg-yellow-600 text-white cursor-wait'
                        : isValid
                          ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                          : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                    `}
                  >
                    {isProcessing ? (
                      <>
                        <FaSpinner className="animate-spin" /> Procesando…
                      </>
                    ) : (
                      <>🎮 Jugar <CurrencyDisplay copAmount={amount} /></>
                    )}
                  </button>
                ) : (
                  // Cash/Crypto payment buttons (for authenticated + anonymous with guest form)
                  showCryptoOption ? (
                    // Two payment buttons (Cash + Crypto) for international users  
                    <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-3">
                      <button
                        onClick={() => {
                          trackInitiateCheckout('bold');
                          handleBoldPayment();
                        }}
                        disabled={!isValid || isProcessing}
                        className={`
                          w-full sm:flex-1 py-3 rounded-lg font-bold text-base sm:text-lg flex justify-center gap-2
                          ${isProcessing
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : isValid
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                              : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                        `}
                      >
                        <FaDollarSign />
                        <span className="hidden sm:inline">Cash</span>
                        <span className="sm:hidden">Tarjeta/PSE</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          trackInitiateCheckout('crypto');
                          handleCryptoPayment();
                        }}
                        disabled={!isValid || isProcessing}
                        className={`
                          w-full sm:flex-1 py-3 rounded-lg font-bold text-base sm:text-lg flex justify-center gap-2
                          ${isProcessing
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : isValid
                              ? 'bg-gradient-to-r from-orange-500 to-yellow-600 text-white hover:from-orange-600 hover:to-yellow-700'
                              : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                        `}
                      >
                        <FaBitcoin />
                        Crypto
                      </button>
                    </div>
                  ) : (
                    // Single Cash button for Colombian users or when guest form is shown
                    <button
                      onClick={() => {
                        trackInitiateCheckout('bold');
                        handleBoldPayment();
                      }}
                      disabled={!isValid || isProcessing}
                      className={`
                        w-full py-3 rounded-lg font-bold text-lg flex justify-center gap-2
                        ${isProcessing
                          ? 'bg-yellow-600 text-white cursor-wait'
                          : isValid
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                      `}
                    >
                      {isProcessing ? (
                        <>
                          <FaSpinner className="animate-spin" /> Procesando…
                        </>
                      ) : (
                        <>
                          <FaDollarSign /> Confirmar y Pagar <CurrencyDisplay copAmount={amount} />
                        </>
                      )}
                    </button>
                  )
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ✨ Payment Support Modal */}
      <PaymentSupportModal
        isOpen={showPaymentSupport}
        onClose={() => {
          setShowPaymentSupport(false);
          setPaymentError('');
        }}
        errorMessage={paymentError}
      />
    </AnimatePresence>
  );
}