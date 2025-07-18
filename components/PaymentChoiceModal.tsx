// components/PaymentChoiceModal.tsx

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { openBoldCheckout } from '@/lib/bold';

interface Prediction {
  pole1: string;
  pole2: string;
  pole3: string;
  gp1: string;
  gp2: string;
  gp3: string;
  fastest_pit_stop_team: string;
  fastest_lap_driver: string;
  driver_of_the_day: string;
  first_team_to_pit: string;
  first_retirement: string;
}

interface PaymentChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  predictions: Partial<Prediction>;
  gpName: string;
  onFreeSubmit: () => Promise<void>;
  onVipSuccess: () => void;
}

export default function PaymentChoiceModal({
  isOpen,
  onClose,
  predictions,
  gpName,
  onFreeSubmit,
  onVipSuccess
}: PaymentChoiceModalProps) {
  const { user } = useUser();
  const [processing, setProcessing] = useState<'free' | 'vip' | null>(null);

  const handleFreeSubmission = async () => {
    setProcessing('free');
    try {
      await onFreeSubmit();
      onClose();
    } catch (error) {
      console.error('Free submission error:', error);
      toast.error('Error al enviar predicción gratuita');
    } finally {
      setProcessing(null);
    }
  };

  const handleVipSubmission = async () => {
    if (!user) {
      toast.error('Debes estar autenticado para realizar el pago');
      return;
    }

    setProcessing('vip');

    try {
      // Create VIP order
      const orderResponse = await fetch('/api/vip/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictions,
          gpName,
          userEmail: user.primaryEmailAddress?.emailAddress,
          userName: user.fullName || user.firstName || 'VIP User'
        })
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error creando orden de pago');
      }

      const { orderId, amount, redirectionUrl, integritySignature } = await orderResponse.json();

      // Open Bold Checkout
      openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
        orderId,
        amount,
        currency: 'COP',
        description: `Predicción VIP - ${gpName}`,
        redirectionUrl,
        integritySignature,
        customerData: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress,
          fullName: user.fullName || user.firstName || 'VIP User'
        }),
        onSuccess: () => {
          toast.success('¡Pago exitoso! Tu predicción VIP ha sido registrada.');
          onVipSuccess();
          onClose();
        },
        onFailed: (error: any) => {
          toast.error(`Pago fallido: ${error?.message || 'Intenta con otro método de pago'}`);
          setProcessing(null);
        },
        onPending: () => {
          toast.info('Tu pago está siendo procesado...');
          setProcessing(null);
        },
        onClose: () => {
          setProcessing(null);
        }
      });

    } catch (error: any) {
      console.error('VIP submission error:', error);
      toast.error(error.message || 'Error al procesar el pago VIP');
      setProcessing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 50 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 font-exo2">
                Elige Cómo Enviar Tu Predicción
              </h2>
              <p className="text-gray-400 font-exo2">
                {gpName} - Decisión final
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2"
              disabled={processing !== null}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Option */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative p-6 rounded-2xl border-2 border-gray-600 bg-gradient-to-br from-gray-800/60 to-gray-900/60 hover:border-gray-500 transition-all duration-300"
            >
              <div className="absolute top-4 right-4">
                <span className="bg-gray-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  GRATIS
                </span>
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2 font-exo2">
                  Predicción Gratuita
                </h3>
                <p className="text-gray-300 text-sm font-exo2">
                  Envía tu predicción sin costo
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-300 text-sm">Envía tu predicción</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-300 text-sm">Ve tu puntaje</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-300 text-sm">Aparece en leaderboard</span>
                </div>
              </div>

              <button
                onClick={handleFreeSubmission}
                disabled={processing !== null}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                  processing === 'free'
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-gray-700 to-gray-600 text-white hover:from-gray-600 hover:to-gray-500 hover:scale-105 active:scale-95'
                }`}
              >
                {processing === 'free' ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" stroke="currentColor" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Enviando...
                  </div>
                ) : (
                  'Enviar Predicción Gratuita'
                )}
              </button>
            </motion.div>

            {/* VIP Option */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative p-6 rounded-2xl border-2 border-amber-500/60 bg-gradient-to-br from-amber-900/40 to-orange-900/40 hover:border-amber-400 transition-all duration-300 shadow-amber-500/20 shadow-lg"
            >
              <div className="absolute top-4 right-4">
                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                  VIP $5 USD
                </span>
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2 font-exo2 flex items-center gap-2">
                  <span className="text-amber-400">👑</span>
                  Predicción VIP
                </h3>
                <p className="text-amber-200 text-sm font-exo2">
                  Destaca en el leaderboard
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white text-sm">Todo lo de predicción gratuita</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-amber-200 text-sm font-semibold">Badge VIP en leaderboard</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-amber-200 text-sm font-semibold">Status VIP permanente</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-amber-200 text-sm font-semibold">Acceso a funciones exclusivas</span>
                </div>
              </div>

              <button
                onClick={handleVipSubmission}
                disabled={processing !== null}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                  processing === 'vip'
                    ? 'bg-amber-600 text-amber-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 hover:scale-105 active:scale-95 shadow-lg'
                }`}
              >
                {processing === 'vip' ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" stroke="currentColor" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Procesando Pago...
                  </div>
                ) : (
                  <>
                    <span className="text-xl mr-2">👑</span>
                    Pagar $5 y Competir
                  </>
                )}
              </button>

              <p className="text-amber-200/80 text-xs text-center mt-2">
                Pago seguro via Bold • Una sola vez
              </p>
            </motion.div>
          </div>

          {/* Footer Info */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <p className="text-gray-400 text-sm text-center font-exo2">
              <span className="text-amber-400">💡</span> Una vez VIP, todas tus futuras predicciones serán automáticamente VIP.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}