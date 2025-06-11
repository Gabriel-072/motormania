// app/fantasy-vip/page.tsx
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
  /* ───────────────────────── Clerk ───────────────────────── */
  const { isLoaded, isSignedIn, user } = useUser();

  /* ───────────────────────── Routing ──────────────────────── */
  const router = useRouter();

  /* ────────────────────── VIP Access State ───────────────── */
  const [vipStatus, setVipStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');

  /* ───────────────────────── UI ──────────────────────────── */
  const [showSignInModal, setShowSignInModal] = useState(false);

  // 1️⃣ Si Clerk ya cargó y no está autenticado, abrimos modal
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setShowSignInModal(true);
    }
  }, [isLoaded, isSignedIn]);

  // 2️⃣ Si está autenticado, comprobamos en Supabase si tiene pase VIP pagado
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    (async () => {
      setVipStatus('loading');
      try {
        const { data, error } = await supabase
          .from('vip_transactions')
          .select('id')
          .eq('user_id', user!.id)
          .eq('payment_status', 'paid')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setVipStatus(data ? 'valid' : 'invalid');
      } catch (err) {
        console.error('Error comprobando VIP:', err);
        setVipStatus('invalid');
      }
    })();
  }, [isLoaded, isSignedIn, user]);

  /* ───────────────────────── Helpers ─────────────────────── */
  const handleSignIn = () => {
    router.push(`/sign-in?redirect_url=${encodeURIComponent('/fantasy-vip')}`);
  };
  const handleCloseModal   = () => setShowSignInModal(false);
  const triggerSignInModal = () => setShowSignInModal(true);

  const goToPurchase = () => {
    router.push('/fantasy-vip-info');
  };

  /* ───────────────────────── Render ───────────────────────── */
  // Mientras Clerk carga
  if (!isLoaded) {
    return <LoadingAnimation animationDuration={2} text="Cargando cuenta..." />;
  }

  //  No autenticado → modal de signin
  // (el modal se abre automáticamente en useEffect)
  // pero mientras tanto no mostramos nada
  if (!isSignedIn) {
    return null;
  }

  // Usuario autenticado pero estamos comprobando VIP
  if (vipStatus === 'loading') {
    return (
      <div className="flex justify-center py-20">
        <LoadingAnimation animationDuration={1} text="Verificando acceso VIP…" />
      </div>
    );
  }

  // Usuario autenticado pero NO VIP → CTA de compra
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

  // Usuario autenticado y tiene VIP → mostramos el contenido
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