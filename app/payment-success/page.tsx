// app/payment-success/page.tsx
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaTrophy, FaArrowRight, FaSpinner } from 'react-icons/fa';
import Link from 'next/link';

function PaymentSuccessContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  
  // Get URL parameters
  const isCrypto = searchParams.get('crypto') === 'true';
  const boldOrderId = searchParams.get('bold_order_id');
  const orderId = searchParams.get('order') || boldOrderId;

  useEffect(() => {
    if (!isLoaded) return;

    // Simulate processing time for better UX
    const timer = setTimeout(() => {
      setIsProcessing(false);
      
      // Try to get order details from localStorage for anonymous users
      try {
        const pendingPayment = localStorage.getItem('pendingPayment');
        const cryptoOrderId = localStorage.getItem('cryptoOrderId');
        
        if (pendingPayment) {
          const paymentData = JSON.parse(pendingPayment);
          setOrderDetails(paymentData);
          localStorage.removeItem('pendingPayment');
        } else if (cryptoOrderId) {
          setOrderDetails({ orderId: cryptoOrderId });
          localStorage.removeItem('cryptoOrderId');
        }
      } catch (error) {
        console.warn('Error parsing payment data:', error);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoaded]);

  // Auto-redirect after success
  useEffect(() => {
    if (!isProcessing && user?.id) {
      const redirectTimer = setTimeout(() => {
        router.push('/dashboard');
      }, 8000); // 8 seconds to read success message

      return () => clearTimeout(redirectTimer);
    }
  }, [isProcessing, user?.id, router]);

  if (!isLoaded || isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-6xl text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Procesando tu pago...</h1>
          <p className="text-gray-400">Esto tomará solo un momento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full"
      >
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', duration: 0.6 }}
          className="text-center mb-8"
        >
          <FaCheckCircle className="text-8xl text-green-500 mx-auto mb-4" />
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-bold text-white mb-2"
          >
            ¡Pago Exitoso! 🎉
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-xl text-gray-300"
          >
            Tu jugada ha sido confirmada
          </motion.p>
        </motion.div>

        {/* Order Details */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 mb-6"
        >
          <h3 className="text-lg font-semibold text-amber-400 mb-4">Detalles de tu Jugada</h3>
          
          <div className="space-y-3">
            {orderId && (
              <div className="flex justify-between">
                <span className="text-gray-400">ID de Orden:</span>
                <span className="text-white font-mono text-sm">{orderId.slice(-8)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-400">Método de Pago:</span>
              <span className="text-white">
                {isCrypto ? '🔶 Cryptocurrency' : '💳 Bold Payment'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Estado:</span>
              <span className="text-green-400 font-semibold">✅ Confirmado</span>
            </div>
          </div>
        </motion.div>

        {/* What's Next */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-6 border border-green-500/30 mb-6"
        >
          <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
            <FaTrophy /> ¿Qué sigue ahora?
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">1</span>
              </div>
              <div>
                <p className="text-white font-medium">Tus picks están activos</p>
                <p className="text-gray-400">Puedes seguir el progreso en tiempo real</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <div>
                <p className="text-white font-medium">Resultados después del GP</p>
                <p className="text-gray-400">Recibirás una notificación con tus resultados</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <div>
                <p className="text-white font-medium">Ganancias automáticas</p>
                <p className="text-gray-400">Si ganas, el dinero se acredita automáticamente</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link
            href="/dashboard"
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            Ver Mi Dashboard <FaArrowRight />
          </Link>
          
          <Link
            href="/mmc-go"
            className="flex-1 bg-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition-all text-center"
          >
            Hacer Otra Jugada
          </Link>
        </motion.div>

        {/* Auto-redirect notice */}
        {user?.id && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="text-center text-gray-500 text-sm mt-6"
          >
            Serás redirigido automáticamente al dashboard en unos segundos...
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}