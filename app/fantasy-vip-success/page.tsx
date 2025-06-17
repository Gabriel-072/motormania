// app/fantasy-vip-success/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function FantasyVipSuccess() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const [verificationStatus, setVerificationStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [countdown, setCountdown] = useState(5);

  // Verify payment function
  const verifyPayment = async (orderId: string) => {
    try {
      const res = await fetch('/api/vip/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      
      if (!res.ok) throw new Error('Verification failed');
      
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Payment verification error:', error);
      return null;
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    
    if (!orderId || !isSignedIn) {
      router.push('/fantasy-vip-info');
      return;
    }

    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 2000; // 2 seconds

    const checkPayment = async () => {
      const verification = await verifyPayment(orderId);
      
      if (verification?.isPaid) {
        setVerificationStatus('success');
        setOrderDetails(verification);
        
        // Fire confetti!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        // Start countdown to redirect
        let timeLeft = 5;
        const countdownInterval = setInterval(() => {
          timeLeft--;
          setCountdown(timeLeft);
          if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            router.push('/fantasy-vip');
          }
        }, 1000);
        
      } else if (retryCount < maxRetries) {
        // Retry after delay
        retryCount++;
        setTimeout(checkPayment, retryDelay);
      } else {
        // Max retries reached
        setVerificationStatus('error');
      }
    };

    checkPayment();
  }, [isSignedIn, router]);

  // Manual redirect function
  const handleManualRedirect = () => {
    router.push('/fantasy-vip');
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-[radial-gradient(circle_at_center,_rgba(251,146,60,0.15),transparent_40%)] animate-[spin_20s_linear_infinite]" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[60rem] h-[60rem] bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.15),transparent_45%)] animate-[spin_25s_linear_infinite_reverse]" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        <AnimatePresence mode="wait">
          {verificationStatus === 'checking' && (
            <motion.div
              key="checking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-neutral-900/80 backdrop-blur-lg rounded-2xl p-8 text-center border border-neutral-800"
            >
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping" />
                <div className="relative w-full h-full bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-black animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-white mb-2">
                Procesando tu pago...
              </h1>
              <p className="text-gray-400">
                Estamos confirmando tu acceso VIP. Esto solo tomará unos segundos.
              </p>
              
              <div className="mt-6 flex justify-center space-x-1">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}

          {verificationStatus === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-gradient-to-br from-neutral-900/90 to-neutral-800/90 backdrop-blur-lg rounded-2xl p-8 text-center border-2 border-green-500/30"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center"
              >
                <CheckCircleIcon className="w-12 h-12 text-white" />
              </motion.div>
              
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-white mb-4"
              >
                ¡Bienvenido a VIP! 🎉
              </motion.h1>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-2 mb-6"
              >
                <p className="text-gray-300">
                  Hola <span className="font-semibold text-white">{user?.firstName || 'Campeón'}</span>,
                </p>
                <p className="text-gray-400">
                  Tu pago ha sido confirmado exitosamente. Ya eres parte del club exclusivo.
                </p>
              </motion.div>

              {orderDetails && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-black/30 rounded-xl p-4 mb-6"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Plan:</span>
                    <span className="text-amber-400 font-semibold">
                      {orderDetails.planId === 'season-pass' ? 'Season Pass' : 'Race Pass'}
                    </span>
                  </div>
                  {orderDetails.activePlan && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-400 text-sm">Válido hasta:</span>
                      <span className="text-white text-sm">
                        {new Date(orderDetails.expiresAt).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-amber-400 text-sm">
                    Serás redirigido al panel VIP en <span className="font-bold">{countdown}</span> segundos...
                  </p>
                </div>
                
                <button
                  onClick={handleManualRedirect}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:brightness-110 transition-all transform hover:scale-105 active:scale-95"
                >
                  Ir al Panel VIP ahora →
                </button>
              </motion.div>
            </motion.div>
          )}

          {verificationStatus === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-neutral-900/80 backdrop-blur-lg rounded-2xl p-8 text-center border border-red-500/30"
            >
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-500 to-rose-500 rounded-full flex items-center justify-center">
                <ExclamationCircleIcon className="w-12 h-12 text-white" />
              </div>
              
              <h1 className="text-2xl font-bold text-white mb-2">
                Verificación pendiente
              </h1>
              <p className="text-gray-400 mb-6">
                Tu pago está siendo procesado. Esto puede tomar unos minutos.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:brightness-110 transition-all"
                >
                  Reintentar verificación
                </button>
                
                <a
                  href="https://t.me/+573009290499"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                >
                  Contactar soporte por Telegram
                </a>
                
                <button
                  onClick={() => router.push('/fantasy-vip-info')}
                  className="w-full py-3 border border-gray-600 text-gray-400 hover:text-white rounded-xl transition-all"
                >
                  Volver al inicio
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                ID de orden: {new URLSearchParams(window.location.search).get('orderId')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}