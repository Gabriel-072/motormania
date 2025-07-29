// 📁 components/FullModal.tsx - OPTIMIZED INLINE AUTH
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
  FaGlobeAmericas
} from 'react-icons/fa';
import { useUser, useAuth, SignIn, SignUp } from '@clerk/nextjs';
import { useStickyStore } from '@/stores/stickyStore';
import { openBoldCheckout } from '@/lib/bold';
import { toast } from 'sonner';
import { createAuthClient } from '@/lib/supabase';
import { PickSelection } from '@/app/types/picks';
import { trackFBEvent } from '@/lib/trackFBEvent';

// ✨ Currency imports
import { useCurrencyStore, useCurrencyInfo } from '@/stores/currencyStore';
import { CurrencyDisplay } from './ui/CurrencyDisplay';
import { CurrencyInput } from './ui/CurrencyInput';
import { CurrencySelector } from './ui/CurrencySelector';
import { QuickAmountButtons } from './ui/QuickAmountButtons';
import { CurrencyStatusIndicator } from './ui/CurrencyStatusIndicator';

// ✨ PayPal imports
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

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

  // ✨ Currency store
  const { initializeCurrency, isInitialized, currency } = useCurrencyStore();
  const { detectionInfo } = useCurrencyInfo();

  // ✨ Colombia detection
  const isInColombia = useMemo(() => {
    if (currency === 'COP') return true;
    if (detectionInfo) {
      const colombiaChecks = [
        detectionInfo.country === 'Colombia',
        detectionInfo.country === 'CO', 
        detectionInfo.timezone?.includes('Bogota'),
        detectionInfo.timezone?.includes('America/Bogota'),
        detectionInfo.currency === 'COP',
        detectionInfo.locale?.includes('CO'),
        detectionInfo.locale?.includes('es-CO')
      ];
      if (colombiaChecks.some(check => check)) return true;
    }
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone.includes('Bogota') || timezone.includes('America/Bogota')) return true;
    } catch (e) {
      console.warn('Could not detect timezone:', e);
    }
    return false;
  }, [currency, detectionInfo]);

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

  // ✨ OPTIMIZED: Inline auth state with better management
  const [showInlineAuth, setShowInlineAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [authLoading, setAuthLoading] = useState(false);

  // ✨ Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'bold' | 'paypal' | 'wallet'>(() => {
    return isInColombia ? 'bold' : 'paypal';
  });

  // Notificaciones FOMO
  const fomoMsg = useFomoFake(2500);

  // combined picks
  const combinedPicks: PickSelection[] = [
    ...(picks.qualy ?? []),
    ...(picks.race ?? [])
  ];
  const totalPicks = combinedPicks.length;

  // ✨ InitiateCheckout tracking helper
  const trackInitiateCheckout = useCallback((paymentMethodUsed: string) => {
    console.log(`🎯 Tracking InitiateCheckout - ${paymentMethodUsed} payment button clicked`);
    
    if (typeof window !== 'undefined' && window.fbq) {
      const eventData = {
        value: amount / 1000,
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
  }, [amount, totalPicks, mode, user]);

  // ✨ Initialize currency system
  useEffect(() => {
    if (isOpen && !isInitialized) {
      initializeCurrency();
    }
  }, [isOpen, initializeCurrency, isInitialized]);

  // ✨ Colombia payment method enforcement
  useEffect(() => {
    if (isInColombia && paymentMethod === 'paypal') {
      setPaymentMethod('bold');
      toast.info('Método de pago actualizado para usuarios en Colombia');
    }
  }, [isInColombia, paymentMethod]);

  // ✨ OPTIMIZED: Enhanced auth state management with Hotjar control
  useEffect(() => {
    if (isSignedIn && showInlineAuth) {
      setAuthLoading(false);
      setShowInlineAuth(false);
      toast.success('¡Perfecto! Ahora confirma tu apuesta', { duration: 3000 });
      
      // ✨ FIXED: Tell Hotjar this is a conversion, not exit intent
      if (typeof window !== 'undefined' && (window as any).hj) {
        try {
          (window as any).hj('trigger', 'user_converted');
          (window as any).hj('event', 'auth_completed');
        } catch (e) {
          console.warn('Hotjar tracking failed:', e);
        }
      }
      
      // Immediate action - no delay for better UX
      if (paymentMethod === 'wallet') {
        handleWalletBet();
      }
    }
  }, [isSignedIn, showInlineAuth, paymentMethod]);

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

  // Validation
  useEffect(() => {
    let msg: string | null = null;
    const betMmc = Math.round(amount / 1000);
    if (totalPicks < 2) msg = 'Elige al menos 2 picks';
    else if (totalPicks > 8) msg = 'Máximo 8 picks por jugada';
    else if (combinedPicks.some(p => !p.betterOrWorse))
      msg = 'Completa todos tus picks (Mejor/Peor)';
    else if (amount < 20000) msg = 'Monto mínimo $20.000 COP o $5 USD';
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
  }, [combinedPicks, totalPicks, amount, mode, paymentMethod, wallet]);

  // ✨ Payment method handler with Colombia blocking
  const handlePaymentMethodChange = useCallback((method: 'bold' | 'paypal' | 'wallet') => {
    if (method === 'paypal' && isInColombia) {
      toast.error('PayPal no está disponible en Colombia. Usa tarjeta de crédito.', { duration: 4000 });
      return;
    }
    setPaymentMethod(method);
  }, [isInColombia]);

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

  // Wallet bet handler
  const handleWalletBet = async () => {
    if (!user?.id || !wallet) return;
    setIsProcessing(true);

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Token inválido');
      const sb = createAuthClient(token);

      const { error } = await sb.rpc('register_picks_with_wallet', {
        p_user_id: user.id,
        p_picks: combinedPicks,
        p_mode: mode,
        p_amount: amount
      });
      if (error) throw new Error(error.message);

      await fetch('/api/picks/email-with-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.primaryEmailAddress?.emailAddress,
          name: user.fullName,
          amount,
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
      const res = await fetch('/api/transactions/register-pick-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: combinedPicks,
          mode,
          amount,
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
              value: amount / 1000,
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
                p_bet_mmc: Math.round(amount / 1000)
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

  // PayPal payment handler
  const handlePayPalPayment = async () => {
    if (!user?.id || isProcessing || !isValid) {
      throw new Error('Invalid state for payment');
    }
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      throw new Error('Email required for PayPal');
    }

    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: combinedPicks,
          mode,
          amount,
          gpName: combinedPicks[0]?.gp_name ?? 'GP',
          fullName: user.fullName,
          email
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`PayPal API failed: ${res.status}`);
      }

      const data = await res.json();
      if (!data.orderID) {
        throw new Error('No orderID returned from PayPal API');
      }

      return data.orderID;
    } catch (err: any) {
      throw new Error('Failed to create PayPal order');
    }
  };

  // ✨ OPTIMIZED: Main confirm handler
  const handleConfirm = () => {
    if (!isSignedIn) {
      setShowInlineAuth(true);
      return;
    }
    
    // Track InitiateCheckout when payment button is clicked
    trackInitiateCheckout(paymentMethod);
    
    if (paymentMethod === 'wallet') return handleWalletBet();
    if (paymentMethod === 'paypal') return; // PayPal handled by PayPalButtons component
    handleBoldPayment(); // Default to Bold
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="w-full max-w-2xl p-4">
            <motion.div
              className="bg-gradient-to-b from-gray-900 to-[#0a1922] rounded-xl p-6 border border-gray-700/50 shadow-xl flex flex-col max-h-[90vh]"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            >
              {/* ✨ OPTIMIZED: Enhanced Inline Auth Modal */}
              <AnimatePresence>
                {showInlineAuth && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 rounded-xl"
                    onClick={(e) => {
                      // Prevent closing during auth loading
                      if (!authLoading && e.target === e.currentTarget) {
                        setShowInlineAuth(false);
                      }
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
                    >
                      {/* Close button */}
                      <button
                        onClick={() => {
                          setShowInlineAuth(false);
                          setAuthLoading(false);
                        }}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 z-20"
                      >
                        <FaTimes size={20} />
                      </button>
                      
                      {/* Header */}
                      <div className="p-4 text-center border-b border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-1">🏎️ Secure Your Bet!</h3>
                        <p className="text-green-400 font-semibold">
                          {totalPicks} picks • <CurrencyDisplay copAmount={amount} />
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {authMode === 'signin' ? 'Welcome back!' : 'Join thousands of F1 fans'} 
                        </p>
                      </div>
                      
                      {/* Auth content */}
                      <div className="relative overflow-y-auto max-h-96">
                        {authLoading && (
                          <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center z-10">
                            <div className="flex items-center gap-2 text-white">
                              <FaSpinner className="animate-spin" />
                              <span>Procesando...</span>
                            </div>
                          </div>
                        )}
                        
                        {authMode === 'signin' ? (
                          <SignIn
                            routing="virtual"
                            signUpUrl="#"
                            forceRedirectUrl={null}
                            fallbackRedirectUrl={null}
                            appearance={{
                              variables: {
                                colorPrimary: "#10b981",
                                colorBackground: "#1f2937",
                                colorText: "#f9fafb",
                                colorTextSecondary: "#9ca3af",
                                colorInputBackground: "#374151",
                                colorInputText: "#f9fafb",
                                borderRadius: "0.5rem"
                              },
                              elements: {
                                rootBox: "w-full",
                                card: "shadow-none border-0 bg-transparent px-4 pb-4",
                                headerTitle: "hidden",
                                headerSubtitle: "hidden",
                                socialButtonsBlockButton: "border border-gray-600 hover:border-gray-500 bg-gray-700 hover:bg-gray-600 text-white mb-3 py-3 text-base font-medium",
                                socialButtonsBlockButtonText: "text-white font-medium",
                                formButtonPrimary: "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 font-semibold py-3 text-base",
                                formFieldInput: "bg-gray-700 border-gray-600 text-white placeholder-gray-400 py-3",
                                formFieldLabel: "text-gray-300 text-sm font-medium",
                                identityPreviewText: "text-gray-300",
                                formFieldInputShowPasswordButton: "text-gray-400 hover:text-gray-200",
                                footerActionText: "hidden",
                                footerActionLink: "hidden",
                                dividerLine: "bg-gray-600",
                                dividerText: "text-gray-400 text-sm font-medium"
                              },
                              layout: {
                                socialButtonsPlacement: "top",
                              }
                            }}
                          />
                        ) : (
                          <SignUp
                            routing="virtual"
                            signInUrl="#"
                            forceRedirectUrl={null}
                            fallbackRedirectUrl={null}
                            unsafeMetadata={{
                              betAmount: amount,
                              picksCount: totalPicks,
                              paymentMethod: paymentMethod
                            }}
                            appearance={{
                              variables: {
                                colorPrimary: "#10b981",
                                colorBackground: "#1f2937",
                                colorText: "#f9fafb",
                                colorTextSecondary: "#9ca3af",
                                colorInputBackground: "#374151",
                                colorInputText: "#f9fafb",
                                borderRadius: "0.5rem"
                              },
                              elements: {
                                rootBox: "w-full",
                                card: "shadow-none border-0 bg-transparent px-4 pb-4",
                                headerTitle: "hidden",
                                headerSubtitle: "hidden",
                                socialButtonsBlockButton: "border border-gray-600 hover:border-gray-500 bg-gray-700 hover:bg-gray-600 text-white mb-3 py-3 text-base font-medium",
                                socialButtonsBlockButtonText: "text-white font-medium",
                                formButtonPrimary: "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 font-semibold py-3 text-base",
                                formFieldInput: "bg-gray-700 border-gray-600 text-white placeholder-gray-400 py-3",
                                formFieldLabel: "text-gray-300 text-sm font-medium",
                                identityPreviewText: "text-gray-300",
                                formFieldInputShowPasswordButton: "text-gray-400 hover:text-gray-200",
                                footerActionText: "hidden",
                                footerActionLink: "hidden",
                                dividerLine: "bg-gray-600",
                                dividerText: "text-gray-400 text-sm font-medium"
                              },
                              layout: {
                                socialButtonsPlacement: "top",
                              }
                            }}
                          />
                        )}
                      </div>
                      
                      {/* Toggle link */}
                      <div className="px-4 pb-4 text-center border-t border-gray-700 pt-3">
                        <button
                          onClick={() => {
                            setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                            setAuthLoading(false); // Reset loading state on toggle
                          }}
                          className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                          disabled={authLoading}
                          tabIndex={authLoading ? -1 : 0}
                        >
                          {authMode === 'signin' ? '¿No tienes cuenta? Regístrate en 30 segundos' : '¿Ya tienes cuenta? Inicia sesión rápido'}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                        ${promo.min_deposit.toLocaleString('es-CO')} COP
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
                {/* Wallet balance */}
                {wallet && isSignedIn && (
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
                        onChange={() => handlePaymentMethodChange(paymentMethod === 'wallet' ? (isInColombia ? 'bold' : 'paypal') : 'wallet')}
                        className="accent-amber-500"
                      />
                      <span>Usar saldo</span>
                    </label>
                  </div>
                )}

                {/* Payment Method Selection - Only for International Users */}
                {!isInColombia && isSignedIn && paymentMethod !== 'wallet' && currency !== 'COP' && (
                  <div className="bg-gray-800/70 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <FaGlobeAmericas className="text-blue-400" />
                      Método de Pago Internacional
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handlePaymentMethodChange('paypal')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                          paymentMethod === 'paypal'
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                            : 'border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        💳 PayPal
                      </button>
                      <button
                        onClick={() => handlePaymentMethodChange('bold')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                          paymentMethod === 'bold'
                            ? 'border-green-500 bg-green-500/20 text-green-300'
                            : 'border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        🏦 Tarjeta de Crédito
                      </button>
                    </div>
                  </div>
                )}

                {/* Information banner for Colombian users */}
                {(isInColombia || currency === 'COP') && isSignedIn && paymentMethod !== 'wallet' && (
                  <div className="bg-gradient-to-r from-green-800/30 to-blue-800/30 rounded-lg p-4 border border-green-700/50">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🇨🇴</div>
                      <div>
                        <h4 className="text-sm font-semibold text-green-400 mb-1">Pago en Colombia</h4>
                        <p className="text-xs text-gray-300">
                          Procesamos tu pago de forma segura con tarjetas colombianas a través de Bold
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
                  {!isInColombia && currency !== 'COP' && (
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <CurrencyStatusIndicator />
                    </div>
                  )}
                </div>

                {/* Quick add buttons */}
                <QuickAmountButtons
                  onAmountAdd={(copAmount) => setAmount(a => a + copAmount)}
                  onClear={() => setAmount(20000)}
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

                {/* PayPal button section or Regular Confirm Button */}
                {isSignedIn && paymentMethod === 'paypal' && !isInColombia && currency !== 'COP' ? (
                  <div className="space-y-2">
                    <PayPalScriptProvider options={{ 
                      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
                      currency: "USD",
                      intent: "capture"
                    }}>
                      <PayPalButtons
                        disabled={!isValid || isProcessing}
                        createOrder={() => {
                          trackInitiateCheckout('paypal');
                          return handlePayPalPayment();
                        }}
                        onApprove={async (data, actions) => {
                          setIsProcessing(true);
                          try {
                            toast.success('Pago de PayPal procesando...');
                            setQualyPicks([]); 
                            setRacePicks([]);
                            onClose();
                          } catch (err) {
                            toast.error('Error procesando pago PayPal');
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        onError={(err) => {
                          console.error('PayPal error:', err);
                          toast.error('Error con PayPal');
                          setIsProcessing(false);
                        }}
                        style={{
                          layout: 'vertical',
                          color: 'white',
                          shape: 'rect',
                          label: 'pay',
                          height: 45,
                          tagline: false,
                          disableMaxWidth: true
                        }}
                        fundingSource={undefined}
                        onCancel={() => {
                          console.log('PayPal payment cancelled');
                          setIsProcessing(false);
                        }}
                        onShippingChange={() => {
                          return Promise.resolve();
                        }}
                        forceReRender={[amount, totalPicks]}
                      />
                    </PayPalScriptProvider>
                  </div>
                ) : (
                  <button
                    onClick={handleConfirm}
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
                    ) : !isSignedIn ? (
                      <>🔐 Iniciar Sesión y Pagar <CurrencyDisplay copAmount={amount} /></>
                    ) : paymentMethod === 'wallet' ? (
                      <>🎮 Jugar <CurrencyDisplay copAmount={amount} /></> 
                    ) : (
                      <>
                        <FaDollarSign /> Confirmar y Pagar <CurrencyDisplay copAmount={amount} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}