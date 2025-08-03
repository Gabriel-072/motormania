// components/FullModal.tsx - Fixed TypeScript Errors
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
  promotion?: {
    applied: boolean;
    campaignName: string;
    bonusAmount: number;
    totalEffectiveAmount: number;
    originalAmount: number;
  };
};

// 🔥 SIMPLIFIED: Wallet interface (cash only)
type Wallet = {
  balance_cop: number;
  withdrawable_cop: number;
};

// 🔥 SIMPLIFIED: Promotional offer interface  
interface SimplePromotionalOffer {
  campaignId: string;
  campaignName: string;
  bonusPercentage: number;
  calculatedBonusAmount: number;
  totalEffectiveAmount: number;
  userRemainingUses: number;
}

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
  const { initializeCurrency, isInitialized, convertToCOP, convertFromCOP } = useCurrencyStore();
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

  // 🔥 SIMPLIFIED: Wallet state (cash only)
  const [wallet, setWallet] = useState<Wallet | null>(null);

  // 🔥 SIMPLIFIED: Promotional state
  const [promotionalOffer, setPromotionalOffer] = useState<SimplePromotionalOffer | null>(null);
  const [promotionEnabled, setPromotionEnabled] = useState(true);
  const [loadingPromotion, setLoadingPromotion] = useState(false);

  // ✨ Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'bold' | 'wallet' | 'crypto'>('bold');

  // ✨ Payment Support Modal states
  const [showPaymentSupport, setShowPaymentSupport] = useState(false);
  const [paymentError, setPaymentError] = useState<string>('');

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

  // 🔥 FIXED: Clear picks function
  const clearDraftPicks = useCallback(() => {
    setQualyPicks([]);
    setRacePicks([]);
  }, [setQualyPicks, setRacePicks]);

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

  // 🔥 SIMPLIFIED: Fetch wallet balance (cash only)
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    (async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) return;
        const sb = createAuthClient(token);
        const { data } = await sb
          .from('wallet')
          .select('balance_cop,withdrawable_cop')
          .eq('user_id', user.id)
          .single();
        if (data) setWallet(data as Wallet);
      } catch (e) {
        console.warn('No se pudo leer saldo wallet', e);
      }
    })();
  }, [isOpen, user, getToken]);

  // 🔥 SIMPLIFIED: Auto-switch away from wallet if insufficient funds
  useEffect(() => {
    if (paymentMethod === 'wallet' && wallet) {
      const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
      
      // Check if user has sufficient cash balance
      if (copAmount > wallet.balance_cop) {
        setPaymentMethod('bold');
      }
    }
  }, [paymentMethod, wallet, amount, currency, convertToCOP]);

  // 🔥 SIMPLIFIED: Fetch promotional offer
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

  // 🔥 SIMPLIFIED: Bonus calculation
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

  // 🔥 SIMPLIFIED: Potential win calculation
  const enhancedPotentialWin = useMemo(() => {
    const combo = payoutCombos[totalPicks] || 0;
    const safetyArray = safetyPayouts[totalPicks] || [0];
    
    if (mode === 'full') {
      return bonusCalculation.totalEffectiveAmount * combo;
    } else {
      return safetyArray.map(multiplier => 
        bonusCalculation.totalEffectiveAmount * multiplier
      );
    }
  }, [totalPicks, mode, bonusCalculation.totalEffectiveAmount]);

  // 🆕 Generate anonymous session ID
  const generateAnonymousSession = useCallback(() => {
    const sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('anonymousSession', sessionId);
    return sessionId;
  }, []);

  // 🔥 SIMPLIFIED: Register pick transaction
  const registerPickTransaction = async () => {
    try {
      const response = await fetch('/api/transactions/register-pick-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: combinedPicks,
          mode,
          amount: bonusCalculation.baseAmount,
          gpName: 'Current GP', // You might want to get this from somewhere
          fullName: isAuthenticated ? user?.fullName : fullName,
          email: isAuthenticated ? user?.primaryEmailAddress?.emailAddress : email,
          anonymousSessionId: !isAuthenticated ? generateAnonymousSession() : undefined,
          applyPromotion: promotionEnabled && bonusCalculation.bonusAmount > 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register transaction');
      }

      return await response.json() as RegisterPickApiResponse;
    } catch (error) {
      console.error('Error registering pick transaction:', error);
      throw error;
    }
  };

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

  // 🔥 SIMPLIFIED: Wallet payment handler (cash only)
  const handleWalletBet = async () => {
    if (isProcessing || !isValid || !wallet || !user?.id) return;

    const copAmount = currency === 'COP' ? bonusCalculation.baseAmount : convertToCOP(bonusCalculation.baseAmount);
    
    // Check sufficient balance
    if (copAmount > wallet.balance_cop) {
      toast.error('Saldo insuficiente en wallet');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Register the pick transaction first
      const pickData = await registerPickTransaction();
      const { orderId, promotion } = pickData;

      // Process wallet payment using simplified RPC
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No auth token');
      
      const sb = createAuthClient(token);
      const { data: paymentResult, error: paymentError } = await sb.rpc('process_bet_payment', {
        p_user_id: user.id,
        p_bet_amount: copAmount,
        p_order_id: orderId
      });

      if (paymentError || !paymentResult?.[0]?.success) {
        throw new Error(paymentResult?.[0]?.error_message || 'Error processing wallet payment');
      }

      // Track Purchase event
      if (typeof window !== 'undefined' && window.fbq) {
        const eventId = `purchase_${orderId}_${user.id}`;
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
          custom_data: {
            payment_method: 'wallet',
            promotion_applied: promotion?.applied || false,
            bonus_amount: promotion?.bonusAmount || 0
          }
        });
      }

      // Apply promotion if enabled (same as Bold webhook would do)
      if (promotion?.applied && user?.id) {
        try {
          await sb.rpc('apply_picks_promotion', {
            p_user_id: user.id,
            p_transaction_id: orderId,
            p_original_amount: copAmount
          });
        } catch (promoError) {
          console.warn('Promotion application failed:', promoError);
          // Continue - payment was successful
        }
      }

      const successMessage = promotion?.applied 
        ? `🎉 ¡Apuesta exitosa + ${bonusCalculation.campaignName}!`
        : '✅ ¡Apuesta exitosa con saldo de wallet!';
      
      toast.success(successMessage);
      clearDraftPicks();
      onClose();
      setIsProcessing(false);

    } catch (err: any) {
      setError(`Error con pago de wallet: ${err.message || 'Error desconocido'}`);
      setIsProcessing(false);
    }
  };

  // ✨ EXISTING: Bold payment handler
  const handleBoldPayment = async () => {
    if (isProcessing || !isValid) return;

    setIsProcessing(true);
    setError(null);

    try {
      const pickData = await registerPickTransaction();
      const { orderId, amount: amountStr, callbackUrl, integrityKey, promotion } = pickData;

      // Use original amount for payment
      const copAmount = currency === 'COP' ? bonusCalculation.baseAmount : convertToCOP(bonusCalculation.baseAmount);

      // Track InitiateCheckout
      trackInitiateCheckout('bold');

      const { openBoldCheckout } = await import('@/lib/bold');
      
      openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_API_KEY!,
        orderId,
        amount: amountStr,
        currency: 'COP',
        description: `MMC GO ${mode === 'full' ? 'Full Throttle' : 'Safety Car'} • ${totalPicks} picks${
          promotion?.applied ? ` + ${promotion.campaignName}` : ''
        }`,
        redirectionUrl: callbackUrl,
        integritySignature: integrityKey,
        customerData: JSON.stringify({
          email: isAuthenticated ? user?.primaryEmailAddress?.emailAddress : email,
          fullName: isAuthenticated ? user?.fullName : fullName
        }),
        renderMode: 'embedded',
        onSuccess: async () => {
          // Track Purchase
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
              custom_data: {
                promotion_applied: promotion?.applied || false,
                promotion_name: bonusCalculation.campaignName || '',
                bonus_amount: promotion?.bonusAmount || 0,
                total_effective_amount: promotion?.totalEffectiveAmount || bonusCalculation.baseAmount
              }
            });
          }

          const successMessage = promotion?.applied 
            ? `🎉 ¡Pago exitoso + ${bonusCalculation.campaignName}!`
            : '✅ ¡Pago exitoso!';
          
          toast.success(successMessage);
          clearDraftPicks();
          onClose();
          setIsProcessing(false);
        },
        onFailed: ({ message }: { message?: string }) => {
          setPaymentError(`Pago falló: ${message || 'Error desconocido'}`);
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

  // 🔥 CONVERSION: Simplified validation for anonymous users
  useEffect(() => {
    let msg: string | null = null;
    const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
    const minCOPAmount = isInitialized ? convertToCOP(minimumBet.display) : 20000;

    if (totalPicks < 2) {
      msg = 'Selecciona al menos 2 picks';
    } else if (totalPicks > 8) {
      msg = 'Máximo 8 picks permitidos';
    } else if (mode === 'safety' && totalPicks < 3) {
      msg = 'Safety Car requiere mínimo 3 picks';
    } else if (amount < minCOPAmount) {
      msg = `Monto mínimo: ${currency === 'COP' ? '$' : ''}${minimumBet.display.toLocaleString()}${currency === 'COP' ? ' COP' : ''}`;
    } else if (!isAuthenticated && (!email || !fullName)) {
      msg = 'Completa tu información para continuar';
    } else if (!isAuthenticated && email && !email.includes('@')) {
      msg = 'Email inválido';
    }

    setError(msg);
    setIsValid(!msg);
  }, [totalPicks, mode, amount, email, fullName, isAuthenticated, currency, convertToCOP, minimumBet, isInitialized]);

  // 🔥 SIMPLIFIED: Promotional Display Component
  const PromotionalDisplay = () => {
    if (loadingPromotion) {
      return (
        <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full"></div>
            <span className="text-gray-300 text-sm">Verificando promociones...</span>
          </div>
        </div>
      );
    }

    if (!promotionalOffer) return null;

    const isEnabled = promotionEnabled && promotionalOffer.userRemainingUses > 0;

    return (
      <div className={`border rounded-lg p-4 mb-4 transition-all duration-300 ${
        isEnabled 
          ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-500/30' 
          : 'bg-gray-800/20 border-gray-600/30'
      }`}>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`font-bold ${isEnabled ? 'text-green-400' : 'text-gray-400'}`}>
              🎁 {promotionalOffer.campaignName}
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={promotionEnabled}
                onChange={(e) => setPromotionEnabled(e.target.checked)}
                disabled={promotionalOffer.userRemainingUses === 0}
                className="w-4 h-4 text-green-500 rounded focus:ring-green-400 disabled:opacity-50"
              />
              <span className="text-sm text-gray-300">Aplicar</span>
            </label>
          </div>
          
          {promotionalOffer.userRemainingUses === 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">
              Límite alcanzado
            </span>
          )}
        </div>
        
        {isEnabled && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Apuesta base:</span>
              <CurrencyDisplay copAmount={bonusCalculation.baseAmount} />
            </div>
            <div className="flex justify-between">
              <span className="text-green-400">
                Bono ({promotionalOffer.bonusPercentage}%):
              </span>
              <CurrencyDisplay copAmount={bonusCalculation.bonusAmount} />
            </div>
            <div className="border-t border-green-500/30 pt-2 flex justify-between font-bold">
              <span className="text-green-300">Total efectivo:</span>
              <CurrencyDisplay copAmount={bonusCalculation.totalEffectiveAmount} />
            </div>
            
            <p className="text-xs text-green-400 mt-2">
              ⚡ Tu ganancia potencial se calcula sobre{' '}
              <CurrencyDisplay copAmount={bonusCalculation.totalEffectiveAmount} />
            </p>
          </div>
        )}
        
        {!isEnabled && promotionalOffer.userRemainingUses > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Habilita la casilla para aplicar el bono de {promotionalOffer.bonusPercentage}%
          </p>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-gray-900 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl"
          >
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Finalizar Apuesta</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Picks Summary */}
              <div className="space-y-3">
                {combinedPicks.map((pick, idx) => (
                  <div key={idx} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-white">{pick.driver}</span>
                      <span className={`text-sm px-2 py-1 rounded ${
                        pick.betterOrWorse === 'mejor' 
                          ? 'bg-green-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {pick.betterOrWorse === 'mejor' ? 'Mejor' : 'Peor'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Amount Input */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-200">
                  Monto a apostar
                </label>
                <CurrencyInput
                  copValue={currency === 'COP' ? amount : convertToCOP(amount)}
                  onCOPChange={(copAmount) => {
                    const newAmount = currency === 'COP' ? copAmount : convertFromCOP(copAmount);
                    setAmount(newAmount);
                  }}
                  className="w-full"
                />
              </div>

              {/* Promotional Display */}
              <PromotionalDisplay />

              {/* 🔥 SIMPLIFIED: Wallet toggle - cash only */}
              {isSignedIn && wallet && (
                <div className="flex items-center justify-between bg-gray-800/70 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-gray-200">
                    <FaWallet className="text-green-400" />
                    <span>Balance: ${wallet.balance_cop.toLocaleString('es-CO')}</span>
                  </div>
                  
                  {/* Only show toggle if user has sufficient balance */}
                  {(() => {
                    const copAmount = currency === 'COP' ? amount : convertToCOP(amount);
                    const hasEnoughBalance = copAmount <= wallet.balance_cop;
                    
                    return hasEnoughBalance ? (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paymentMethod === 'wallet'}
                          onChange={() => setPaymentMethod(paymentMethod === 'wallet' ? 'bold' : 'wallet')}
                          className="w-4 h-4 text-green-500 rounded focus:ring-green-400"
                        />
                        <span className="text-green-300">Usar saldo</span>
                      </label>
                    ) : (
                      <span className="text-xs text-red-400">Saldo insuficiente</span>
                    );
                  })()}
                </div>
              )}

              {/* Potential Win Display */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-bold text-amber-400 mb-2">
                  💰 Ganancia Potencial
                </h3>
                {mode === 'full' ? (
                  <div className="text-2xl font-bold text-green-400">
                    <CurrencyDisplay copAmount={enhancedPotentialWin as number} />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(enhancedPotentialWin as number[]).map((win, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-gray-300">
                          {idx === 0 ? 'Todos correctos:' : `${totalPicks - idx} correctos:`}
                        </span>
                        <span className="font-bold text-green-400">
                          <CurrencyDisplay copAmount={win} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {bonusCalculation.bonusAmount > 0 && (
                  <p className="text-xs text-green-400 mt-2">
                    ⚡ Incluye {bonusCalculation.campaignName}
                  </p>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <FaExclamationTriangle className="flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              {/* Guest Form */}
              {!isAuthenticated && (
                <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h3 className="text-sm font-medium text-gray-200">Información de contacto</h3>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* 🔥 SIMPLIFIED: Payment Button Logic */}
              {(() => {
                const copAmount = currency === 'COP' ? bonusCalculation.baseAmount : convertToCOP(bonusCalculation.baseAmount);
                const walletAvailable = isAuthenticated && wallet && 
                  (copAmount <= wallet.balance_cop) && 
                  paymentMethod === 'wallet';

                if (walletAvailable) {
                  // Wallet payment button
                  return (
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
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-xl transform hover:scale-[1.02]'
                            : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                        transition-all duration-200
                      `}
                    >
                      {isProcessing ? (
                        <>
                          <FaSpinner className="animate-spin" /> Procesando…
                        </>
                      ) : (
                        <>🎮 Apostar con Saldo • <CurrencyDisplay copAmount={bonusCalculation.baseAmount} /></>
                      )}
                    </button>
                  );
                } else {
                  // Regular payment button (Bold/Crypto)
                  return (
                    <button
                      onClick={handleBoldPayment}
                      disabled={!isValid || isProcessing}
                      className={`
                        w-full py-4 rounded-lg font-bold text-lg flex justify-center gap-2 shadow-lg
                        ${isProcessing
                          ? 'bg-yellow-600 text-white cursor-wait'
                          : isValid
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:shadow-xl transform hover:scale-[1.02]'
                            : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}
                        transition-all duration-200
                      `}
                    >
                      {isProcessing ? (
                        <>
                          <FaSpinner className="animate-spin" /> Procesando…
                        </>
                      ) : (
                        <>
                          🚀 Apostar <CurrencyDisplay copAmount={bonusCalculation.baseAmount} />
                          {bonusCalculation.bonusAmount > 0 && (
                            <span className="text-green-300">
                              + {bonusCalculation.campaignName}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                }
              })()}

            </div>
          </motion.div>
          
          {/* Payment Support Modal */}
          {showPaymentSupport && (
            <PaymentSupportModal
              isOpen={showPaymentSupport}
              onClose={() => setShowPaymentSupport(false)}
              errorMessage={paymentError}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}