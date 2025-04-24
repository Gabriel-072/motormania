'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';

import { createAuthClient } from '@/lib/supabase';
import { openBoldCheckout } from '@/lib/bold';
import PicksResumen from '@/components/PicksResumen';

const EXTRA_NUMBER_PRICE = 2000;
const EXTRA_NUMBER_COUNT = 5;
const BOLD_CURRENCY = 'COP';
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';
const APP_ORIGIN = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://motormaniacolombia.com';

type UserData = {
  username: string | null;
  full_name: string | null;
  email: string | null;
} | null;

type EntriesData = {
  numbers: string[];
  paid_numbers_count?: number;
} | null;

export default function DashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const [entries, setEntries] = useState<string[]>([]);
  const [userName, setUserName] = useState('Participante');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  const digitalIdRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn || !user?.id) {
      setIsLoading(false);
      setUserName('Invitado');
      setEntries([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setPaymentConfirmed(false);

    try {
      const jwt = await getToken({ template: 'supabase' });
      if (!jwt) throw new Error('Authentication token not available');
      const supabase = createAuthClient(jwt);

      const { data: userData, error: userError } =
        await supabase
          .from('clerk_users')
          .select('username, full_name, email')
          .eq('clerk_id', user.id)
          .maybeSingle<UserData>();
      if (userError) throw userError;

      const displayName =
        userData?.username ||
        userData?.full_name ||
        user.fullName ||
        'Participante';
      setUserName(displayName);
      setUserEmail(
        user.primaryEmailAddress?.emailAddress ||
          userData?.email ||
          null
      );

      const { data: entriesData, error: entriesError } =
        await supabase
          .from('entries')
          .select('numbers')
          .eq('user_id', user.id)
          .maybeSingle<EntriesData>();
      if (entriesError) throw entriesError;

      const formatted = (entriesData?.numbers || []).map((n) =>
        String(n).padStart(6, '0')
      );
      setEntries(formatted);
    } catch (err: any) {
      console.error(err);
      setError(
        `Error al cargar tus datos: ${err.message}. Contacta a ${SUPPORT_EMAIL}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, user, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleNumbers = () => setShowNumbers((p) => !p);

  const SkeletonLoader = ({ count = 5 }: { count?: number }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-700/50 rounded-lg animate-pulse aspect-video"
        />
      ))}
    </div>
  );

  const downloadDigitalID = useCallback(async () => {
    const el = digitalIdRef.current;
    if (!el) return setError('No se encontró el carnet para descargar.');
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
      const safe = userName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `MotorMania_DigitalID_${safe || 'usuario'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      setError('Error al generar la imagen del carnet.');
    }
  }, [userName]);

  const handleBuyExtraNumbers = async () => {
    if (!user?.id || !user?.primaryEmailAddress) {
      return setError(
        'Información de usuario (ID o Email) incompleta para la compra.'
      );
    }
    const boldApiKey = process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY;
    if (!boldApiKey) {
      console.error('Missing BOLD key');
      return setError(
        `La configuración de pago no está disponible. Contacta a ${SUPPORT_EMAIL}`
      );
    }

    setError(null);
    setPaymentConfirmed(false);

    try {
      const res = await fetch('/api/bold/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: EXTRA_NUMBER_PRICE }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(msg || `Error ${res.status}`);
      }
      const { orderId, amount, redirectUrl, integritySignature } =
        await res.json();

      if (!integritySignature) {
        throw new Error('Invalid payment signature.');
      }

      openBoldCheckout({
        apiKey: boldApiKey,
        orderId,
        amount: Math.round(amount),
        currency: BOLD_CURRENCY,
        description: `Pago por ${EXTRA_NUMBER_COUNT} números extra`,
        redirectionUrl: redirectUrl,
        integritySignature,
        customerData: {
          email:
            userEmail || user.primaryEmailAddress?.emailAddress || '',
          fullName: userName,
        },
      });
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error inesperado al iniciar pago.');
    }
  };

  const renderContent = () => {
    if (!isLoaded) {
      return (
        <div className="flex items-center space-x-3 p-6 bg-gray-800/50 rounded-lg mt-6">
          <motion.div
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-3 border-t-transparent border-amber-400 rounded-full"
          />
          <p className="text-gray-300">Verificando tu sesión...</p>
        </div>
      );
    }
    if (isLoading && isSignedIn) {
      return (
        <div
          className="mt-6 animate-rotate-border rounded-xl p-0.5"
          style={{
            background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg)`,
            animationDuration: '6s',
            '--border-angle': '0deg',
          } as React.CSSProperties}
        >
          <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-xl">
            <p>Cargando tus números...</p>
            <SkeletonLoader count={EXTRA_NUMBER_COUNT} />
          </div>
        </div>
      );
    }
    if (!isSignedIn) {
      return (
        <div className="mt-6 text-center p-6 bg-gray-800/80 rounded-lg border border-amber-500/30">
          <p>¡Hola Invitado! Inicia sesión para ver tu dashboard.</p>
          <div className="mt-4 flex gap-4 justify-center">
            <Link href="/sign-in">
              <button className="px-4 py-2 bg-amber-500 rounded-full">
                Iniciar Sesión
              </button>
            </Link>
            <Link href="/sign-up">
              <button className="px-4 py-2 bg-cyan-500 rounded-full">
                Registrarse
              </button>
            </Link>
          </div>
        </div>
      );
    }
    if (entries.length === 0) {
      return (
        <div className="mt-6 text-center p-6 bg-gray-800/80 rounded-lg border border-cyan-500/30">
          <p>Aún no tienes números asignados.</p>
          <div className="mt-4 flex gap-4 justify-center">
            <button
              onClick={handleBuyExtraNumbers}
              disabled={!isLoaded || isLoading}
              className="px-4 py-2 bg-amber-500 rounded-full disabled:opacity-50"
            >
              Comprar Números
            </button>
            <Link href="/jugar-y-gana">
              <button className="px-4 py-2 bg-cyan-500 rounded-full">
                Ir a F1 Fantasy
              </button>
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3>Tus Números ({entries.length})</h3>
          <button
            onClick={toggleNumbers}
            className="px-3 py-1 bg-amber-500 rounded-full"
          >
            {showNumbers ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {showNumbers && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {entries.map((n, i) => (
              <div
                key={i}
                className="p-4 bg-gray-900 rounded-lg text-center font-mono"
              >
                {n}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-white p-6">
      <header className="mb-8">
        <motion.h1
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl"
        >
          ¡Hola {userName}!
        </motion.h1>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 p-4 bg-red-800 rounded-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {renderContent()}

      <footer className="mt-16">
        <PicksResumen />
      </footer>
    </div>
  );
}