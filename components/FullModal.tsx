'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { FaTimes, FaTrashAlt, FaCheck, FaExclamationTriangle, FaDollarSign, FaSpinner } from 'react-icons/fa';
import { useStickyStore } from '@/stores/stickyStore';
import { openBoldCheckout } from '@/lib/bold';
import { useUser, useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { PickSelection } from '../app/types/picks';

interface FullModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FullModal: React.FC<FullModalProps> = ({ isOpen, onClose }) => {
  // State and Hooks
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

  // Validation Effect
  useEffect(() => {
    let msg: string | null = null;
    if (totalPicks < 2) msg = 'Elige al menos 2 picks';
    else if (totalPicks > 8) msg = 'Máximo 8 picks por jugada';
    else if (combinedPicks.some((p) => !p.betterOrWorse)) msg = 'Completa todos tus picks (Mejor/Peor)';
    else if (amount < 10000) msg = 'Monto mínimo $10.000 COP';

    setError(msg);
    setIsValid(!msg);
  }, [combinedPicks, totalPicks, amount]);

  // Pick Management Functions
  const updatePick = useCallback((index: number, better: boolean) => {
    const qualyCount = picks.qualy.length;
    const val = better ? 'mejor' : 'peor';
    if (index < qualyCount) {
      setQualyPicks(picks.qualy.map((p, i) => (i === index ? { ...p, betterOrWorse: val } : p)));
    } else {
      const iRace = index - qualyCount;
      setRacePicks(picks.race.map((p, i) => (i === iRace ? { ...p, betterOrWorse: val } : p)));
    }
  }, [picks.qualy, picks.race, setQualyPicks, setRacePicks]);

  const removePickHandler = useCallback((index: number) => {
    const qualyCount = picks.qualy.length;
    if (index < qualyCount) setQualyPicks(picks.qualy.filter((_, i) => i !== index));
    else setRacePicks(picks.race.filter((_, i) => i !== index - qualyCount));
    if (totalPicks - 1 < 2) onClose();
  }, [picks.qualy, picks.race, setQualyPicks, setRacePicks, totalPicks, onClose]);

  // Payment Handler (from first version)
  const handleBoldPayment = async () => {
    if (!user || !isValid || isProcessing) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/bold/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const { error = 'Error generando firma de pago.' } = await res.json().catch(() => ({}));
        throw new Error(error);
      }

      const { orderId, amount: amtStr, callbackUrl, integrityKey } = await res.json() as {
        orderId: string;
        amount: string;
        callbackUrl: string;
        integrityKey: string;
      };
      if (!orderId || !amtStr || !callbackUrl || !integrityKey) {
        throw new Error('Respuesta inválida del servidor para iniciar el pago.');
      }

      openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
        orderId,
        amount: amtStr,
        currency: 'COP',
        description: `MMC GO Picks (${totalPicks}) - ${mode === 'full' ? 'Full' : 'Safety'}`,
        redirectionUrl: callbackUrl,
        integritySignature: integrityKey,
        customerData: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress ?? '',
          fullName: user.fullName ?? 'Jugador MMC',
          phone: user.primaryPhoneNumber?.phoneNumber ?? '',
        }),
        renderMode: 'embedded',
        onSuccess: () => {
          toast.success('Pago confirmado – procesando jugada…');
          setIsProcessing(false);
        },
        onClose: () => setIsProcessing(false),
        onError: () => setIsProcessing(false),
        onPending: () => setIsProcessing(false),
      });
    } catch (err: any) {
      console.error('❌ Error iniciando pago:', err);
      setError(err.message || 'Error inesperado iniciando el pago.');
      setIsProcessing(false);
    }
  };

  // Tailwind Class Definitions (from second version)
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

  // JSX Return
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={modalOverlayClasses}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
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
              {combinedPicks.length > 0 ? (
                combinedPicks.map((pick, idx) => (
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
                          <FaCheck size={10} /> Mejor
                        </button>
                        <button
                          onClick={() => updatePick(idx, false)}
                          className={`${pickChoiceButtonBase} ${pick.betterOrWorse === 'peor' ? pickChoiceButtonSelectedPeor : pickChoiceButtonPeor}`}
                          aria-label={`Cambiar a Peor para ${pick.driver}`}
                        >
                          <FaTimes size={10} /> Peor
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
                ))
              ) : (
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
                      <span className={payoutMultiplierClasses}>{payoutCombos[totalPicks] || 0}x</span>
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
                {mode === 'safety' && totalPicks < 3 && (
                  <p className="text-xs text-yellow-500 pt-1">Modo Safety requiere 3+ picks</p>
                )}
              </div>

              {/* Error Message */}
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
                    <FaSpinner className="animate-spin" /> Procesando...
                  </>
                ) : (
                  <>
                    <FaDollarSign /> Confirmar y Pagar ${amount.toLocaleString('es-CO')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullModal;