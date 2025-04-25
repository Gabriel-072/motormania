// /Users/imgabrieltoro/Projects/motormania/components/FullModal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { FaTimes, FaTrashAlt, FaCheck, FaExclamationTriangle, FaDollarSign, FaSpinner } from 'react-icons/fa';
import { useStickyStore } from '@/stores/stickyStore';
import { openBoldCheckout } from '@/lib/bold'; // Adjust path if needed
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase'; // Adjust path if needed
import { trackFBEvent } from '@/lib/trackFBEvent'; // Adjust path if needed
import { PickSelection } from '../app/types/picks'; // Adjust path if needed
import { toast } from 'sonner'; // Ensure toast is imported
// Import Supabase types for better checking
import type { PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js';


interface FullModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FullModal: React.FC<FullModalProps> = ({ isOpen, onClose }) => {
  // --- Hooks & State ---
  const { picks, setQualyPicks, setRacePicks } = useStickyStore();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [amount, setAmount] = useState<number>(10000);
  const [mode, setMode] = useState<'full' | 'safety'>('full');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const combinedPicks: PickSelection[] = [...(picks.qualy || []), ...(picks.race || [])];
  const totalPicks = combinedPicks.length;

  const payoutCombos: Record<number, number> = { 2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100 };
  const safetyPayouts: Record<number, number[]> = { 3: [2, 1], 4: [5, 1.5], 5: [10, 1.5, 1], 6: [20, 1.5, 0.4], 7: [30, 2.5, 1], 8: [50, 5, 1.5] };

  const calculatePayout = () => {
     if (mode === 'full') {
      const multiplier = payoutCombos[totalPicks] || 0;
      return multiplier * amount;
    } else {
      const payouts = safetyPayouts[totalPicks] || [0];
      return payouts[0] * amount;
    }
  };
  const currentEstimatedPayout = calculatePayout();

  useEffect(() => {
    let msg: string | null = null;
    if (totalPicks < 2) msg = 'Elige al menos 2 picks';
    else if (totalPicks > 8) msg = 'Máximo 8 picks por jugada';
    else if (combinedPicks.some((p) => !p.betterOrWorse)) msg = 'Completa todos tus picks (Mejor/Peor)';
    else if (amount < 10000) msg = 'Monto mínimo $10.000 COP';

    setError(msg);
    setIsValid(!msg);
  }, [combinedPicks, totalPicks, amount]);

  const updatePick = useCallback((index: number, better: boolean) => {
    const qualyCount = picks.qualy.length;
    const valueToSet = better ? 'mejor' : 'peor';
    if (index < qualyCount) {
      const updated = picks.qualy.map((p, i) => (
        i === index ? { ...p, betterOrWorse: valueToSet as 'mejor' | 'peor' } : p
      ));
      setQualyPicks(updated);
    } else {
      const raceIndex = index - qualyCount;
      const updated = picks.race.map((p, i) => (
        i === raceIndex ? { ...p, betterOrWorse: valueToSet as 'mejor' | 'peor' } : p
      ));
      setRacePicks(updated);
    }
  }, [picks.qualy, picks.race, setQualyPicks, setRacePicks]);

  const removePickHandler = useCallback((index: number) => {
    const qualyCount = picks.qualy.length;
    if (index < qualyCount) {
      const updated = picks.qualy.filter((_, i) => i !== index);
      setQualyPicks(updated);
    } else {
      const raceIndex = index - qualyCount;
      const updated = picks.race.filter((_, i) => i !== index);
      setRacePicks(updated);
    }
     if (totalPicks -1 < 2) {
        onClose();
     }
  }, [picks.qualy, picks.race, setQualyPicks, setRacePicks, totalPicks, onClose]);

  const handleBoldPayment = async () => {
    if (!user || !isValid || isProcessing) return;
    setIsProcessing(true);
    setError(null);

    const orderId = `MMC-${user.id.substring(0, 5)}-${Date.now()}`;

    try {
      const response = await fetch('/api/bold/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, currency: 'COP' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar firma de integridad');
      }
      const { hash } = await response.json();

      openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
        orderId, amount, currency: 'COP',
        description: `MMC GO Picks (${totalPicks}) - ${mode === 'full' ? 'Full' : 'Safety'}`,
        redirectionUrl: `${window.location.origin}/dashboard?bold_status=success&order=${orderId}`,
        integritySignature: hash,
        customerData: {
          email: user?.primaryEmailAddress?.emailAddress || '',
          fullName: user?.fullName || 'Jugador MMC',
          phone: user?.primaryPhoneNumber?.phoneNumber || '',
        },
        onSuccess: async () => {
          console.log('✅ Bold pago exitoso, ejecutando lógica post-pago...');
          try {
            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("Supabase token not available post-payment");
            const supabase = createAuthClient(token);

            const finalMultiplier = payoutCombos[totalPicks] || 0;
            const finalPotentialWin = finalMultiplier * amount;
            const mmcCoins = Math.round(amount / 1000);
            const fuelCoins = amount;
            const finalMode = mode === 'full' ? 'Full Throttle' : 'Safety Car';

            // Define types for Supabase responses more explicitly if needed
            type SupabaseInsertResponse = PostgrestSingleResponse<any>; // Adjust 'any' if you have specific types
            type SupabaseRPCResponse = PostgrestResponse<any>; // Adjust 'any'

            const results = await Promise.allSettled([
              supabase.from('picks').insert({ user_id: user.id, gp_name: combinedPicks[0]?.gp_name || 'GP Desconocido', session_type: 'combined', picks: combinedPicks, multiplier: finalMultiplier, wager_amount: amount, potential_win: finalPotentialWin, name: user.fullName || 'Jugador MMC', mode: finalMode, order_id: orderId }).select().single(),
              supabase.from('coin_purchases').insert({ user_id: user.id, mmc_coins_purchased: mmcCoins, fuel_coins_received: fuelCoins, amount_paid: amount, payment_status: 'paid', order_id: orderId }),
              supabase.rpc('increment_wallet_balances', { uid: user.id, mmc_amount: mmcCoins, fuel_amount: fuelCoins, cop_amount: amount }),
              fetch('/api/send-coins-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: user?.primaryEmailAddress?.emailAddress, amount, mmc: mmcCoins, fc: fuelCoins }) }),
              fetch('/api/send-pick-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: user?.primaryEmailAddress?.emailAddress, name: user?.fullName || 'Jugador MMC', picks: combinedPicks, mode: finalMode, wager_amount: amount, potential_win: finalPotentialWin }) }),
            ]);

            // --- FIX: More robust error checking ---
            const operations = ['Picks Save', 'Coin Purchase', 'Wallet Update', 'Coins Email', 'Pick Email'];
            let criticalOperationFailed = false; // Flag for critical failures

            results.forEach((result, i) => {
              const operationName = operations[i];
              if (result.status === 'rejected') {
                console.error(`❌ Error en operación ${i+1} (${operationName}):`, result.reason);
                 if (i < 3) criticalOperationFailed = true; // Mark failure if DB operations fail
              } else {
                 // Check Supabase results (index 0, 1, 2)
                 if (i < 3) {
                    // Assert the type to access Supabase-specific properties
                    const supabaseResult = result.value as SupabaseInsertResponse | SupabaseRPCResponse;
                    if (supabaseResult && supabaseResult.error) {
                        console.error(`❌ Error en operación ${i+1} (${operationName} - Supabase):`, supabaseResult.error);
                        criticalOperationFailed = true;
                    }
                 }
                 // Check Fetch results (index 3, 4)
                 else if (i >= 3) {
                    // Assert the type to access Response properties
                    const fetchResult = result.value as Response;
                     if (fetchResult && !fetchResult.ok) {
                         console.error(`❌ Error en operación ${i+1} (${operationName} - Fetch): Status ${fetchResult.status}`);
                         // Optionally log body: await fetchResult.text()
                     }
                 }
              }
            });
            // --- End Fix ---

            if (criticalOperationFailed) {
                toast.error("Error guardando tu jugada o actualizando monedas. Contacta soporte.");
                // Keep modal open, don't reset picks yet
                return; // Stop further execution in onSuccess
            }

            // Tracking (only if critical operations succeeded)
            const eventId = `evt_${Date.now()}_${user.id.substring(0, 8)}`;
            const email = user?.primaryEmailAddress?.emailAddress || '';
            const trackParams = { page: 'mmc-go', cantidadPicks: totalPicks, monto: amount, modo: mode, gp: combinedPicks[0]?.gp_name || 'Desconocido' };
            trackFBEvent('PickConfirmado', { params: trackParams, email, event_id: eventId });
            fetch('/api/fb-track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: 'PickConfirmado', event_id: eventId, event_source_url: window.location.href, params: trackParams, email }) })
              .catch((err) => console.error('❌ Error sending CAPI event:', err));

            console.log('✅ Lógica post-pago completada.');
            toast.success("¡Picks confirmados y monedas añadidas!");
            // Reset picks using individual setters
            setQualyPicks([]);
            setRacePicks([]);
            onClose(); // Close modal on success

          } catch (err) {
            console.error('❌ Error general en onSuccess:', err);
            toast.error("Error procesando tu jugada post-pago.");
          }
        },
         onClose: () => {
             console.log('🟡 Bold Checkout cerrado por el usuario.');
             toast.info("Pago cancelado o cerrado.");
             setIsProcessing(false);
         },
         onError: (errorData: any) => {
             console.error('❌ Error en Bold Checkout:', errorData);
             toast.error(`Error en el pago: ${errorData?.message || 'Intenta de nuevo'}`);
             setIsProcessing(false);
         }
      });

    } catch (err: any) {
      console.error('❌ Error preparando pago con Bold:', err);
      setError(err.message || 'Error preparando el pago.');
      toast.error(err.message || 'Error preparando el pago.');
      setIsProcessing(false);
    }
  };

  // --- Tailwind Class Definitions ---
  const modalOverlayClasses = "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center";
  const modalPanelClasses = "w-full sm:max-w-2xl bg-gradient-to-b from-gray-900 to-[#0a1922] rounded-t-2xl sm:rounded-xl p-5 sm:p-6 border-t sm:border border-gray-700/50 shadow-2xl flex flex-col max-h-[90vh]";
  const modalHeaderClasses = "flex justify-between items-center mb-4 pb-3 border-b border-gray-700/50 flex-shrink-0";
  const modalTitleClasses = "text-xl sm:text-2xl font-bold text-amber-400";
  const closeButtonClasses = "text-gray-400 hover:text-white transition-colors duration-200 p-1 rounded-full hover:bg-gray-700/60";

  const pickListContainerClasses = "space-y-3 overflow-y-auto flex-grow pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50";
  const pickItemClasses = "flex items-center gap-3 bg-gray-800/70 rounded-lg p-3 border border-gray-700/60 hover:border-cyan-600/70 transition-colors duration-200";
  const pickImageClasses = "rounded-full w-10 h-10 sm:w-12 sm:h-12 object-cover flex-shrink-0 border-2 border-gray-600";
  const pickInfoClasses = "flex-1 min-w-0";
  const pickDriverNameClasses = "text-white font-semibold text-sm sm:text-base truncate";
  const pickTeamClasses = "text-gray-400 text-xs truncate";
  const pickLineClasses = "text-cyan-400 text-xs";
  const pickActionsContainerClasses = "flex flex-col gap-1.5 items-end ml-2";
  const pickChoiceButtonContainerClasses = "flex gap-1.5";
  const pickChoiceButtonBase = "text-xs px-2.5 py-1 rounded-md font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-800 flex items-center gap-1 shadow-sm";
  const pickChoiceButtonMejor = "bg-gray-600 hover:bg-green-700 focus:ring-green-500 text-gray-200 hover:text-white";
  const pickChoiceButtonPeor = "bg-gray-600 hover:bg-red-700 focus:ring-red-500 text-gray-200 hover:text-white";
  const pickChoiceButtonSelectedMejor = "bg-green-500 text-white shadow-md focus:ring-green-400";
  const pickChoiceButtonSelectedPeor = "bg-red-500 text-white shadow-md focus:ring-red-400";
  const pickRemoveButtonClasses = "text-gray-500 hover:text-red-500 text-[11px] flex items-center gap-1 transition-colors duration-200 mt-0.5";

  const controlsContainerClasses = "mt-4 pt-4 border-t border-gray-700/50 space-y-4 flex-shrink-0";
  const amountInputClasses = "w-full py-2.5 px-4 rounded-lg bg-gray-700/60 border border-gray-600/80 text-white font-semibold text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition shadow-inner";
  const quickAddContainerClasses = "flex flex-wrap justify-center gap-2";
  const quickAddButtonClasses = "px-3 py-1 rounded-full text-xs font-medium bg-gray-600/80 text-gray-200 hover:bg-gray-500 hover:text-white transition shadow-sm active:scale-95";
  const modeToggleContainerClasses = "flex justify-center gap-0 p-1 bg-gray-800/80 rounded-lg";
  const modeToggleButtonBase = "flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-800";
  const modeToggleButtonActive = "bg-amber-500 text-black shadow-md scale-105";
  const modeToggleButtonInactive = "bg-transparent text-gray-300 hover:bg-gray-700/50";

  const payoutInfoContainerClasses = "bg-gray-800/70 p-3 rounded-lg text-gray-200 space-y-1 text-center text-sm border border-gray-700/60";
  const payoutLineClasses = "flex justify-between items-center";
  const payoutLabelClasses = "text-gray-400 text-xs";
  const payoutValueClasses = "font-semibold text-white";
  const payoutMultiplierClasses = "text-cyan-400 font-bold";
  const payoutTotalClasses = "font-bold text-lg text-green-400";

  const confirmButtonBaseClasses = "w-full py-3 rounded-lg font-bold text-lg transition-all duration-300 ease-in-out flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900";
  const confirmButtonEnabledClasses = "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-emerald-500/40 focus:ring-emerald-500 active:scale-[0.98]";
  const confirmButtonDisabledClasses = "bg-gray-600/80 text-gray-400/80 cursor-not-allowed";
  const confirmButtonLoadingClasses = "bg-yellow-600 text-white cursor-wait";

  // --- JSX RETURN ---
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={modalOverlayClasses}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex min-h-full items-end sm:items-center justify-center p-4 text-center">
            <motion.div
              className={modalPanelClasses}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              {/* Header */}
              <div className={modalHeaderClasses}>
                <h2 id="modal-title" className={modalTitleClasses}>Revisa tus Picks</h2>
                <button onClick={onClose} className={closeButtonClasses} aria-label="Cerrar">
                  <FaTimes size={18} />
                </button>
              </div>

              {/* Pick List */}
              <div className={pickListContainerClasses}>
                {combinedPicks.length > 0 ? combinedPicks.map((pick, idx) => (
                  <motion.div
                    key={pick.driver + pick.session_type + idx}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.2 }}
                    className={pickItemClasses}
                  >
                    <Image
                      src={`/images/pilots/${pick.driver.toLowerCase().replace(/ /g, '-')}.png`}
                      alt={pick.driver}
                      width={48}
                      height={48}
                      className={pickImageClasses}
                      unoptimized
                      onError={(e) => { e.currentTarget.src = '/images/pilots/default-pilot.png'; }}
                    />
                    <div className={pickInfoClasses}>
                      <p className={pickDriverNameClasses}>{pick.driver}</p>
                      <p className={pickTeamClasses}>{pick.team}</p>
                      <p className={pickLineClasses}>
                        Línea ({pick.session_type === 'qualy' ? 'Q' : 'R'}): <span className="font-semibold">{pick.line.toFixed(1)}</span>
                      </p>
                    </div>
                    <div className={pickActionsContainerClasses}>
                      <div className={pickChoiceButtonContainerClasses}>
                        <button
                          onClick={() => updatePick(idx, true)}
                          className={`${pickChoiceButtonBase} ${pick.betterOrWorse === 'mejor' ? pickChoiceButtonSelectedMejor : pickChoiceButtonMejor}`}
                          aria-label={`Cambiar a Mejor para ${pick.driver}`}
                        >
                         <FaCheck size={10}/> Mejor
                        </button>
                        <button
                          onClick={() => updatePick(idx, false)}
                          className={`${pickChoiceButtonBase} ${pick.betterOrWorse === 'peor' ? pickChoiceButtonSelectedPeor : pickChoiceButtonPeor}`}
                           aria-label={`Cambiar a Peor para ${pick.driver}`}
                        >
                         <FaTimes size={10}/> Peor
                        </button>
                      </div>
                      <button
                        onClick={() => removePickHandler(idx)}
                        className={pickRemoveButtonClasses}
                         aria-label={`Eliminar pick para ${pick.driver}`}
                      >
                        <FaTrashAlt className="w-2.5 h-2.5" /> Eliminar
                      </button>
                    </div>
                  </motion.div>
                )) : (
                   <p className="text-center text-gray-400 py-6">No has seleccionado picks.</p>
                )}
              </div>

              {/* Controls & Confirmation Section */}
              <div className={controlsContainerClasses}>
                {/* Amount Input */}
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                   <input
                      type="number"
                      value={amount === 0 ? '' : amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAmount(val === '' ? 0 : Math.max(0, parseInt(val) || 0));
                      }}
                      placeholder="Monto (min $10.000)"
                      min="10000"
                      step="1000"
                      className={`${amountInputClasses} pl-7`}
                   />
                </div>

                {/* Quick Add Buttons */}
                <div className={quickAddContainerClasses}>
                  {[10000, 20000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmount((prev) => Math.max(0, prev + amt))}
                      className={quickAddButtonClasses}
                    >
                      +${amt.toLocaleString('es-CO')}
                    </button>
                  ))}
                   <button
                      onClick={() => setAmount(10000)}
                      className={`${quickAddButtonClasses} bg-red-800/70 hover:bg-red-700`}
                    >
                      Limpiar
                    </button>
                </div>

                {/* Mode Toggle */}
                <div className={modeToggleContainerClasses}>
                  <button
                    onClick={() => setMode('full')}
                    className={`${modeToggleButtonBase} ${mode === 'full' ? modeToggleButtonActive : modeToggleButtonInactive}`}
                  >
                    🚀 Full Throttle
                  </button>
                  <button
                    onClick={() => setMode('safety')}
                    className={`${modeToggleButtonBase} ${mode === 'safety' ? modeToggleButtonActive : modeToggleButtonInactive}`}
                    disabled={totalPicks < 3}
                  >
                    🛡️ Safety Car
                  </button>
                </div>

                {/* Payout Info */}
                <div className={payoutInfoContainerClasses}>
                  {mode === 'full' ? (
                    <div className={payoutLineClasses}>
                      <span className={payoutLabelClasses}>{totalPicks} Aciertos</span>
                      <span>
                        <span className={payoutMultiplierClasses}>{(payoutCombos[totalPicks] || 0)}x</span>
                        <span className={payoutLabelClasses}> → </span>
                        <span className={payoutTotalClasses}>${(amount * (payoutCombos[totalPicks] || 0)).toLocaleString('es-CO')}</span>
                      </span>
                    </div>
                  ) : (
                    (safetyPayouts[totalPicks] || []).map((mult, idx) => (
                      <div key={idx} className={payoutLineClasses}>
                        <span className={payoutLabelClasses}>{totalPicks - idx} Aciertos</span>
                         <span>
                            <span className={payoutMultiplierClasses}>{mult}x</span>
                            <span className={payoutLabelClasses}> → </span>
                            <span className={payoutValueClasses}>${(mult * amount).toLocaleString('es-CO')}</span>
                         </span>
                      </div>
                    ))
                  )}
                   {mode === 'safety' && totalPicks < 3 && <p className="text-xs text-yellow-500 pt-1">Modo Safety requiere 3+ picks</p>}
                </div>

                {/* Error Message Area */}
                 <AnimatePresence>
                   {error && (
                     <motion.p
                       initial={{ opacity: 0, height: 0 }}
                       animate={{ opacity: 1, height: 'auto' }}
                       exit={{ opacity: 0, height: 0 }}
                       className="text-center text-red-400 text-sm font-medium flex items-center justify-center gap-1.5"
                     >
                       <FaExclamationTriangle /> {error}
                     </motion.p>
                   )}
                 </AnimatePresence>

                {/* Confirmation Button */}
                <button
                  onClick={handleBoldPayment}
                  disabled={!isValid || isProcessing}
                  className={`${confirmButtonBaseClasses} ${
                    isProcessing ? confirmButtonLoadingClasses : (!isValid ? confirmButtonDisabledClasses : confirmButtonEnabledClasses)
                  }`}
                >
                  {isProcessing ? (
                     <>
                       <FaSpinner className="animate-spin" /> {/* Use FontAwesome spinner */}
                       Procesando...
                     </>
                  ) : (
                     <>
                       <FaDollarSign /> Confirmar y Pagar ${amount.toLocaleString('es-CO')}
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
};

export default FullModal;
