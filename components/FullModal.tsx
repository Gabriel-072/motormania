// components/FullModal.tsx - Complete UI with New Promotional System
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
  FaLock,
  FaUsers,
  FaCreditCard,
  FaPlay
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
import { PaymentSupportModal } from './PaymentSupportModal';

interface FullModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGp?: string; // 🔥 NEW: Added currentGp prop
}

type RegisterPickApiResponse = {
  orderId: string;
  amount: string;
  callbackUrl: string;
  integrityKey: string;
  isAnonymous?: boolean;
  sessionId?: string;
  promotion?: {
    applied: boolean;
    campaignName: string;
    bonusAmount: number;
    totalEffectiveAmount: number;
    originalAmount: number;
  };
};

// 🔥 UPDATED: New promotional offer interface
interface PromotionalOffer {
  campaignId: string;
  campaignName: string;
  bonusPercentage: number;
  calculatedBonusAmount: number;
  totalEffectiveAmount: number;
  userRemainingUses: number;
}

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

export default function FullModal({ isOpen, onClose, currentGp = 'GP' }: FullModalProps) {
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

  // 🔥 CONVERSION OPTIMIZATION: Show guest form immediately for anonymous users
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  // wallet
  const [wallet, setWallet] = useState<Wallet | null>(null);

  // 🔥 NEW: Promotional system state
  const [promotionalOffer, setPromotionalOffer] = useState<PromotionalOffer | null>(null);
  const [promotionEnabled, setPromotionEnabled] = useState(true);
  const [loadingPromotion, setLoadingPromotion] = useState(false);

  // ✨ Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'bold' | 'wallet' | 'crypto'>('bold');

  // ✨ Payment Support Modal states
  const [showPaymentSupport, setShowPaymentSupport] = useState(false);
  const [paymentError, setPaymentError] = useState<string>('');

  // 🔥 NEW: Bonus calculation using promotional system
  const bonusCalculation = useMemo(() => {
    const baseAmount = amount;
    const hasValidPromo = promotionalOffer && promotionEnabled && promotionalOffer.userRemainingUses > 0;
    
    if (hasValidPromo) {
      return {
        baseAmount,
        bonusAmount: promotionalOffer.calculatedBonusAmount,
        totalEffectiveAmount: promotionalOffer.totalEffectiveAmount,
        bonusPercentage: promotionalOffer.bonusPercentage,
        campaignName: promotionalOffer.campaignName
      };
    }
    
    return {
      baseAmount,
      bonusAmount: 0,
      totalEffectiveAmount: baseAmount,
      bonusPercentage: 0,
      campaignName: ''
    };
  }, [amount, promotionalOffer, promotionEnabled]);

  // Use bonusCalculation for display
  const bonusAmount = bonusCalculation.bonusAmount;
  const effectiveWager = bonusCalculation.totalEffectiveAmount;

  // 🔥 SOCIAL PROOF: Live player count
  const [livePlayerCount] = useState(() => Math.floor(Math.random() * 50) + 120);

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

  // 🔥 NEW: Fetch promotional offer
  const fetchPromotionalOffer = useCallback(async () => {
    if (!isAuthenticated || !user?.id || amount < 10000) {
      setPromotionalOffer(null);
      return;
    }

    setLoadingPromotion(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;

      const supabase = createAuthClient(token);
      const { data, error } = await supabase.rpc('get_active_picks_promotion', {
        p_user_id: user.id,
        p_bet_amount: amount
      });

      if (!error && data && data.length > 0) {
        const promo = data[0];
        setPromotionalOffer({
          campaignId: promo.campaign_id,
          campaignName: promo.campaign_name,
          bonusPercentage: promo.bonus_percentage,
          calculatedBonusAmount: promo.calculated_bonus_amount,
          totalEffectiveAmount: promo.total_effective_amount,
          userRemainingUses: promo.user_remaining_uses
        });
        console.log('🎁 Promotional offer found:', promo.campaign_name);
      } else {
        setPromotionalOffer(null);
      }
    } catch (error) {
      console.error('Error fetching promotional offer:', error);
      setPromotionalOffer(null);
    } finally {
      setLoadingPromotion(false);
    }
  }, [isAuthenticated, user?.id, amount, getToken]);

  // Fetch promotional offer when modal opens or amount changes
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(fetchPromotionalOffer, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, amount, fetchPromotionalOffer]);

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

  // 🆕 Generate anonymous session ID
  const generateAnonymousSession = useCallback(() => {
    const sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('anonymousSession', sessionId);
    return sessionId;
  }, []);

  // 🔥 CONVERSION: Simplified validation for anonymous users
  useEffect(() => {
    let msg: string | null = null;
    const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
    const betMmc = Math.round(copAmount / 1000);
    const minCOPAmount = isInitialized ? convertToCOP(minimumBet.display) : 5000;
    
    if (totalPicks < 2) msg = 'Elige al menos 2 picks';
    else if (totalPicks > 8) msg = 'Máximo 8 picks por jugada';
    else if (combinedPicks.some(p => !p.betterOrWorse))
      msg = 'Completa todos tus picks (Mejor/Peor)';
    else if (copAmount < minCOPAmount) 
      msg = `Monto mínimo ${minimumBet.formatted}`;
    else if (mode === 'safety' && totalPicks < 3)
      msg = 'Safety requiere mínimo 3 picks';
    else if (!isAuthenticated && (!email || !fullName))
      msg = 'Completa tu información de contacto';
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

  // 🔥 UPDATED: Bold payment handler with new promotional system
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
          gpName: currentGp, // 🔥 FIXED: Use currentGp prop
          fullName: isAuthenticated ? user?.fullName : fullName,
          email: isAuthenticated ? user?.primaryEmailAddress?.emailAddress : email,
          anonymousSessionId: sessionId,
          // 🔥 NEW: Use promotional system
          applyPromotion: promotionEnabled && bonusCalculation.bonusAmount > 0
        })
      });
      
      if (!res.ok) {
        const { error: e } = await res.json().catch(() => ({}));
        throw new Error(e ?? 'Error registrando jugada.');
      }
      
      const { orderId, amount: amtStr, callbackUrl, integrityKey, isAnonymous, promotion } =
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
        description: `MMC GO (${totalPicks} picks) - ${mode === 'full' ? 'Full' : 'Safety'}${
          promotion?.applied ? ` + ${promotion.campaignName}` : ''
        }`,
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
              content_name: `MMC GO ${mode === 'full' ? 'Full Throttle' : 'Safety Car'} (${totalPicks} picks)${
                promotion?.applied ? ` + ${bonusCalculation.campaignName}` : ''
              }`,
              num_items: totalPicks,
              eventID: eventId,
              // 🔥 NEW: Promotional tracking
              custom_data: {
                promotion_applied: promotion?.applied || false,
                promotion_name: bonusCalculation.campaignName || '',
                bonus_amount: promotion?.bonusAmount || 0,
                total_effective_amount: promotion?.totalEffectiveAmount || amount
              }
            });
          }

          const successMessage = promotion?.applied 
            ? `🎉 ¡Pago exitoso + ${bonusCalculation.campaignName}!`
            : '¡Pago recibido, procesando…!';
          
          toast.success(successMessage);
          
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

  // ✨ UPDATED: Crypto payment handler with promotional system
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
          // 🔥 UPDATED: Use promotional system data
          bonusAmount: Math.round(currency === 'COP' ? bonusCalculation.bonusAmount : convertToCOP(bonusCalculation.bonusAmount)),
          effectiveWager: Math.round(currency === 'COP' ? bonusCalculation.totalEffectiveAmount : convertToCOP(bonusCalculation.totalEffectiveAmount)),
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
        p_amount: Math.round(copAmount),
        // 🔥 UPDATED: Use promotional system data
        p_bonus_amount: Math.round(currency === 'COP' ? bonusCalculation.bonusAmount : convertToCOP(bonusCalculation.bonusAmount)),
        p_effective_wager: Math.round(currency === 'COP' ? bonusCalculation.totalEffectiveAmount : convertToCOP(bonusCalculation.totalEffectiveAmount))
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
              className="bg-gray-900/80 backdrop-blur-lg rounded-xl p-4 sm:p-6 border border-gray-700/50 shadow-xl flex flex-col max-h-[95vh]"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            >
              {/* Header with currency selector */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700/50">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-amber-400">Confirmar Apuesta</h2>
                  {/* 🔥 SOCIAL PROOF */}
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <FaUsers className="text-green-400" />
                    <span>{livePlayerCount} jugadores activos</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <CurrencySelector />
                  <button onClick={handleClose} aria-label="Cerrar"
                    className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/60">
                    <FaTimes size={20} />
                  </button>
                </div>
              </div>

              {/* 🔥 CONVERSION: Guest form shown immediately for anonymous users */}
              {!isAuthenticated && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 space-y-3 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30"
                >
                  <div className="text-center">
                    <h4 className="text-sm font-bold text-green-400 mb-1">
                      🚀 Apuesta Rápida - Sin Registro Previo
                    </h4>
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <FaLock className="text-green-400" />
                        <span>Pago Seguro</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FaPlay className="text-green-400" />
                        <span>Acceso Inmediato</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-sm"
                      placeholder="Tu nombre completo"
                      style={{ fontSize: '16px' }} // Prevent zoom on iOS
                      autoFocus
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-sm"
                      placeholder="tu@email.com"
                      style={{ fontSize: '16px' }} // Prevent zoom on iOS
                    />
                  </div>
                </motion.div>
              )}

              {/* 🔥 NEW: Promotional System Display */}
              {loadingPromotion ? (
                <div className="mb-3 p-3 bg-gray-800/50 border border-gray-600 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full"></div>
                    <span className="text-gray-300 text-sm">Verificando promociones...</span>
                  </div>
                </div>
              ) : promotionalOffer ? (
                <div className="mb-3 p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
                  {bonusAmount > 0 && promotionEnabled ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎉</span>
                          <p className="font-bold text-green-400">
                            {promotionalOffer.campaignName}
                          </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={promotionEnabled}
                            onChange={(e) => setPromotionEnabled(e.target.checked)}
                            className="w-4 h-4 text-green-500 rounded focus:ring-green-400"
                          />
                          <span className="text-sm text-gray-300">Aplicar</span>
                        </label>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Tu apuesta:</span>
                          <span className="text-white font-semibold">
                            <CurrencyDisplay copAmount={amount} />
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-300">Bono ({promotionalOffer.bonusPercentage}%):</span>
                          <span className="text-green-400 font-bold">
                            +<CurrencyDisplay copAmount={bonusAmount} />
                          </span>
                        </div>
                        <div className="border-t border-green-500/20 pt-1">
                          <div className="flex justify-between">
                            <span className="text-green-400 font-bold">Total efectivo:</span>
                            <span className="text-green-400 font-bold text-lg">
                              <CurrencyDisplay copAmount={effectiveWager} />
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-green-400 mt-1">
                          ⚡ Tu ganancia potencial se calcula sobre <CurrencyDisplay copAmount={effectiveWager} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-amber-400">
                        💰 Habilita el bono para duplicar tu poder de apuesta
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* 🔥 KEEP PICKS SUMMARY VISIBLE - Compact for mobile */}
              <div className="flex-grow overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50 max-h-40 sm:max-h-60">
                {combinedPicks.length ? combinedPicks.map((pick, idx) => (
                  <motion.div
                    key={`${pick.driver}-${idx}`}
                    layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: .15 } }}
                    className="flex items-center gap-2 sm:gap-3 bg-gray-800/70 rounded-lg p-2 sm:p-3 border border-gray-700/60"
                  >
                    <Image
                      src={`/images/pilots/${pick.driver.toLowerCase().replace(/ /g, '-')}.png`}
                      alt={pick.driver}
                      width={32} height={32} unoptimized
                      className="rounded-full w-8 h-8 sm:w-10 sm:h-10 object-cover border-2 border-gray-600 flex-shrink-0"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).src = '/images/pilots/default-pilot.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate text-sm">{pick.driver}</p>
                      <p className="text-cyan-400 text-xs">
                        {pick.session_type === 'qualy' ? 'Q' : 'R'}: {pick.line.toFixed(1)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-1">
                        <button onClick={() => updatePick(idx, true)}
                          className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1
                            ${pick.betterOrWorse === 'mejor'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-600 hover:bg-green-700 text-gray-200'}`}>
                          <FaCheck size={8} /> Mejor
                        </button>
                        <button onClick={() => updatePick(idx, false)}
                          className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1
                            ${pick.betterOrWorse === 'peor'
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-600 hover:bg-red-700 text-gray-200'}`}>
                          <FaTimes size={8} /> Peor
                        </button>
                      </div>
                      <button onClick={() => removePick(idx)}
                        className="text-gray-500 hover:text-red-500 text-[10px] flex items-center gap-1">
                        <FaTrashAlt className="w-2 h-2" /> Quitar
                      </button>
                    </div>
                  </motion.div>
                )) : (
                  <p className="text-center text-gray-400 py-6">No has seleccionado picks.</p>
                )}
              </div>

              {/* controls */}
              <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-3">
                {/* ✨ Wallet toggle if available */}
                {isSignedIn && wallet && (
                  <div className="flex items-center justify-between bg-gray-800/70 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <FaWallet className="text-amber-400" />
                      <span>{wallet.mmc_coins - wallet.locked_mmc} MMC</span>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
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
                    className="w-full py-3 rounded-lg bg-gray-700/60 border border-gray-600 text-white font-semibold text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Monto a apostar"
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

                {/* 🔥 ENHANCED VALUE DISPLAY - Full vs Safety (with bonus) */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-3 rounded-lg border border-amber-500/20">
                  <div className="mb-2">
                    <p className="text-sm font-semibold text-amber-400">
                      {bonusAmount > 0 ? (
                        <>Apuesta Total: <CurrencyDisplay copAmount={effectiveWager} /></>
                      ) : (
                        <>Tu Apuesta: <CurrencyDisplay copAmount={amount} /></>
                      )}
                    </p>
                    {bonusAmount > 0 && (
                      <p className="text-xs text-green-400">
                        (Incluye bono de <CurrencyDisplay copAmount={bonusAmount} />)
                      </p>
                    )}
                  </div>
                  
                  {mode === 'full' ? (
                    // Full Throttle: Single payout (calculated with effective wager)
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-300">{totalPicks} Aciertos</span>
                      <div className="text-right">
                        <span className="text-cyan-400 font-bold text-lg">{payoutCombos[totalPicks] || 0}x</span>
                        <span className="text-gray-400 text-xs"> → </span>
                        <span className="text-green-400 font-bold">
                          <CurrencyDisplay copAmount={effectiveWager * (payoutCombos[totalPicks] || 0)} />
                        </span>
                      </div>
                    </div>
                  ) : (
                    // Safety Car: Multiple payouts (calculated with effective wager)
                    <div className="space-y-1">
                      {(safetyPayouts[totalPicks] || []).map((multiplier, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-xs text-gray-300">{totalPicks - i} Aciertos</span>
                          <div className="text-right">
                            <span className="text-cyan-400 font-bold">{multiplier}x</span>
                            <span className="text-gray-400 text-xs"> → </span>
                            <span className="text-green-400 font-semibold">
                              <CurrencyDisplay copAmount={multiplier * effectiveWager} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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
                      flex items-center justify-center h-8 rounded-lg
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

                {/* 🔥 OPTIMIZED PAYMENT BUTTONS */}
                {isAuthenticated && paymentMethod === 'wallet' ? (
                  // Wallet payment button
                  <button
                    onClick={() => {
                      trackInitiateCheckout('wallet');
                      handleWalletBet();
                    }}
                    disabled={!isValid || isProcessing}
                    className={`
                      w-full py-4 rounded-lg font-bold text-lg flex justify-center gap-2 shadow-lg
                      ${isProcessing
                        ? 'bg-yellow-600 text-white cursor-wait'
                        : isValid
                          ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:shadow-xl transform hover:scale-[1.02]'
                          : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                      transition-all duration-200
                    `}
                  >
                    {isProcessing ? (
                      <>
                        <FaSpinner className="animate-spin" /> Procesando…
                      </>
                    ) : (
                      <>🎮 Jugar con Saldo • <CurrencyDisplay copAmount={amount} /></>
                    )}
                  </button>
                ) : (
                  // Payment buttons for all users
                  <div className="space-y-3">
                    {showCryptoOption ? (
                      // International users: Express options
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            trackInitiateCheckout('bold');
                            handleBoldPayment();
                          }}
                          disabled={!isValid || isProcessing}
                          className={`
                            w-full py-4 rounded-lg font-bold text-lg flex justify-center gap-2 shadow-lg
                            ${isValid
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:shadow-xl transform hover:scale-[1.02]'
                              : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                            transition-all duration-200
                          `}
                        >
                          <FaCreditCard /> Apostar con Tarjeta
                          {bonusAmount > 0 && (
                            <span className="text-green-300 ml-2">+ {bonusCalculation.campaignName}</span>
                          )}
                        </button>
                        
                        <button
                          onClick={() => {
                            trackInitiateCheckout('crypto');
                            handleCryptoPayment();
                          }}
                          disabled={!isValid || isProcessing}
                          className={`
                            w-full py-3 rounded-lg font-semibold text-sm flex justify-center gap-2 border border-orange-500/30
                            ${isValid
                              ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                              : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                          `}
                        >
                          <FaBitcoin /> Apostar con Crypto
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
                          w-full py-4 rounded-lg font-bold text-lg flex justify-center gap-2 shadow-lg
                          ${isProcessing
                            ? 'bg-yellow-600 text-white cursor-wait'
                            : isValid
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:shadow-xl transform hover:scale-[1.02]'
                              : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                          transition-all duration-200
                        `}
                      >
                        {isProcessing ? (
                          <>
                            <FaSpinner className="animate-spin" /> Procesando Pago...
                          </>
                        ) : (
                          <>
                            <FaPlay /> Apostar Ahora • <CurrencyDisplay copAmount={amount} />
                            {bonusAmount > 0 && (
                              <span className="text-green-300 ml-2">+ {bonusCalculation.campaignName}</span>
                            )}
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* Secondary Action for anonymous users */}
                    {!isAuthenticated && (
                      <button
                        onClick={showAuthPrompt}
                        className="w-full py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        ¿Ya tienes cuenta? Inicia sesión
                      </button>
                    )}
                  </div>
                )}

                {/* Trust signals */}
                {!isAuthenticated && (
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <FaLock />
                      <span>SSL Seguro</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FaUsers />
                      <span>+2,500 jugadores</span>
                    </div>
                  </div>
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