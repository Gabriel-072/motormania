'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

function DirectAccessContent() {
  const router = useRouter();
  const clerk = useClerk();
  const searchParams = useSearchParams();
  
  const orderId = searchParams.get('order');
  const email = searchParams.get('email');
  const verified = searchParams.get('verified');
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'redirecting'>('verifying');

  useEffect(() => {
    if (!orderId || !email) {
      router.push('/');
      return;
    }

    if (verified === 'true') {
      // Email already verified by webhook - immediate access
      proceedToLogin();
    } else {
      // Quick verification then proceed
      verifyAndProceed();
    }
  }, [orderId, email, verified]);

  const proceedToLogin = () => {
    setStatus('success');
    toast.success('🎉 ¡Acceso VIP activado exitosamente!');
    
    setTimeout(() => {
      setStatus('redirecting');
      clerk.redirectToSignIn({
        initialValues: { emailAddress: email || undefined },
        afterSignInUrl: '/fantasy-vip',
        afterSignUpUrl: '/fantasy-vip'
      });
    }, 1500);
  };

  const verifyAndProceed = async () => {
    try {
      const response = await fetch('/api/vip/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, email })
      });

      const data = await response.json();
      
      if (data.success) {
        proceedToLogin();
      } else {
        // Fallback to email collection
        router.push(`/vip-email-only?order=${orderId}`);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      router.push(`/vip-email-only?order=${orderId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700"
        >
          <div className="text-3xl font-bold mb-8">
            <span className="text-red-500">Motor</span>
            <span className="text-amber-400">Manía</span>
          </div>

          {status === 'verifying' && (
            <>
              <div className="text-6xl mb-6 animate-bounce">🔍</div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Verificando tu acceso VIP...
              </h1>
              <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-6xl mb-6">✅</div>
              <h1 className="text-2xl font-bold text-green-400 mb-4">
                ¡Acceso VIP Confirmado!
              </h1>
              <p className="text-gray-300">
                Preparando tu dashboard de predicciones...
              </p>
            </>
          )}

          {status === 'redirecting' && (
            <>
              <div className="text-6xl mb-6">🚀</div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Redirigiendo a tu dashboard...
              </h1>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function VipDirectAccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
      </div>
    }>
      <DirectAccessContent />
    </Suspense>
  );
}