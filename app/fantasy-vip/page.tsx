// 📁 /app/fantasy-vip/page.tsx
'use client';

import {
  useUser,
  useAuth
} from '@clerk/nextjs';
import {
  useState,
  useEffect,
  Suspense
} from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { createAuthClient } from '@/lib/supabase';
import FantasyVipPageContent from '@/components/FantasyVipPageContent';
import LoadingAnimation      from '@/components/LoadingAnimation';

export default function FantasyVipPage() {
  /* Clerk */
  const { isLoaded, isSignedIn, user } = useUser();

  /* Router */
  const router = useRouter();

  /* Estado general */
  const [vipStatus, setVipStatus]           = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [confirmingOrder, setConfirmingOrder] = useState(false);

  /* Estado y handlers del modal de sign-in */
  const [showSignInModal, setShowSignInModal] = useState(false);
  const handleCloseModal   = () => setShowSignInModal(false);
  const triggerSignInModal = () => setShowSignInModal(true);
  const handleSignIn       = () =>
    router.push(`/sign-in?redirect_url=${encodeURIComponent('/fantasy-vip')}`);

  /* ------------------------------------------------------------ */
  /* Helper: consulta si el usuario ya tiene pago 'paid' */
  /* ------------------------------------------------------------ */
  const checkVipStatus = async () => {
    try {
      const response = await fetch('/api/vip/check-access');
      const data = await response.json();
      
      if (data.hasAccess) {
        return 'valid';
      }
      return 'invalid';
    } catch (err) {
      console.error('[VIP] checkVipStatus error:', err);
      return 'invalid';
    }
  };

  /* ------------------------------------------------------------ */
  /* Fallback manual si llega ?orderId=...                        */
  /* ------------------------------------------------------------ */
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    if (!orderId) return;

    const confirmOrder = async () => {
      setConfirmingOrder(true);
      try {
        await fetch('/api/vip/confirm-order', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ orderId }),
        });
      } catch (e) {
        console.error('[VIP] confirm-order error:', e);
      } finally {
        await new Promise(r => setTimeout(r, 1000)); // dar tiempo al webhook
        const status = await checkVipStatus();
        setVipStatus(status as 'valid' | 'invalid');
        window.history.replaceState({}, '', '/fantasy-vip');
        setConfirmingOrder(false);
      }
    };

    confirmOrder();
  }, [isLoaded, isSignedIn, user]);

  /* ------------------------------------------------------------ */
  /* Chequeo normal al cargar / refrescar                         */
  /* ------------------------------------------------------------ */
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || confirmingOrder) return;

    (async () => {
      setVipStatus('loading');
      const status = await checkVipStatus();
      setVipStatus(status as 'valid' | 'invalid');
    })();
  }, [isLoaded, isSignedIn, user, confirmingOrder]);

  /* ------------------------------------------------------------ */
  /* Render                                                       */
  /* ------------------------------------------------------------ */
  if (!isLoaded) {
    return <LoadingAnimation animationDuration={2} text="Cargando cuenta..." />;
  }

  if (!isSignedIn) {
    /* Mostrar modal de login si lo usas, o redirigir */
    triggerSignInModal();
    return null;
  }

  if (vipStatus === 'loading' || confirmingOrder) {
    return (
      <div className="flex justify-center py-20">
        <LoadingAnimation
          animationDuration={1}
          text={confirmingOrder
            ? 'Confirmando tu compra...'
            : 'Verificando acceso VIP…'}
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
          onClick={() => router.push('/fantasy-vip-info')}
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
        {/* Pasamos el trigger al contenido por si se requiere login en sub-componentes */}
        <FantasyVipPageContent triggerSignInModal={triggerSignInModal} />
      </Suspense>

      {/* Modal de inicio de sesión */}
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