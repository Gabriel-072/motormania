// 📁 /app/dashboard/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, Transition } from '@headlessui/react';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';

import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { openBoldCheckout } from '@/lib/bold';
import PicksResumen from '@/components/PicksResumen';
import { trackFBEvent } from '@/lib/trackFBEvent';

const EXTRA_NUMBER_PRICE = 10000;
const EXTRA_NUMBER_COUNT = 5;
const BOLD_CURRENCY = 'COP';
const APP_ORIGIN =
  typeof window !== 'undefined'
    ? window.location.origin
    : 'https://motormaniacolombia.com';

type UserData = {
  username: string | null;
  full_name: string | null;
  email: string | null;
} | null;

type EntriesData = {
  numbers: string[];
} | null;

type BoldHashResponse = {
  orderId: string;
  amount: string;
  callbackUrl: string;
  integrityKey: string;
  metadata?: { reference: string };
};

export default function DashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  // Estado
  const [entries, setEntries] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('Participante');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState<boolean>(false);
  const [showNumbers, setShowNumbers] = useState<boolean>(false);

  // Modals en cadena: primero upsell extra, luego promo fantasy
  const [showUpsellExtra, setShowUpsellExtra] = useState<boolean>(false);
  const [showFantasyPromo, setShowFantasyPromo] = useState<boolean>(false);

  const digitalIdRef = useRef<HTMLDivElement>(null);

  // Iniciar upsell de números extra a los 3s
  useEffect(() => {
    const timer = setTimeout(() => setShowUpsellExtra(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch de datos
  const fetchData = useCallback(
    async (showLoading = true) => {
      if (!isLoaded) return;
      if (!isSignedIn || !user?.id) {
        setIsLoading(false);
        setError(null);
        setUserName('Invitado');
        setEntries([]);
        return;
      }
      if (showLoading) setIsLoading(true);

      try {
        const jwt = await getToken({ template: 'supabase' });
        if (!jwt) throw new Error('Token no disponible');
        const supabase = createAuthClient(jwt);

        // Obtener datos de usuario
        const { data: userData } = await supabase
          .from('clerk_users')
          .select('username, full_name, email')
          .eq('clerk_id', user.id)
          .maybeSingle<UserData>();
        const displayName =
          userData?.username ||
          userData?.full_name ||
          user.fullName ||
          'Participante';
        setUserName(displayName);
        setUserEmail(
          user.primaryEmailAddress?.emailAddress || userData?.email || null
        );

        // Obtener entries
        const { data: entriesData } = await supabase
          .from('entries')
          .select('numbers')
          .eq('user_id', user.id)
          .maybeSingle<EntriesData>();
        const nums = entriesData?.numbers || [];
        setEntries(nums.map((n) => String(n).padStart(6, '0')));
        if (!paymentConfirmed) setError(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error inesperado.';
        if (!paymentConfirmed) setError(`Error al cargar datos: ${msg}`);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [isLoaded, isSignedIn, user?.id, getToken, paymentConfirmed]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const toggleNumbers = () => setShowNumbers((v) => !v);

  const downloadDigitalID = useCallback(async () => {
    const el = digitalIdRef.current;
    if (!el) return setError('No se pudo encontrar carnet.');
    try {
      await new Promise((r) => setTimeout(r, 150));
      const canvas = await html2canvas(el, {
        backgroundColor: '#111827',
        scale: 2.5,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      const safeName = userName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `MotorMania_ID_${safeName || 'usuario'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setError('Error al generar imagen.');
    }
  }, [userName]);

  const handleBuyExtraNumbers = async () => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!user?.id || !email) {
      return setError('Información de usuario incompleta para la compra.');
    }
    const key = process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY;
    if (!key) {
      return setError('Error de configuración de pago. Contacta a soporte.');
    }
    setError(null);
    setPaymentConfirmed(false);

    try {
      const res = await fetch('/api/bold/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: EXTRA_NUMBER_PRICE }),
      });
      if (!res.ok) throw new Error('Error generando firma de pago.');
      const {
        orderId,
        amount: amountStr,
        callbackUrl,
        integrityKey,
      }: BoldHashResponse = await res.json();

      openBoldCheckout({
        apiKey: key,
        orderId,
        amount: amountStr,
        currency: BOLD_CURRENCY,
        description: `Pago por ${EXTRA_NUMBER_COUNT} números extra`,
        redirectionUrl: callbackUrl,
        integritySignature: integrityKey,
        customerData: JSON.stringify({ email, fullName: userName }),
        renderMode: 'embedded',
        onSuccess: () => {
          setPaymentConfirmed(true);
          setError(null);
          setTimeout(() => fetchData(false), 7000);
        },
        onFailed: (details: any) => {
          setError(`Pago falló o cancelado. ${details?.message ?? ''}`);
        },
        onClose: () => {},
        onPending: (details: any) => {
          setError(`Pago pendiente. ${details?.message ?? ''}`);
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    }
  };

  const SkeletonLoader = ({ count = EXTRA_NUMBER_COUNT }: { count?: number }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-700/50 rounded-lg animate-pulse aspect-video" />
      ))}
    </div>
  );

  const renderContent = () => {
    if (!isLoaded) {
      return (
        <div className="flex items-center justify-center space-x-3 p-6 bg-gray-800/50 rounded-lg mt-6">
          <motion.div
            aria-hidden="true"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-3 border-t-transparent border-amber-400 rounded-full"
          />
          <p className="text-gray-300 text-lg font-exo2">
            Verificando tu sesión...
          </p>
        </div>
      );
    }
    if (isLoading && isSignedIn) {
      return (
        <div
          className="mt-6 animate-rotate-border rounded-xl p-0.5"
          style={{
            background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`,
            animationDuration: '6s',
          }}
        >
          <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-4 font-exo2">
              Cargando tus números...
            </h3>
            <SkeletonLoader />
          </div>
        </div>
      );
    }
    if (!isSignedIn) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-center p-6 bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-lg border border-amber-500/30"
        >
          <p className="text-amber-300 text-lg font-exo2 font-semibold">
            ¡Hola Invitado!
          </p>
          <p className="text-gray-300 mt-2 font-exo2">
            Inicia sesión o regístrate.
          </p>
          <div className="flex gap-4 justify-center mt-4">
            <Link href="/sign-in" className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-full text-sm shadow-md">
              Iniciar Sesión
            </Link>
            <Link href="/sign-up" className="bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-2 rounded-full text-sm shadow-md">
              Registrarse
            </Link>
          </div>
        </motion.div>
      );
    }
    if (entries.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-center p-6 bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-lg border border-cyan-500/30"
        >
          <p className="text-cyan-300 text-lg font-exo2 font-semibold">
            ¡Bienvenido a MotorManía!
          </p>
          <p className="text-gray-300 mt-2 font-exo2">
            Aún no tienes números asignados.
          </p>
          <p className="text-gray-400 mt-1 font-exo2 text-sm">
            Compra números extra o participa en F1 Fantasy.
          </p>
          <div className="flex gap-4 justify-center mt-4">
            <button
              onClick={handleBuyExtraNumbers}
              disabled={!isLoaded || isLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-full text-sm shadow-md disabled:opacity-60"
            >
              Comprar Números
            </button>
            <Link href="/fantasy" className="bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-2 rounded-full text-sm shadow-md">
              Ir a F1 Fantasy
            </Link>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mt-6"
      >
        <div
          className="animate-rotate-border rounded-xl p-0.5"
          style={{
            background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`,
            animationDuration: '6s',
          }}
        >
          <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
              <h3 className="text-xl font-semibold text-white font-exo2">
                Tus Números ({entries.length})
              </h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleNumbers}
                className="bg-gradient-to-r from-amber-500 to-cyan-500 text-white px-5 py-2 rounded-full text-sm shadow-md"
              >
                {showNumbers ? 'Ocultar' : 'Mostrar'} Números
              </motion.button>
            </div>
            <AnimatePresence mode="wait">
              {showNumbers && (
                <motion.div
                  key="numbers-list"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pr-2">
                    {entries.map((num, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.025, duration: 0.25, ease: 'easeOut' }}
                        className="relative bg-gray-800/60 p-3 rounded-lg text-center border border-amber-500/30 hover:border-amber-500/70 shadow-sm hover:shadow-md transition-all backdrop-blur-sm aspect-video flex items-center justify-center"
                      >
                        <span className="relative text-2xl font-bold text-amber-400 font-mono select-all">
                          {num}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white overflow-x-hidden font-exo2">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-20">
        <motion.h1
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 tracking-tight"
        >
          <span className="text-gray-400">¡Hola</span>{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400">
            {userName}
          </span>
          <span className="text-gray-400">!</span>{' '}
          <span className="text-2xl" role="img" aria-label="rocket">
            🚀
          </span>
        </motion.h1>

        <AnimatePresence>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
              role="alert"
              aria-live="assertive"
            >
              <div className="bg-red-900/50 border border-red-600/70 text-red-200 px-4 py-3 rounded-lg text-sm shadow-md">
                <span className="font-semibold mr-2">Error:</span>
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {paymentConfirmed && (
            <motion.div
              key="paid"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mb-6"
              role="status"
            >
              <div
                className="animate-rotate-border rounded-xl p-0.5"
                style={{
                  background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #86efac 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)`,
                  animationDuration: '4s',
                }}
              >
                <div className="bg-gradient-to-br from-gray-950 to-black p-4 rounded-xl shadow-lg backdrop-blur-sm text-green-300 text-center font-semibold text-sm">
                  <span role="img" aria-label="party popper" className="mr-2">
                    🎉
                  </span>
                  Pago procesado. Tus números se asignarán pronto vía webhook.
                  ¡Refresca en unos segundos!
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {renderContent()}

        {/* Comprar Números Extra */}
        {isSignedIn && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 sm:mt-12"
            aria-labelledby="buy-extra-heading"
          >
            <div
              className="animate-rotate-border rounded-xl p-0.5"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #eab308 20deg, #f59e0b 30deg, #eab308 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '7s',
              }}
            >
              <div className="bg-gradient-to-br from-gray-950 via-black to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center">
                <h3 id="buy-extra-heading" className="text-xl font-semibold text-white mb-2">
                  ¿Más Oportunidades?
                </h3>
                <p className="text-gray-300 mb-5 text-sm sm:text-base">
                  Agrega {EXTRA_NUMBER_COUNT} números extra por{' '}
                  {new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    minimumFractionDigits: 0,
                  }).format(EXTRA_NUMBER_PRICE)}
                  .
                </p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBuyExtraNumbers}
                  disabled={!isLoaded || isLoading}
                  className="relative inline-flex items-center justify-center w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:from-amber-600 hover:to-orange-600 hover:shadow-lg"
                >
                  Quiero {EXTRA_NUMBER_COUNT} Números Extra
                </motion.button>
              </div>
            </div>
          </motion.section>
        )}

        {/* ——— POP-UP UPSELL 5 NÚMEROS EXTRA ——— */}
        <Transition appear show={showUpsellExtra} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => {
              setShowUpsellExtra(false);
              setTimeout(() => setShowFantasyPromo(true), 300);
            }}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
            </Transition.Child>
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="mx-auto max-w-sm rounded-xl bg-gradient-to-br from-gray-800 to-black p-6 text-center text-white shadow-xl">
                  <Dialog.Title className="text-2xl font-bold text-amber-400 mb-2">
                    ¡Oferta Especial!
                  </Dialog.Title>
                  <p className="text-gray-300 mb-4">
                    Lleva {EXTRA_NUMBER_COUNT} números extra por solo{' '}
                    <span className="font-semibold text-amber-300">
                      $10.000 COP
                    </span>
                    .
                  </p>
                  <button
                    onClick={() => {
                      trackFBEvent('Upsell_Click', {
                        params: { product: '5_extra_numbers' },
                      });
                      handleBuyExtraNumbers();
                      setShowUpsellExtra(false);
                      setTimeout(() => setShowFantasyPromo(true), 300);
                    }}
                    className="w-full px-4 py-2 mb-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full transition"
                  >
                    ¡Lo quiero!
                  </button>
                  <button
                    onClick={() => {
                      setShowUpsellExtra(false);
                      setTimeout(() => setShowFantasyPromo(true), 300);
                    }}
                    className="text-sm text-gray-400 hover:text-gray-200 underline"
                  >
                    Ahora no, gracias
                  </button>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* ——— POP-UP PROMO F1 FANTASY ——— */}
        <Transition appear show={showFantasyPromo} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => setShowFantasyPromo(false)}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
            </Transition.Child>
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="mx-auto max-w-sm rounded-xl bg-gradient-to-br from-gray-800 to-black p-6 text-center text-white shadow-xl">
                  <Dialog.Title className="text-2xl font-bold text-cyan-400 mb-2">
                    ¡Únete a F1 Fantasy Gratis!
                  </Dialog.Title>
                  <p className="text-gray-300 mb-4">
                    Predice el podio, compite con tus amigos y vive la emoción de
                    cada GP.
                  </p>
                  <button
                    onClick={() => {
                      trackFBEvent('Promo_Click', {
                        params: { promotion: 'F1_Fantasy' },
                      });
                      setShowFantasyPromo(false);
                      router.push('/fantasy');
                    }}
                    className="w-full px-4 py-2 mb-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-full hover:from-cyan-600 hover:to-purple-600 transition"
                  >
                    Enviar Predicciones!
                  </button>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Secciones F1 Fantasy y MMC-GO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 mt-10 sm:mt-12">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            aria-labelledby="f1-fantasy-heading"
          >
            <div
              className="animate-rotate-border rounded-xl p-0.5 h-full"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #67e8f9 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '5s',
              }}
            >
              <div className="bg-gradient-to-br from-gray-950 via-black/90 to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center h-full flex flex-col justify-between">
                <div>
                  <h2
                    id="f1-fantasy-heading"
                    className="text-2xl font-bold text-cyan-400 mb-3"
                  >
                    ¡Acelerá tu Pasión!
                  </h2>
                  <p className="text-gray-300 mb-6 text-sm sm:text-base">
                    Juega en nuestro{' '}
                    <span className="font-semibold text-white">F1 Fantasy</span>.
                    ¡Predice podios, compite y gana!
                  </p>
                </div>
                <Link href="/fantasy">
                  <motion.button
                    whileHover={{
                      scale: 1.05,
                      boxShadow: '0 0 20px rgba(34, 211, 238, 0.4)',
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-8 py-3 rounded-full font-semibold hover:from-cyan-600 hover:to-purple-600 transition-all shadow-md"
                  >
                    Jugar F1 Fantasy
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            aria-labelledby="mmc-go-heading"
          >
            <div
              className="animate-rotate-border rounded-xl p-0.5 h-full"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #a855f7 20deg, #c084fc 30deg, #a855f7 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '6s',
              }}
            >
              <div className="bg-gradient-to-br from-gray-950 via-black/90 to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center h-full flex flex-col justify-between">
                <div>
                  <h2 id="mmc-go-heading" className="text-2xl font-bold text-purple-400 mb-3">
                    MMC-GO
                  </h2>
                  <p className="text-gray-300 mb-6 text-sm sm:text-base">
                    Participa en nuestro juego{' '}
                    <span className="font-semibold text-white">MMC-GO</span> y vive la adrenalina.
                  </p>
                </div>
                <Link href="/mmc-go">
                  <motion.button
                    whileHover={{
                      scale: 1.05,
                      boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)',
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-violet-500 text-white px-8 py-3 rounded-full font-semibold hover:from-purple-600 hover:to-violet-600 transition-all shadow-md"
                  >
                    Jugar MMC-GO
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.section>
        </div>

        {/* Resumen de Picks */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-10 sm:mt-12"
          aria-labelledby="picks-resumen-heading"
        >
          <div
            className="animate-rotate-border rounded-xl p-0.5"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #4ade80 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '8s',
            }}
          >
            <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm">
              <h2
                id="picks-resumen-heading"
                className="text-xl sm:text-2xl font-semibold text-green-400 mb-4 text-center"
              >
                Resumen Picks F1
              </h2>
              <PicksResumen />
            </div>
          </div>
        </motion.section>

        {/* Carnet Digital */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-10 sm:mt-12 max-w-md mx-auto"
          aria-labelledby="digital-id-main-heading"
        >
          <div
            className="animate-rotate-border rounded-xl p-0.5"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #facc15 20deg, #fde047 30deg, #facc15 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '6s',
            }}
          >
            <div className="bg-gradient-to-br from-gray-950 via-black to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center">
              <h2
                id="digital-id-main-heading"
                className="text-2xl font-semibold text-amber-300 mb-4"
              >
                Carnet Digital
              </h2>
              <div
                ref={digitalIdRef}
                className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 rounded-lg mb-5 relative overflow-hidden border border-amber-500/20 shadow-inner"
              >
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <h3 className="text-lg font-bold text-amber-400">MotorManía ID</h3>
                  <p className="text-xs text-cyan-300 mt-1">Miembro Oficial</p>
                </div>
                <p className="text-gray-300 text-sm mb-1 relative z-10">
                  Nombre:
                  <span className="block font-semibold text-base text-white break-words ml-1">
                    {userName}
                  </span>
                </p>
                <p className="text-gray-400 text-xs mb-4 relative z-10">
                  ID Usuario:
                  <span className="block font-mono text-sm text-gray-200 ml-1">
                    {user?.id || 'N/A'}
                  </span>
                </p>
                <div className="flex flex-col items-center mt-4 mb-4 relative z-10">
                  <div className="bg-white p-2 rounded-md shadow-md">
                    <QRCode
                      value={
                        user?.id
                          ? `${APP_ORIGIN}/verify?uid=${user.id}`
                          : 'invalid-user'
                      }
                      size={90}
                      bgColor="#FFFFFF"
                      fgColor="#111827"
                      level="M"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Escanea para verificar</p>
                </div>
                <p className="text-center text-gray-500 text-[10px] mt-3 relative z-10">
                  &copy; {new Date().getFullYear()} MotorManía Colombia
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={downloadDigitalID}
                disabled={!isLoaded || isLoading || !user?.id}
                className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 px-6 py-2.5 rounded-full font-semibold text-sm hover:from-yellow-400 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                Descargar Carnet
              </motion.button>
              <p className="text-xs text-gray-400 mt-3">
                Muestra este carnet en negocios aliados.
              </p>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}