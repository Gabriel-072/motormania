// app/fantasy-vip/page.tsx - Improved useEffect section
'use client';

import { useUser } from '@clerk/nextjs';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

import FantasyVipPageContent from '@/components/FantasyVipPageContent';
import LoadingAnimation      from '@/components/LoadingAnimation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FantasyVipPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  
  const [vipStatus, setVipStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);

  // Check VIP status function (extracted for reuse)
  const checkVipStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('vip_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('payment_status', 'paid')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ? 'valid' : 'invalid';
    } catch (err) {
      console.error('Error checking VIP status:', err);
      return 'invalid';
    }
  };

  // Handle order confirmation from URL
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const params = new URL(window.location.href).searchParams;
    const orderId = params.get('orderId');
    
    if (!orderId) return;

    const confirmOrder = async () => {
      setConfirmingOrder(true);
      try {
        // Confirm the order
        const response = await fetch('/api/vip/confirm-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Error confirming order:', error);
          // You might want to show a toast here
        }

        // Wait a bit to ensure DB is updated
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check VIP status after confirmation
        const status = await checkVipStatus(user.id);
        setVipStatus(status as 'valid' | 'invalid');

        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

      } catch (e) {
        console.error('Error in order confirmation:', e);
        // Still check VIP status in case the order was already confirmed
        const status = await checkVipStatus(user.id);
        setVipStatus(status as 'valid' | 'invalid');
      } finally {
        setConfirmingOrder(false);
      }
    };

    confirmOrder();
  }, [isLoaded, isSignedIn, user]);

  // Check authentication status
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setShowSignInModal(true);
    }
  }, [isLoaded, isSignedIn]);

  // Check VIP status (only if not confirming an order)
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || confirmingOrder) return;

    // Don't check if we're already processing an order from URL
    const params = new URL(window.location.href).searchParams;
    const orderId = params.get('orderId');
    if (orderId) return;

    const checkStatus = async () => {
      setVipStatus('loading');
      const status = await checkVipStatus(user.id);
      setVipStatus(status as 'valid' | 'invalid');
    };

    checkStatus();
  }, [isLoaded, isSignedIn, user, confirmingOrder]);

  // Helper functions
  const handleSignIn = () => {
    router.push(`/sign-in?redirect_url=${encodeURIComponent('/fantasy-vip')}`);
  };
  
  const handleCloseModal = () => setShowSignInModal(false);
  const triggerSignInModal = () => setShowSignInModal(true);
  const goToPurchase = () => router.push('/fantasy-vip-info');

  // Render logic
  if (!isLoaded) {
    return <LoadingAnimation animationDuration={2} text="Cargando cuenta..." />;
  }

  if (!isSignedIn) {
    return null;
  }

  if (vipStatus === 'loading' || confirmingOrder) {
    return (
      <div className="flex justify-center py-20">
        <LoadingAnimation 
          animationDuration={1} 
          text={confirmingOrder ? "Confirmando tu compra..." : "Verificando acceso VIP…"} 
        />
      </div>
    );
  }

  if (vipStatus === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-gray-200 p-4">
        <h1 className="text-3xl font-bold mb-4">Acceso VIP requerido</h1>
        <p className="mb-6 text-center">
          Para acceder a esta sección necesitas un Race Pass o Season Pass activo.
        </p>
        <button
          onClick={goToPurchase}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-semibold transition"
        >
          Ver planes VIP
        </button>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<LoadingAnimation animationDuration={2} text="Cargando contenido..." />}>
        <FantasyVipPageContent triggerSignInModal={triggerSignInModal} />
      </Suspense>

      {showSignInModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleCloseModal}
        >
          <motion.div
            className="w-full max-w-[90vw] sm:max-w-lg bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-amber-500/30 shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-exo2 text-xl font-bold text-white text-center mb-4">
              Inicia sesión para continuar
            </h2>
            <p className="font-exo2 text-gray-300 text-center mb-6">
              Debes iniciar sesión para comprar tu acceso&nbsp;VIP a F1&nbsp;Fantasy.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={handleSignIn}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-exo2 font-semibold transition text-sm sm:text-base"
              >
                Iniciar sesión
              </button>
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-exo2 transition text-sm sm:text-base"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}