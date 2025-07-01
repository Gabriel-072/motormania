'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { trackFBEvent } from '@/lib/trackFBEvent';

export default function FantasyVipSuccess() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const [verificationStatus, setVerificationStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [countdown, setCountdown] = useState(5);
  const [conversionTracked, setConversionTracked] = useState(false);

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
    
    if (!orderId) {
      router.push('/fantasy-vip-info');
      return;
    }

    setTimeout(() => {
      let retryCount = 0;
      const maxRetries = 10;
      const retryDelay = 2000;

      const checkPayment = async () => {
        const verification = await verifyPayment(orderId);
        
        if (verification?.isPaid) {
          setVerificationStatus('success');
          setOrderDetails(verification);
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } else if (retryCount < maxRetries) {
          if (retryCount === 3) {
            console.log('Attempting manual order confirmation...');
            try {
              const confirmRes = await fetch('/api/vip/confirm-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
              });
              if (confirmRes.ok) {
                console.log('Manual confirmation successful');
                const recheck = await verifyPayment(orderId);
                if (recheck?.isPaid) {
                  setVerificationStatus('success');
                  setOrderDetails(recheck);
                  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                  return;
                }
              }
            } catch (e) {
              console.error('Manual confirmation failed:', e);
            }
          }
          retryCount++;
          setTimeout(checkPayment, retryDelay);
        } else {
          setVerificationStatus('error');
        }
      };

      checkPayment();
    }, 1000);
  }, [router]);

  // Purchase and PageView tracking
  useEffect(() => {
    if (verificationStatus === 'success' && orderDetails && !conversionTracked) {
      const orderId = new URLSearchParams(window.location.search).get('orderId');
      if (!orderId) return;
      const backupEventId = `backup_${orderId}`;
      
      trackFBEvent('Purchase', {
        params: {
          content_ids: [orderDetails.planId],
          content_type: 'product',
          content_name: orderDetails.planId === 'season-pass' ? 'Season Pass' : 'Race Pass',
          value: orderDetails.amount / 1000,
          currency: 'COP',
          transaction_id: orderId,
          conversion_source: 'success_page_backup'
        },
        email: user?.primaryEmailAddress?.emailAddress,
        event_id: backupEventId
      });

      fetch('/api/fb-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'Purchase',
          event_id: backupEventId,
          event_source_url: window.location.href,
          params: {
            content_ids: [orderDetails.planId],
            content_type: 'product',
            value: orderDetails.amount / 1000,
            currency: 'COP',
            transaction_id: orderId,
            conversion_source: 'success_page_backup'
          },
          email: user?.primaryEmailAddress?.emailAddress
        })
      }).catch(err => console.error('Success page CAPI error:', err));

      trackFBEvent('PageView', {
        params: {
          content_category: 'purchase_confirmation',
          content_name: 'VIP Purchase Success',
          page_type: 'success_page',
          plan_purchased: orderDetails.planId
        }
      });

      setConversionTracked(true);
    }
  }, [verificationStatus, orderDetails, conversionTracked, user]);

  // Engagement tracking
  useEffect(() => {
    if (verificationStatus === 'success') {
      const startTime = Date.now();
      const handleBeforeUnload = () => {
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);
        if (timeSpent > 5) {
          trackFBEvent('ViewContent', {
            params: {
              content_category: 'success_engagement',
              content_name: 'Success Page Engagement',
              time_spent: timeSpent,
              action: 'meaningful_engagement'
            }
          });
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [verificationStatus]);

  // Countdown for automatic redirect
  useEffect(() => {
    if (verificationStatus === 'success') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push('/fantasy-vip');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [verificationStatus, router]);

  const handleManualRedirect = () => {
    trackFBEvent('ViewContent', {
      params: {
        content_category: 'success_action',
        content_name: 'Manual VIP Panel Redirect',
        action: 'click_go_to_panel'
      }
    });
    router.push('/fantasy-vip');
  };

  const handleRetryVerification = () => {
    trackFBEvent('ViewContent', {
      params: {
        content_category: 'payment_verification',
        content_name: 'Retry Payment Verification',
        action: 'retry_click'
      }
    });
    window.location.reload();
  };

  const handleSupportContact = () => {
    trackFBEvent('Lead', {
      params: {
        content_category: 'support_contact',
        content_name: 'Payment Issue Support Contact',
        action: 'telegram_support_click'
      }
    });
    window.open('https://t.me/+573009290499', '_blank');
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
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
              <h1 className="text-2xl font-bold text-white mb-2">Procesando tu pago...</h1>
              <p className="text-gray-400">Estamos confirmando tu acceso VIP. Esto solo tomará unos segundos.</p>
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
                <p className="text-gray-300">Hola <span className="font-semibold text-white">{user?.firstName || 'Campeón'}</span>,</p>
                <p className="text-gray-400">Tu pago ha sido confirmado exitosamente. Ya eres parte del club exclusivo.</p>
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
                  <p className="text-amber-400 text-sm">Serás redirigido al panel VIP en <span className="font-bold">{countdown}</span> segundos...</p>
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
              <h1 className="text-2xl font-bold text-white mb-2">Verificación pendiente</h1>
              <p className="text-gray-400 mb-6">Tu pago está siendo procesado. Esto puede tomar unos minutos.</p>
              <div className="space-y-3">
                <button
                  onClick={handleRetryVerification}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:brightness-110 transition-all"
                >
                  Reintentar verificación
                </button>
                <button
                  onClick={handleSupportContact}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                >
                  Contactar soporte por Telegram
                </button>
                <button
                  onClick={() => router.push('/fantasy-vip-info')}
                  className="w-full py-3 border border-gray-600 text-gray-400 hover:text-white rounded-xl transition-all"
                >
                  Volver al inicio
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4">ID de orden: {new URLSearchParams(window.location.search).get('orderId')}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}