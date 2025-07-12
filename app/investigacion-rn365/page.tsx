'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';
import Link from 'next/link';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { generateEventId, trackFBEvent } from '@/lib/trackFBEvent';

// Types
type GpSchedule = { gp_name: string; qualy_time: string; race_time: string };
type LeaderboardEntry = { user_id: string; name: string; score: number; updated_at: string };
type DriverStanding = { position: number; driver: string; points: number; evolution: string };
type ConstructorStanding = { position: number; constructor: string; points: number; evolution: string };
type Team = { name: string; logo_url: string };

interface Plan {
  id: 'race-pass' | 'season-pass';
  nombre: string;
  precio: number;
  precioUSD: number;
  periodo: string;
  beneficios: string[];
  isPopular?: boolean;
}

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Plans from VSL page
const planes: Plan[] = [
  {
    id: 'race-pass',
    nombre: 'Race Pass',
    precio: 20_000,
    precioUSD: 5,
    periodo: 'por carrera',
    beneficios: [
      'Predicciones VIP para 1 GP',
      'Acumula tus primeros puntos',
      'Empieza a competir por el viaje',
      'Acceso a sorteos exclusivos para VIPs',
    ]
  },
  {
    id: 'season-pass',
    nombre: 'Season Pass',
    precio: 80_000,
    precioUSD: 20,
    periodo: 'temporada completa',
    beneficios: [
      'Acceso VIP a todos los 24 GPs de 2025',
      'Ahorra un 40% vs Race Pass',
      'Elegible para viaje F1 2026 ($20,000+ valor)',
      'Participación automática en el sorteo VIP',
      'Acceso a estadísticas y análisis avanzados',
      'Historial completo de rendimiento',
      'Soporte prioritario 24/7'
    ],
    isPopular: true
  }
];

// Static data
const gpFlags: Record<string, string> = {
  'Japanese Grand Prix': '/flags/japan.gif',
  'Monaco Grand Prix': '/flags/monaco.gif',
  'British Grand Prix': '/flags/uk.gif',
  'Bahrain Grand Prix': '/flags/bahrain.gif',
  'Saudi Arabian Grand Prix': '/flags/saudi.gif',
  'Australian Grand Prix': '/flags/australia.gif',
  'Chinese Grand Prix': '/flags/china.gif',
  'Miami Grand Prix': '/flags/usa.gif',
  'Emilia Romagna Grand Prix': '/flags/italy.gif',
  'Canadian Grand Prix': '/flags/canada.gif',
  'Spanish Grand Prix': '/flags/spain.gif',
  'Austrian Grand Prix': '/flags/austria.gif',
  'Hungarian Grand Prix': '/flags/hungary.gif',
  'Belgian Grand Prix': '/flags/belgium.gif',
  'Dutch Grand Prix': '/flags/netherlands.gif',
  'Italian Grand Prix': '/flags/italy.gif',
  'Azerbaijan Grand Prix': '/flags/azerbaijan.gif',
  'Singapore Grand Prix': '/flags/singapore.gif',
  'United States Grand Prix': '/flags/usa.gif',
  'Mexico City Grand Prix': '/flags/mexico.gif',
  'Brazilian Grand Prix': '/flags/brazil.gif',
  'Las Vegas Grand Prix': '/flags/usa.gif',
  'Qatar Grand Prix': '/flags/qatar.gif',
  'Abu Dhabi Grand Prix': '/flags/uae.gif',
};

const driverToTeam: Record<string, string> = {
  'Max Verstappen': 'Red Bull Racing',
  'Yuki Tsunoda': 'Red Bull Racing', 
  'Lando Norris': 'McLaren',
  'Oscar Piastri': 'McLaren',
  'Lewis Hamilton': 'Ferrari', 
  'Charles Leclerc': 'Ferrari',
  'George Russell': 'Mercedes',
  'Kimi Antonelli': 'Mercedes', 
  'Fernando Alonso': 'Aston Martin',
  'Lance Stroll': 'Aston Martin',
  'Liam Lawson': 'RB', 
  'Isack Hadjar': 'RB', 
  'Nico Hulkenberg': 'Sauber', 
  'Gabriel Bortoleto': 'Sauber', 
  'Pierre Gasly': 'Alpine',
  'Franco Colapinto': 'Alpine', 
  'Alex Albon': 'Williams',
  'Carlos Sainz': 'Williams', 
  'Oliver Bearman': 'Haas F1 Team', 
  'Esteban Ocon': 'Haas F1 Team', 
};

const predictionSteps = [
  { name: 'pole', label: 'Posiciones de Pole', icon: 'Q', color: 'from-amber-500 to-yellow-500' },
  { name: 'gp', label: 'Posiciones de GP', icon: 'R', color: 'from-cyan-500 to-blue-500' },
  { name: 'extras', label: 'Predicciones Adicionales', icon: '+', color: 'from-purple-500 to-pink-500' },
  { name: 'micro', label: 'Micro-Predicciones', icon: 'μ', color: 'from-yellow-500 to-orange-500' },
];

// Helper functions
const hashUserData = (data: string) => {
  return btoa(data.toLowerCase().trim());
};

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

const getUserData = (user: any) => ({
  em: user?.primaryEmailAddress?.emailAddress ? 
      hashUserData(user.primaryEmailAddress.emailAddress) : undefined,
  ph: user?.phoneNumbers?.[0]?.phoneNumber ? 
      hashUserData(user.phoneNumbers[0].phoneNumber.replace(/\D/g, '')) : undefined,
  fn: user?.firstName ? hashUserData(user.firstName) : undefined,
  ln: user?.lastName ? hashUserData(user.lastName) : undefined,
  client_user_agent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
  fbc: typeof window !== 'undefined' ? getCookie('_fbc') : undefined,
  fbp: typeof window !== 'undefined' ? getCookie('_fbp') : undefined
});

export default function MotorManiaBridgePage() {
  // Hooks
  const { isSignedIn, user } = useUser();
  const clerk = useClerk();
  const router = useRouter();

  // State management
  const [hydrated, setHydrated] = useState(false);
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([]);
  const [constructorStandings, setConstructorStandings] = useState<ConstructorStanding[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeUsers, setActiveUsers] = useState(2847);
  const [qualyCountdown, setQualyCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [raceCountdown, setRaceCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showQualy, setShowQualy] = useState(true);
  const [isQualyAllowed, setIsQualyAllowed] = useState(true);
  const [isRaceAllowed, setIsRaceAllowed] = useState(true);
  const [showPlatformPreview, setShowPlatformPreview] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  // Data fetching
  const fetchData = useCallback(async () => {
    try {
      const [
        { data: scheduleData, error: scheduleError },
        { data: leaderboardData, error: leaderboardError },
        { data: driverData, error: driverError },
        { data: constructorData, error: constructorError },
        { data: teamsData, error: teamsError }
      ] = await Promise.all([
        supabase.from('gp_schedule').select('*').order('race_time', { ascending: true }),
        supabase.from('leaderboard').select('*').order('score', { ascending: false }).limit(10),
        supabase.from('driver_standings').select('position, driver, points, evolution').eq('season', 2025).order('position', { ascending: true }).limit(5),
        supabase.from('constructor_standings').select('position, constructor, points, evolution').eq('season', 2025).order('position', { ascending: true }).limit(5),
        supabase.from('teams').select('name, logo_url').order('name')
      ]);

      if (!scheduleError && scheduleData) {
        const now = new Date();
        let currentGpIndex = -1;

        for (let i = 0; i < scheduleData.length; i++) {
          const raceDate = new Date(scheduleData[i].race_time);
          if (now <= raceDate && currentGpIndex === -1) {
            if (i > 0) {
              const prevRaceEndTime = new Date(scheduleData[i-1].race_time);
              prevRaceEndTime.setHours(prevRaceEndTime.getHours() + 4);
              if (now < prevRaceEndTime) {
                currentGpIndex = i - 1;
              } else {
                currentGpIndex = i;
              }
            } else {
              currentGpIndex = i;
            }
          }
        }

        if (currentGpIndex >= 0) {
          setCurrentGp(scheduleData[currentGpIndex]);
          const qualyDeadline = new Date(scheduleData[currentGpIndex].qualy_time).getTime() - 5 * 60 * 1000;
          const raceDeadline = new Date(scheduleData[currentGpIndex].race_time).getTime() - 5 * 60 * 1000;
          setIsQualyAllowed(now.getTime() < qualyDeadline);
          setIsRaceAllowed(now.getTime() < raceDeadline);
        }
      }

      if (!leaderboardError && leaderboardData) setLeaderboard(leaderboardData);
      if (!driverError && driverData) setDriverStandings(driverData);
      if (!constructorError && constructorData) setConstructorStandings(constructorData);
      if (!teamsError && teamsData) setTeams(teamsData);

      // Simulate active user count fluctuation
      setActiveUsers(2847 + Math.floor(Math.random() * 20) - 10);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  // Purchase handler
  const handlePurchase = async (planId: Plan['id']) => {
    const plan = planes.find(p => p.id === planId);
    if (!plan) return;

    // Track purchase intent
    trackFBEvent('InitiateCheckout', {
      params: {
        content_type: 'product',
        content_category: 'vip_membership_bridge',
        content_name: plan.nombre,
        content_ids: [planId],
        value: plan.precio / 1000,
        currency: 'COP',
        source: 'bridge_page'
      }
    });

    // Auth check
    if (!isSignedIn || !user) {
      // Store plan for after login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingVipPlan', planId);
        sessionStorage.setItem('pendingVipEventId', generateEventId());
      }

      clerk.openSignIn({
        redirectUrl: window.location.href,
        afterSignInUrl: window.location.href
      });
      return;
    }

    setProcessingPlan(planId);

    try {
      // Get Bold API key
      const apiKey = process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY;
      if (!apiKey) {
        toast.error('El sistema de pagos no está disponible temporalmente.');
        return;
      }

      // Create order
      const res = await fetch('/api/vip/register-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.nombre,
          amount: plan.precio,
          fullName: user.fullName,
          email: user.primaryEmailAddress?.emailAddress,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error creando orden');
      }

      const { orderId, amount, redirectionUrl, integritySignature } = await res.json();

      // Bold Checkout config
      const config = {
        apiKey,
        orderId,
        amount,
        currency: 'COP',
        description: `Acceso VIP · ${plan.nombre}`,
        redirectionUrl,
        integritySignature,
        renderMode: 'embedded',
        containerId: 'bold-embed-bridge',
        customerData: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress ?? '',
          fullName: user.fullName ?? '',
        }),
      };

      // Track checkout initiation
      const eventId = generateEventId();
      trackFBEvent('InitiateCheckout', {
        params: {
          content_type: 'product',
          content_category: 'vip_membership_bridge',
          content_name: plan.nombre,
          content_ids: [planId],
          value: plan.precio / 1000,
          currency: 'COP',
          predicted_ltv: planId === 'season-pass' ? 300 : 150,
          source: 'bridge_page'
        },
        event_id: eventId
      });

      // Dynamic import of Bold
      const { openBoldCheckout } = await import('@/lib/bold');

      // Open Bold Checkout
      openBoldCheckout({
        ...config,
        onSuccess: async (result: any) => {
          const purchaseEventId = generateEventId();
          trackFBEvent('Purchase', {
            params: {
              content_type: 'product',
              content_category: 'vip_membership_bridge',
              content_name: plan.nombre,
              content_ids: [planId],
              value: plan.precio / 1000,
              currency: 'COP',
              transaction_id: result?.orderId || orderId,
              source: 'bridge_page'
            },
            event_id: purchaseEventId
          });

          toast.success('✅ ¡Pago exitoso! Redirigiendo a la plataforma...');
          setTimeout(() => {
            router.push('/f1-fantasy-panel');
          }, 2000);
        },
        onFailed: ({ message }: { message?: string }) => {
          toast.error(`Pago rechazado: ${message || 'Por favor intenta con otro método de pago'}`);
          setProcessingPlan(null);
        },
        onPending: () => {
          toast.info('Tu pago está siendo procesado...');
          setProcessingPlan(null);
        },
        onClose: () => {
          setProcessingPlan(null);
        },
      });

    } catch (err: any) {
      console.error('Error en handlePurchase:', err);
      toast.error(err.message || 'Error al iniciar el proceso de pago');
      setProcessingPlan(null);
    }
  };

  // Countdown logic
  useEffect(() => {
    if (!currentGp) return;

    const updateCountdown = () => {
      const now = new Date();
      const qualyDate = new Date(currentGp.qualy_time);
      const raceDate = new Date(currentGp.race_time);

      let qualyDiff = qualyDate.getTime() - now.getTime();
      let raceDiff = raceDate.getTime() - now.getTime();

      if (qualyDiff > 0) {
        setQualyCountdown({
          days: Math.floor(qualyDiff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((qualyDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((qualyDiff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((qualyDiff % (1000 * 60)) / 1000),
        });
      } else {
        setQualyCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }

      if (raceDiff > 0) {
        setRaceCountdown({
          days: Math.floor(raceDiff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((raceDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((raceDiff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((raceDiff % (1000 * 60)) / 1000),
        });
      } else {
        setRaceCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [currentGp]);

  // Initialize data
  useEffect(() => {
    setHydrated(true);
    fetchData();
  }, [fetchData]);

  // Toggle countdown display
  useEffect(() => {
    const interval = setInterval(() => {
      setShowQualy(prev => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Format countdown
  const formatCountdown = (countdown: { days: number; hours: number; minutes: number; seconds: number }) => {
    const d = Math.max(0, countdown.days);
    const h = Math.max(0, countdown.hours);
    const m = Math.max(0, countdown.minutes);
    const s = Math.max(0, countdown.seconds);
    return `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-amber-400 font-bold">Cargando plataforma MotorManía...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Global reset and layout overrides */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        html,
        body {
          margin: 0;
          padding: 0;
          background-color: #030712; /* gray-950 */
        }
        body {
          overflow-x: hidden;
        }
        /* CRITICAL: Override the layout's main padding for this page */
        main:has(.motormania-page) {
          padding-top: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        /* Fallback for browsers that don't support :has() */
        main {
          padding-top: 0 !important;
        }
        /* Reset any wrapper containers */
        body > * {
          margin-top: 0 !important;
        }
        /* Ensure our page starts at the very top */
        .motormania-page {
          position: relative;
          top: 0;
          margin: 0;
          padding: 0;
          /* Remove the negative margin that was cutting off content */
        }
        /* Hide header and moving bar for this page */
        body:has(.motormania-page) header,
        body:has(.motormania-page) .moving-bar,
        body:has(.motormania-page) [class*="moving-bar"] {
          display: none !important;
        }
        /* Additional selector to ensure header is hidden */
        .motormania-page + header,
        header + main .motormania-page ~ header {
          display: none !important;
        }
        /* Smooth scroll behavior for anchor links */
        html {
          scroll-behavior: smooth;
        }
        /* F1 countdown animations */
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        /* VIP banner animations */
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        /* Mobile-optimized countdown */
        @media (max-width: 640px) {
          .countdown-text {
            font-size: 0.75rem;
          }
          .countdown-time {
            font-size: 1rem;
          }
        }
        /* Modal animations */
        @keyframes slideInUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes slideOutDown {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
          }
        }
      `}</style>

      {/* Bold Checkout Container */}
      {processingPlan && (
        <div
          id="bold-embed-bridge"
          data-bold-embed
          className="fixed inset-0 z-[100] pointer-events-none"
        >
          <style>{`
            #bold-embed-bridge > * {
              pointer-events: auto !important;
            }
          `}</style>
        </div>
      )}

      <div className="motormania-page min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold">
                  <span className="text-red-500">Motor</span>
                  <span className="text-amber-400">Manía</span>
                </div>
                <div className="hidden sm:block w-px h-6 bg-gray-700"></div>
                <div className="text-sm text-gray-400">
                  <span className="text-blue-400 font-medium">Como se reportó en RN365</span>
                  <span className="mx-2">•</span>
                  <span>Acceso Exclusivo para Lectores</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-300">{activeUsers.toLocaleString()} estrategas activos</span>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative py-12 sm:py-16 px-4 sm:px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-transparent to-orange-900/10"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,107,0.1),transparent_50%)]"></div>
          
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-full px-4 py-2 mb-6"
              >
                <span className="text-blue-400 text-sm font-semibold">INVESTIGACIÓN EXCLUSIVA RN365</span>
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-tight"
              >
                <span className="block text-white">Plataforma</span>
                <span className="block bg-gradient-to-r from-amber-400 via-orange-500 to-red-400 bg-clip-text text-transparent">
                  MotorManía Fantasy
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl sm:text-2xl text-gray-300 max-w-4xl mx-auto mb-8 leading-relaxed"
              >
                La plataforma viral descubierta en nuestra investigación donde miles de fanáticos compiten cada domingo con predicciones estratégicas de F1
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto"
              >
                <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-500/30 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-400">{activeUsers.toLocaleString()}</div>
                  <div className="text-sm text-gray-300">Estrategas Activos</div>
                </div>
                <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/30 border border-amber-500/30 rounded-xl p-4">
                  <div className="text-2xl font-bold text-amber-400">$1,000</div>
                  <div className="text-sm text-gray-300">Premio Próximo GP</div>
                </div>
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 border border-purple-500/30 rounded-xl p-4">
                  <div className="text-2xl font-bold text-purple-400">3</div>
                  <div className="text-sm text-gray-300">Viajes F1 2026</div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Live Platform Preview */}
        <section className="py-16 px-4 sm:px-6 bg-gradient-to-b from-transparent to-gray-950/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Mira la Plataforma en Acción
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Datos reales, competidores reales, premios reales. Así es como funciona MotorManía Fantasy.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Live GP Countdown */}
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-500/30 rounded-2xl p-6 h-full relative overflow-hidden">
                  {currentGp && gpFlags[currentGp.gp_name] && (
                    <img
                      src={gpFlags[currentGp.gp_name]}
                      alt=""
                      className="absolute inset-0 w-full h-full opacity-10 object-cover"
                    />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <h3 className="text-lg font-bold text-blue-300">EN VIVO</h3>
                    </div>
                    
                    <h4 className="text-xl font-bold text-white mb-2">
                      {currentGp ? currentGp.gp_name : 'Próximo GP'}
                    </h4>
                    
                    {currentGp && (
                      <>
                        <div className="text-center my-6">
                          <p className="text-sm text-blue-200 mb-2">
                            {showQualy ? 'Predicciones de Qualy cierran en' : 'Predicciones de Carrera cierran en'}
                          </p>
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={showQualy ? 'qualy' : 'race'}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.3 }}
                              className="font-mono text-2xl font-bold text-white"
                            >
                              {formatCountdown(showQualy ? qualyCountdown : raceCountdown)}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        
                        <div className="bg-black/30 rounded-lg p-3 mt-4">
                          <div className="text-xs text-blue-200 space-y-1">
                            <div className="flex justify-between">
                              <span>Qualifying:</span>
                              <span>{new Date(currentGp.qualy_time).toLocaleDateString('es-CO', { 
                                day: '2-digit', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Carrera:</span>
                              <span>{new Date(currentGp.race_time).toLocaleDateString('es-CO', { 
                                day: '2-digit', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Leaderboard */}
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-amber-900/40 to-amber-800/40 border border-amber-500/30 rounded-2xl p-6 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">🏆</span>
                    <h3 className="text-lg font-bold text-amber-300">Leaderboard Global</h3>
                  </div>
                  
                  <div className="space-y-3">
                    {leaderboard.slice(0, 5).map((entry, index) => (
                      <motion.div
                        key={entry.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 ? 'bg-yellow-600/30 border border-yellow-500/30' :
                          index === 1 ? 'bg-gray-600/30 border border-gray-500/30' :
                          index === 2 ? 'bg-orange-600/30 border border-orange-500/30' :
                          'bg-gray-800/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? 'bg-yellow-500 text-black' :
                            index === 1 ? 'bg-gray-400 text-black' :
                            index === 2 ? 'bg-orange-500 text-black' :
                            'bg-gray-600 text-white'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-white font-medium text-sm">{entry.name}</span>
                        </div>
                        <span className="text-amber-400 font-bold">{entry.score} pts</span>
                      </motion.div>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-3 bg-black/30 rounded-lg">
                    <p className="text-xs text-amber-200 text-center">
                      Actualizado en tiempo real • <span className="text-green-400">LIVE</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Standings Preview */}
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-green-900/40 to-green-800/40 border border-green-500/30 rounded-2xl p-6 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">🏁</span>
                    <h3 className="text-lg font-bold text-green-300">F1 2025 - Top 5</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {driverStandings.slice(0, 5).map((standing, index) => {
                      const teamName = driverToTeam[standing.driver];
                      const team = teams.find(t => t.name === teamName);
                      
                      return (
                        <motion.div
                          key={standing.driver}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-green-400 font-bold text-sm w-6 text-center">
                              {standing.position}
                            </span>
                            {team && (
                              <Image
                                src={team.logo_url}
                                alt={`${teamName} logo`}
                                width={20}
                                height={20}
                                className="object-contain"
                              />
                            )}
                            <span className="text-white text-sm">{standing.driver}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-green-300 text-sm font-medium">{standing.points}</span>
                            <span className={`text-xs ${
                              standing.evolution.startsWith('↑') ? 'text-green-400' :
                              standing.evolution.startsWith('↓') ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {standing.evolution}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 text-center">
                    <p className="text-xs text-green-200">Datos oficiales F1 2025</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Interface Preview */}
        <section className="py-16 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Interface de Predicciones
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                11 categorías de predicción, desde pole position hasta micro-predicciones estratégicas
              </p>
            </div>

            <div className="relative">
              {/* Overlay for demo */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 rounded-2xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Desbloquea el Interface Completo</h3>
                  <p className="text-gray-300 mb-6">Selecciona tu plan de acceso</p>
                  <button 
                    onClick={() => setShowPlansModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all"
                  >
                    Ver Planes de Acceso
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Preview Interface */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-700 rounded-2xl p-6 opacity-60">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {predictionSteps.map((step, index) => (
                    <div
                      key={step.name}
                      className={`p-4 rounded-xl border bg-gradient-to-br from-gray-800/50 to-gray-900/50 ${
                        index === 0 ? 'border-amber-500/30' :
                        index === 1 ? 'border-cyan-500/30' :
                        index === 2 ? 'border-purple-500/30' :
                        'border-yellow-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${step.color} p-[1px]`}>
                          <div className="w-full h-full bg-gray-900 rounded-[7px] flex items-center justify-center">
                            <span className="text-sm font-bold text-white">{step.icon}</span>
                          </div>
                        </div>
                        <h3 className="text-white font-bold">{step.label}</h3>
                      </div>
                      
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-gray-800/30 rounded-lg">
                            <div className="w-8 h-8 bg-gray-700 rounded"></div>
                            <div className="flex-1 h-4 bg-gray-700 rounded"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="py-16 px-4 sm:px-6 bg-gradient-to-b from-gray-950/50 to-gray-950">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Lo Que Descubrimos en Nuestra Investigación
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border border-blue-500/20 rounded-xl p-6">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-3">Premios Reales</h3>
                <p className="text-gray-300 text-sm mb-4">
                  "Cuando predije correctamente el podio, gritamos tan fuerte que los vecinos vinieron a ver si estábamos bien."
                </p>
                <p className="text-blue-400 text-xs font-medium">- Miguel Santos, Rosario</p>
              </div>

              <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-500/20 rounded-xl p-6">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-3">Adrenalina Real</h3>
                <p className="text-gray-300 text-sm mb-4">
                  "Mi corazón latía como si estuviera en el cockpit. Cada vuelta se volvió eléctrica."
                </p>
                <p className="text-green-400 text-xs font-medium">- Ana Herrera, MotorManía</p>
              </div>

              <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border border-purple-500/20 rounded-xl p-6">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🏆</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-3">Competencia Global</h3>
                <p className="text-gray-300 text-sm mb-4">
                  "12 tipos de diferentes países compitiendo cada fin de semana. Es como tener tu propio club del paddock F1."
                </p>
                <p className="text-purple-400 text-xs font-medium">- David Ruiz, CDMX</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-20 px-4 sm:px-6 bg-gradient-to-br from-black via-gray-950 to-gray-900">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 bg-green-600/20 border border-green-500/30 rounded-full px-4 py-2 mb-8">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-semibold">OFERTA ACTIVA PARA LECTORES RN365</span>
              </div>

              <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
                Reclama Tu Acceso de Estratega
              </h2>

              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
                Únete a {activeUsers.toLocaleString()} estrategas que ya están compitiendo por premios reales cada domingo. 
                La próxima carrera ofrece <span className="text-amber-400 font-bold">$1,000 USD</span> en premios.
              </p>

              <div className="bg-gradient-to-br from-gray-900 to-black border border-amber-500/30 rounded-2xl p-8 mb-8">
                <h3 className="text-2xl font-bold text-amber-400 mb-6">Tu Pase de Estratega Incluye:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">Predicciones para el próximo GP</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">Competir por $500 al mejor estratega</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">Elegible para $500 por sorteo</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">Puntos para viajes F1 2026</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => setShowPlansModal(true)}
                  className="block w-full max-w-lg mx-auto px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xl rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all transform hover:scale-105 shadow-xl"
                >
                  RECLAMAR PASE DE ESTRATEGA →
                </button>
                
                <p className="text-sm text-gray-500 max-w-2xl mx-auto">
                  Acceso seguro y gratuito. Próximo GP: <span className="text-amber-400 font-semibold">$500 al mejor estratega + $500 por sorteo</span>
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800 py-8 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-gray-500 text-sm">
              Esta página fue creada exclusivamente para lectores de la investigación de RN365. 
              MotorManía Fantasy es una plataforma independiente de competencias estratégicas de F1.
            </p>
          </div>
        </footer>

        {/* Plans Modal */}
        <AnimatePresence>
          {showPlansModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowPlansModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Elige Tu Pase de Estratega</h2>
                    <p className="text-gray-400">Acceso exclusivo para lectores de RN365</p>
                  </div>
                  <button
                    onClick={() => setShowPlansModal(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {planes.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative p-6 rounded-2xl border transition-all duration-300 ${
                        plan.isPopular
                          ? 'bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-amber-500/60 shadow-2xl shadow-amber-500/20'
                          : 'bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-gray-600/60'
                      }`}
                    >
                      {plan.isPopular && (
                        <div className="absolute top-0 left-0 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white text-sm font-black rounded-full uppercase tracking-wide shadow-2xl">
                          MÁS POPULAR
                        </div>
                      )}

                      <div className="flex items-center gap-4 mb-6">
                        {plan.id === 'race-pass' ? (
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                            <span className="text-3xl">🏁</span>
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl">
                            <span className="text-3xl">👑</span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-2xl font-black text-white">{plan.nombre}</h3>
                          <p className="text-gray-400 text-sm">{plan.periodo}</p>
                        </div>
                      </div>

                      <div className="mb-6">
                        <div className="flex items-baseline gap-3 mb-3">
                          <span className="text-4xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
                            ${plan.precioUSD} USD
                          </span>
                          {plan.isPopular && (
                            <span className="text-xl text-gray-500 line-through">
                              $33 USD
                            </span>
                          )}
                        </div>
                        {plan.id === 'race-pass' && (
                          <p className="text-blue-400 text-sm font-bold bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 inline-block">
                            Perfecto para empezar
                          </p>
                        )}
                      </div>

                      <ul className="space-y-3 mb-8 text-sm">
                        {plan.beneficios.map((beneficio, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-gray-300">
                            <svg
                              className="w-5 h-5 flex-shrink-0 text-green-400 mt-0.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586l-2.293-2.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="leading-relaxed">{beneficio}</span>
                          </li>
                        ))}
                      </ul>

                      {currentGp && plan.id === 'race-pass' && (
                        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                          <p className="text-blue-400 text-sm font-bold text-center">
                            ✓ Válido para: {currentGp.gp_name}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => handlePurchase(plan.id)}
                        disabled={processingPlan === plan.id}
                        className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-2xl ${
                          plan.isPopular
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400'
                            : 'bg-gradient-to-r from-gray-700 to-gray-600 text-white hover:from-gray-600 hover:to-gray-500'
                        } ${processingPlan === plan.id ? 'opacity-60 cursor-wait' : 'hover:scale-105 active:scale-95'}`}
                      >
                        {processingPlan === plan.id ? (
                          <>
                            <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24">
                              <circle
                                cx="12"
                                cy="12"
                                r="10"
                                strokeWidth="4"
                                className="opacity-25"
                                stroke="currentColor"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                              />
                            </svg>
                            Procesando...
                          </>
                        ) : plan.isPopular ? (
                          <>
                            <span className="text-2xl">🔥</span>
                            OBTENER SEASON PASS
                          </>
                        ) : (
                          <>
                            COMENZAR CON RACE PASS
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Trust indicators */}
                <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-gray-500 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">🔒</span>
                    <span>Pago seguro</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">💳</span>
                    <span>Garantía de devolución</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">⚡</span>
                    <span>Acceso inmediato</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}