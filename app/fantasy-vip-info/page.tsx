// /app/fantasy-vip-info/page.tsx
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Disclosure } from '@headlessui/react';
import Image from 'next/image';
import { toast } from 'sonner';
import { generateEventId, trackFBEvent } from '@/lib/trackFBEvent';

import {
  PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon,
  ForwardIcon, ChevronUpIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

import { createClient } from '@supabase/supabase-js';
import { openBoldCheckout } from '@/lib/bold';
import MovingBarFantasy from '@/components/MovingBarFantasy';
import LoadingAnimation from '@/components/LoadingAnimation';
import StickyAccessCTA from '@/components/StickyAccessCTA';
import { useVideoAnalytics } from '@/hooks/useVideoAnalytics';

// ============================================================================
// ENHANCED HELPER FUNCTIONS FOR TRACKING
// ============================================================================
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

// ============================================================================
// SUPABASE & CONFIGURATION
// ============================================================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================================================
// TEAM COLORS & DRIVER MAPPINGS
// ============================================================================
const teamColors: Record<
  string,
  { gradientFrom: string; gradientTo: string; border: string }
> = {
  'Red Bull Racing': {
    gradientFrom: 'from-blue-950',
    gradientTo: 'to-blue-600',
    border: 'border-blue-400/60',
  },
  McLaren: {
    gradientFrom: 'from-orange-800',
    gradientTo: 'to-orange-500',
    border: 'border-orange-400/60',
  },
  Mercedes: {
    gradientFrom: 'from-teal-800',
    gradientTo: 'to-cyan-400',
    border: 'border-cyan-300/60',
  },
  Ferrari: {
    gradientFrom: 'from-red-900',
    gradientTo: 'to-red-500',
    border: 'border-red-400/60',
  },
  'Aston Martin': {
    gradientFrom: 'from-emerald-900',
    gradientTo: 'to-emerald-500',
    border: 'border-emerald-400/60',
  },
  RB: {
    gradientFrom: 'from-indigo-900',
    gradientTo: 'to-indigo-500',
    border: 'border-indigo-400/60',
  },
  Alpine: {
    gradientFrom: 'from-blue-900',
    gradientTo: 'to-blue-400',
    border: 'border-blue-300/60',
  },
  Williams: {
    gradientFrom: 'from-blue-800',
    gradientTo: 'to-sky-400',
    border: 'border-sky-300/60',
  },
  Sauber: {
    gradientFrom: 'from-green-900',
    gradientTo: 'to-lime-500',
    border: 'border-lime-400/60',
  },
  'Haas F1 Team': {
    gradientFrom: 'from-gray-800',
    gradientTo: 'to-red-600',
    border: 'border-red-500/60',
  },
  Default: {
    gradientFrom: 'from-gray-700',
    gradientTo: 'to-gray-600',
    border: 'border-gray-400/60',
  },
};

const driverToTeam: Record<string, string> = {
  'Max Verstappen': 'Red Bull Racing',
  'Liam Lawson': 'RB',
  'Lando Norris': 'McLaren',
  'Oscar Piastri': 'McLaren',
  'Lewis Hamilton': 'Ferrari',
  'Charles Leclerc': 'Ferrari',
  'George Russell': 'Mercedes',
  'Kimi Antonelli': 'Mercedes',
  'Fernando Alonso': 'Aston Martin',
  'Lance Stroll': 'Aston Martin',
  'Yuki Tsunoda': 'Red Bull Racing',
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

const getDriverImage = (driver: string) =>
  `/images/pilots/${driver.trim().replace(/\s+/g, '-').toLowerCase()}.png`;

const getTeamCarImage = (team: string) =>
  `/images/cars/${team.trim().replace(/\s+/g, '-').toLowerCase()}.png`;

// ============================================================================
// TYPES
// ============================================================================
interface Plan {
  id: 'race-pass' | 'season-pass';
  nombre: string;
  precio: number;
  periodo: string;
  beneficios: string[];
  isPopular?: boolean;
}

interface FAQ { 
  q: string; 
  a: string; 
}

type RaceResult = {
  gp_name: string | null;
  gp1: string | null;
  pole1: string | null;
  fastest_lap_driver: string | null;
  fastest_pit_stop_team: string | null;
  first_team_to_pit: string | null;
};

type GpSchedule = { 
  gp_name: string; 
  qualy_time: string; 
  race_time: string 
};

// ============================================================================
// VIDEO PLAYER COMPONENT
// ============================================================================
function VideoPlayer({ onWatchProgress }: { onWatchProgress?: (percentage: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteCTA, setShowUnmuteCTA] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.volume = 0.8;
  }, []);

  // Track progress analytics
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !onWatchProgress) return;
    const handler = () => {
      onWatchProgress(Math.floor((v.currentTime / v.duration) * 100));
    };
    v.addEventListener('timeupdate', handler);
    return () => v.removeEventListener('timeupdate', handler);
  }, [onWatchProgress]);

  // Sync fullscreen state across browsers
  useEffect(() => {
    const doc: any = document;
    const onFsChange = () => {
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // Play / Pause
  const togglePlay = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
      setHasStarted(true);
      if (v.muted) setShowUnmuteCTA(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // Mute / Unmute
  const toggleMute = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  // Fullscreen toggle with vendor fallbacks
  const toggleFullscreen = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const c = containerRef.current;
    const v = videoRef.current;
    const doc: any = document;

    if (!(doc.fullscreenElement || doc.webkitFullscreenElement)) {
      if (c?.requestFullscreen) {
        c.requestFullscreen();
      } else if (c && (c as any).webkitRequestFullscreen) {
        (c as any).webkitRequestFullscreen();
      } else if (v && (v as any).webkitEnterFullscreen) {
        (v as any).webkitEnterFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-md aspect-video mx-auto bg-black rounded-lg overflow-hidden"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        loop
        playsInline
        preload="metadata"
      >
        <source src="https://fantasy-vip-cdn.b-cdn.net/VSL.mp4" type="video/mp4" />
      </video>

      {/* Initial Play CTA */}
      {!hasStarted && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-2xl font-bold"
          aria-label="Reproducir video"
        >
          ▶️ Reproducir Video
        </button>
      )}

      {/* Unmute CTA */}
      {showUnmuteCTA && (
        <button
          onClick={(e) => { toggleMute(e); setShowUnmuteCTA(false); }}
          className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-lg font-semibold"
          aria-label="Activar sonido"
        >
          🔊 Activar sonido
        </button>
      )}

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className="absolute bottom-4 left-4 bg-black/50 px-3 py-2 rounded-full text-white"
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 bg-black/50 px-3 py-2 rounded-full text-white"
        aria-label={isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
      >
        {isFullscreen ? '🡽' : '🡾'}
      </button>
    </div>
  );
}

// ============================================================================
// PREDICTIONS TEASER COMPONENT
// ============================================================================
function PredictionsTeaser() {
  const [result, setResult] = useState<RaceResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Get calendar
        const { data: schedRaw, error: schErr } = await supabase
          .from('gp_schedule')
          .select('gp_name, race_time');

        if (schErr) throw schErr;
        const schedule = (schedRaw ?? []) as GpSchedule[];
        if (!schedule.length) throw new Error('Sin calendario');

        // Get last completed GP
        const now = Date.now();
        const prevGp = [...schedule]
          .reverse()
          .find(({ race_time }) => new Date(race_time).getTime() < now);

        if (!prevGp) throw new Error('Aún no hay GP previos');
        const raceDateStr = prevGp.race_time.split('T')[0];

        // Get results
        const { data: resRaw, error: resErr } = await supabase
          .from('race_results')
          .select(
            'gp_name, gp1, pole1, fastest_lap_driver, fastest_pit_stop_team, first_team_to_pit'
          )
          .eq('gp_name', prevGp.gp_name)
          .eq('race_date', raceDateStr)
          .maybeSingle();

        if (resErr) throw resErr;
        setResult((resRaw as RaceResult) ?? null);
      } catch (e) {
        console.error('PredictionsTeaser:', e);
        setResult(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const buildDriverCard = (
    icon: string,
    label: string,
    driver: string | null | undefined,
    iconClass = 'text-amber-400'
  ) => {
    const team = driver ? driverToTeam[driver] ?? 'Default' : 'Default';
    const colors = teamColors[team] ?? teamColors.Default;

    return (
      <div
        key={label}
        className="animate-rotate-border rounded-xl p-px w-full"
        style={{
          // @ts-ignore
          '--border-angle': '0deg',
          background:
            'conic-gradient(from var(--border-angle),transparent 0deg,transparent 10deg,var(--tw-gradient-stops))',
          animation: 'rotate-border 3s linear infinite',
        }}
      >
        <motion.div
          className={`relative p-3 sm:p-4 pb-0 rounded-xl shadow-lg z-10 bg-gradient-to-br h-40 overflow-hidden ${colors.gradientFrom} ${colors.gradientTo}`}
        >
          <div className="absolute inset-0 bg-gradient-to-bl from-black/70 via-black/40 to-transparent z-0" />
          <div className="relative z-10 pr-[35%] sm:pr-[40%] flex flex-col justify-center h-full space-y-1">
            {driver ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={`${iconClass} text-lg sm:text-xl drop-shadow-md`}>{icon}</span>
                  <p className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight drop-shadow-md">
                    {label}: {driver.split(' ').slice(-1)[0]}
                  </p>
                </div>
                <p className="text-xs sm:text-sm text-gray-200 font-exo2 leading-tight drop-shadow-md">
                  {result?.gp_name ?? ''}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-300 font-exo2 leading-tight drop-shadow-md">
                  {team}
                </p>
              </>
            ) : (
              <p className="text-gray-300 font-exo2">Sin datos</p>
            )}
          </div>

          {driver && (
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="absolute bottom-0 right-[-5px] w-[70%] sm:w-[75%] max-w-[200px] h-full"
            >
              <Image
                src={getDriverImage(driver)}
                alt={driver}
                fill
                sizes="200px"
                className="object-contain object-bottom drop-shadow-xl"
              />
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  };

  const buildTeamCard = (title: string, team: string | null | undefined) => {
    const colors = team ? teamColors[team] ?? teamColors.Default : teamColors.Default;

    return (
      <div
        key={title}
        className="animate-rotate-border rounded-xl p-px w-full"
        style={{
          // @ts-ignore
          '--border-angle': '135deg',
          background:
            'conic-gradient(from var(--border-angle),transparent 0deg,transparent 10deg,var(--tw-gradient-stops))',
          animation: 'rotate-border 5s linear infinite',
        }}
      >
        <motion.div
          className={`rounded-xl shadow-lg relative z-10 flex flex-col items-center bg-gradient-to-br h-40 overflow-hidden ${colors.gradientFrom} ${colors.gradientTo}`}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
          <div className="relative z-20 w-full text-center flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-1">
            <h2 className="text-base sm:text-lg font-bold text-white font-exo2 drop-shadow-md flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
              </svg>
              {title}
            </h2>
            {team ? (
              <p className="text-[10px] sm:text-xs text-white/90 font-exo2 drop-shadow-md truncate">
                {team} – {result?.gp_name}
              </p>
            ) : (
              <p className="text-gray-300 font-exo2 text-xs sm:text-sm mt-2">Sin datos</p>
            )}
          </div>

          {team && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute inset-0 w-full h-full z-0"
            >
              <Image
                src={getTeamCarImage(team)}
                alt={team}
                fill
                className="object-cover object-center"
              />
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <section className="relative py-16 sm:py-20 px-4 sm:px-6 bg-neutral-950">
      <motion.h2
        className="text-center text-2xl sm:text-3xl font-black mb-10 sm:mb-12 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        PREDICE DESDE EL GANADOR HASTA EL PRIMER EQUIPO EN PITS
      </motion.h2>

      <div className="grid gap-4 sm:grid-cols-2 max-w-lg sm:max-w-none mx-auto">
        {buildDriverCard('🏆', 'Ganador', result?.gp1)}
        {buildTeamCard('Primer Equipo en Pits', result?.first_team_to_pit)}
      </div>
    </section>
  );
}

// ============================================================================
// MAIN LANDING PAGE COMPONENT
// ============================================================================
export default function FantasyVipLanding() {
  // ============================================================================
  // HOOKS & REFS
  // ============================================================================
  const clerk = useClerk();
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const pendingPlanRef = useRef<string | null>(null);

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [showSticky, setShowSticky] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  
  // Video & tracking states
  const [hasWatchedVideo, setHasWatchedVideo] = useState(false);
  const [showUnlockButton, setShowUnlockButton] = useState(false);
  const [watchPercentage, setWatchPercentage] = useState(0);
  const [videoEngagementTracked, setVideoEngagementTracked] = useState(new Set<number>());
  const [planViewsTracked, setPlanViewsTracked] = useState(new Set<string>());
  const { trackVideoProgress, trackVipEvent, sessionId } = useVideoAnalytics();

  // Countdown states
  const [gpSchedule, setGpSchedule] = useState<GpSchedule[]>([]);
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [qualyCountdown, setQualyCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [raceCountdown, setRaceCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showQualy, setShowQualy] = useState(true);

  // ============================================================================
  // DATA CONFIGURATION
  // ============================================================================
  const planes: Plan[] = [
    {
      id: 'race-pass',
      nombre: 'Race Pass',
      precio: 20_000,
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
      precio: 200_000,
      periodo: 'temporada completa',
      beneficios: [
        'Acceso VIP a todos los GPs',
        'Ahorra un 15 % vs Race Pass',
        'Panel telemetry',
        'Early-access a nuevas funciones',
        'Soporte prioritario 24/7'
      ],
      isPopular: true
    }
  ];

  const faqData: FAQ[] = [
    {
      q: '¿Qué incluye exactamente el Race Pass?',
      a: 'El Race Pass te da acceso VIP a nuestras predicciones avanzadas, el ranking exclusivo con premios especiales y estadísticas detalladas para un único Gran Premio de tu elección.'
    },
    {
      q: '¿Puedo cambiar de Race Pass a Season Pass más tarde?',
      a: '¡Claro! Puedes hacer el upgrade en cualquier momento. Pagarás solo la diferencia y todos los puntos que hayas acumulado en tu ranking se mantendrán.'
    },
    {
      q: '¿Qué tan seguro es el proceso de pago?',
      a: 'Utilizamos Bold Checkout, una pasarela de pagos líder que cumple con los más altos estándares de seguridad, incluyendo cifrado TLS 1.2. Tu información de pago nunca toca nuestros servidores.'
    },
    {
      q: '¿Cuál es la política de reembolso?',
      a: 'Ofrecemos una garantía de satisfacción. Tienes 7 días para solicitar un reembolso completo, siempre y cuando no se haya disputado ningún Gran Premio desde el momento de tu compra.'
    }
  ];

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const formatCountdown = (c: typeof qualyCountdown) => {
    const d = String(Math.max(0, c.days)).padStart(2, '0');
    const h = String(Math.max(0, c.hours)).padStart(2, '0');
    const m = String(Math.max(0, c.minutes)).padStart(2, '0');
    const s = String(Math.max(0, c.seconds)).padStart(2, '0');
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  // ============================================================================
  // ENHANCED FACEBOOK TRACKING FUNCTIONS
  // ============================================================================

  // 1. Enhanced Page Load Tracking
  useEffect(() => {
    const pageViewEventId = generateEventId();
    
    trackFBEvent('PageView', {
      params: {
        content_category: 'vip_sales_funnel',
        content_name: 'Fantasy F1 VIP Sales Letter Landing',
        page_type: 'video_sales_letter',
        funnel_stage: 'awareness',
        content_format: 'vsl_page',
        source: 'organic',
        medium: 'web',
        campaign: 'vip_acquisition_2025'
      },
      event_id: pageViewEventId
    });

    fetch('/api/fb-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'PageView',
        event_id: pageViewEventId,
        event_source_url: window.location.href,
        user_data: getUserData(user),
        custom_data: {
          content_category: 'vip_sales_funnel',
          page_type: 'video_sales_letter',
          funnel_stage: 'awareness'
        }
      })
    }).catch(err => console.error('CAPI PageView error:', err));
  }, [user]);

  // 2. Enhanced Video Engagement Tracking - USING CUSTOM EVENTS
const handleWatchProgress = (percentage: number) => {
  setWatchPercentage(percentage);

  // 🎯 STEP 1: Track Analytics (Database) - THIS WAS MISSING!
  // This sends data to your analytics API and Supabase
  trackVideoProgress(percentage, {
    page_type: 'vip_landing',
    video_source: 'vsl',
    user_type: isSignedIn ? 'authenticated' : 'anonymous',
    session_id: sessionId,
    timestamp: Date.now()
  });

  // 🎯 STEP 2: Track Facebook Events (Meta Pixel & CAPI)
  const milestones = [
    { percent: 25, eventName: 'VIP_VideoEngagement_25' },
    { percent: 50, eventName: 'VIP_VideoEngagement_50' },
    { percent: 75, eventName: 'VIP_VideoEngagement_75' },
    { percent: 100, eventName: 'VIP_VideoEngagement_Complete' }
  ];

  const currentMilestone = milestones.find(m =>
    percentage >= m.percent && !videoEngagementTracked.has(m.percent)
  );

  if (currentMilestone) {
    setVideoEngagementTracked(prev => new Set([...prev, currentMilestone.percent]));

    const eventId = generateEventId();
    
    // Track Facebook custom event
    trackFBEvent(currentMilestone.eventName, {
      params: {
        content_type: 'video',
        content_category: 'vsl_engagement',
        content_name: 'Fantasy VIP Video Sales Letter',
        content_ids: ['vip_vsl_2025'],
        video_title: 'Fantasy VIP Access Reveal',
        video_length: 300,
        video_percentage: currentMilestone.percent,
        engagement_level: currentMilestone.percent >= 75 ? 'high' : currentMilestone.percent >= 50 ? 'medium' : 'low',
        value: 0,
        currency: 'COP'
      },
      event_id: eventId
    });
  }

  // 🎯 STEP 3: Lead Qualification at 20%
  if (percentage >= 20 && !showUnlockButton && !hasWatchedVideo) {
    setShowUnlockButton(true);

    // Track VIP event for analytics
    trackVipEvent('lead_qualification', {
      video_percentage: 20,
      qualification_method: 'video_engagement_threshold',
      lead_quality: 'medium'
    });

    // Track Facebook Lead event
    const leadEventId = generateEventId();
    trackFBEvent('Lead', {
      params: {
        content_category: 'qualified_video_lead',
        content_name: 'VIP Access Qualified Lead - 20% Video Engagement',
        content_type: 'video_qualification',
        lead_type: 'video_qualified',
        qualification_method: 'video_engagement_threshold',
        video_percentage: 20,
        lead_quality: 'medium',
        predicted_ltv: 100,
        currency: 'COP',
        source: 'vsl_engagement'
      },
      event_id: leadEventId
    });

    toast.success('🔓 ¡Video casi completo! Acceso disponible', {
      duration: 3000,
      position: 'bottom-center'
    });
  }

  // 🎯 STEP 4: Content Unlock at 50%
  if (percentage >= 50 && !hasWatchedVideo) {
    setHasWatchedVideo(true);
    localStorage.setItem('vip_content_unlocked', 'true');
    localStorage.setItem('vip_unlock_timestamp', Date.now().toString());

    // Track VIP event for analytics
    trackVipEvent('content_unlock', {
      video_percentage: 50,
      unlock_method: 'automatic_video_threshold',
      user_intent_level: 'high'
    });

    // Track Facebook custom event
    const unlockEventId = generateEventId();
    trackFBEvent('VIP_ContentUnlock_Auto', {
      params: {
        content_category: 'sales_page_access',
        content_name: 'VIP Sales Page Auto Unlocked at 50%',
        content_type: 'gated_content',
        content_ids: ['vip_sales_access'],
        unlock_method: 'automatic_video_threshold',
        unlock_trigger: 'video_50_percent',
        video_percentage: 50,
        user_intent_level: 'high',
        value: 150,
        currency: 'COP'
      },
      event_id: unlockEventId
    });

    toast.success('🎉 ¡Acceso desbloqueado! Bienvenido a la oferta VIP', {
      duration: 4000,
      position: 'bottom-center'
    });
  }
};

  // 3. Manual Unlock - CUSTOM EVENT
  const handleManualUnlock = () => {
    setHasWatchedVideo(true);
    localStorage.setItem('vip_content_unlocked', 'true');
    localStorage.setItem('vip_unlock_timestamp', Date.now().toString());
  
    // Track VIP event for analytics
    trackVipEvent('content_unlock', {
      video_percentage: watchPercentage,
      unlock_method: 'manual_button_click',
      user_intent_level: 'very_high'
    });
  
    // Track Facebook custom event
    const eventId = generateEventId();
    trackFBEvent('VIP_ContentUnlock_Manual', {
      params: {
        content_category: 'sales_page_access',
        content_name: 'VIP Sales Page Manual Button Unlock',
        content_type: 'gated_content',
        content_ids: ['vip_sales_access'],
        unlock_method: 'manual_button_click',
        unlock_trigger: 'user_initiated',
        video_percentage: watchPercentage,
        user_intent_level: 'very_high',
        engagement_quality: 'premium',
        value: 180,
        currency: 'COP'
      },
      event_id: eventId
    });
  
    toast.success('🎉 ¡Acceso desbloqueado!', {
      duration: 4000,
      position: 'bottom-center'
    });
  };

  // 4. Plan View Tracking - CUSTOM EVENT (NOT ViewContent)
  const handlePlanView = (planId: string, planPrice: number, planName: string) => {
    if (planViewsTracked.has(planId)) return;
  
    setPlanViewsTracked(prev => new Set([...prev, planId]));
  
    // Track VIP event for analytics
    trackVipEvent('plan_view', {
      plan_id: planId,
      plan_name: planName,
      plan_price: planPrice,
      action: 'plan_card_viewed'
    });
  
    // Track Facebook custom event
    const eventId = generateEventId();
    trackFBEvent('VIP_PlanView', {
      params: {
        content_type: 'product',
        content_category: 'vip_membership_plan',
        content_name: planName,
        content_ids: [planId],
        value: planPrice / 1000,
        currency: 'COP',
        predicted_ltv: planId === 'season-pass' ? 300 : 150,
        product_type: planId === 'season-pass' ? 'premium_annual' : 'entry_single',
        discount_applied: planId === 'season-pass' ? 'yes' : 'no',
        discount_percentage: planId === 'season-pass' ? 40 : 0
      },
      event_id: eventId
    });
  };

  // 5. Enhanced Purchase Function - InitiateCheckout is correct
  const handlePurchase = async (planId: Plan['id']) => {
    console.log('🛒 handlePurchase invocado para:', planId);
    const plan = planes.find(p => p.id === planId);
    if (!plan) return;
  
    // Track VIP event for analytics
    trackVipEvent('checkout_initiated', {
      plan_id: planId,
      plan_name: plan.nombre,
      plan_price: plan.precio,
      action: 'purchase_button_clicked'
    });
  
    // 🎯 TRACK INITIATE CHECKOUT IMMEDIATELY
    const eventId = generateEventId();
  
    trackFBEvent('InitiateCheckout', {
      params: {
        content_type: 'product',
        content_category: 'vip_membership',
        content_name: plan.nombre,
        content_ids: [planId],
        value: plan.precio / 1000,
        currency: 'COP',
        num_items: 1,
        predicted_ltv: planId === 'season-pass' ? 300 : 150,
        checkout_step: 1,
        payment_method_types: ['credit_card', 'debit_card', 'bank_transfer'],
        product_type: planId === 'season-pass' ? 'premium_annual' : 'entry_single',
        discount_applied: planId === 'season-pass' ? 'yes' : 'no',
        discount_percentage: planId === 'season-pass' ? 40 : 0,
        offer_type: 'limited_time_discount',
        funnel_stage: 'checkout_initiation'
      },
      event_id: eventId
    });

    // Send CAPI backup immediately
    fetch('/api/fb-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'InitiateCheckout',
        event_id: eventId,
        event_source_url: window.location.href,
        user_data: getUserData(user),
        custom_data: {
          content_ids: [planId],
          content_category: 'vip_membership',
          value: plan.precio / 1000,
          currency: 'COP',
          predicted_ltv: planId === 'season-pass' ? 300 : 150,
          discount_percentage: planId === 'season-pass' ? 40 : 0
        }
      })
    }).catch(err => console.error('CAPI InitiateCheckout error:', err));

    // Auth check - REGISTRATION REQUIRED LEAD TRACKING
    if (!isSignedIn || !user) {
      const leadEventId = generateEventId();

      trackFBEvent('Lead', {
        params: {
          content_category: 'purchase_intent_registration',
          content_name: `${plan.nombre} Purchase Intent - Registration Required`,
          content_type: 'authentication_gate',
          content_ids: [planId],
          value: plan.precio / 1000,
          currency: 'COP',
          lead_type: 'purchase_intent_registration',
          lead_quality: 'high',
          predicted_ltv: planId === 'season-pass' ? 300 : 150,
          conversion_step: 'auth_required',
          barrier_type: 'registration_required'
        },
        event_id: leadEventId
      });

      // Store intent for post-auth tracking
      sessionStorage.setItem('pendingVipPlan', planId);
      sessionStorage.setItem('pendingVipEventId', eventId);

      clerk.openSignIn({
        redirectUrl: window.location.href,
        afterSignInUrl: window.location.href
      });
      return;
    }

    // Check for pending plan after login
    const pendingPlan = sessionStorage.getItem('pendingVipPlan');
    if (pendingPlan && !planId) {
      sessionStorage.removeItem('pendingVipPlan');
      handlePurchase(pendingPlan as Plan['id']);
      return;
    }

    // Verificar apiKey de Bold
    const apiKey = process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY;
    if (!apiKey) {
      toast.error('El sistema de pagos no está disponible temporalmente. Por favor intenta más tarde.');
      return;
    }

    try {
      setProcessingPlan(planId);

      // Crear orden en el backend
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

      // Track Payment Modal Open - Custom Event
      const paymentEventId = generateEventId();
      trackFBEvent('VIP_PaymentModal_Open', {
        params: {
          content_type: 'product',
          content_category: 'vip_membership',
          content_ids: [planId],
          value: plan.precio / 1000,
          currency: 'COP',
          checkout_step: 2,
          modal_type: 'bold_checkout',
          payment_provider: 'bold'
        },
        event_id: paymentEventId
      });

      // Configuración para Bold Checkout
      const config = {
        apiKey,
        orderId,
        amount,
        currency: 'COP',
        description: `Acceso VIP · ${plan.nombre}`,
        redirectionUrl,
        integritySignature,
        renderMode: 'embedded',
        containerId: 'bold-embed-vip',
        customerData: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress ?? '',
          fullName: user.fullName ?? '',
        }),
      };

      // Abrir Bold Checkout
      openBoldCheckout({
        ...config,
        onSuccess: async (result: any) => {
          // Track successful purchase completion
          const purchaseEventId = generateEventId();
          trackFBEvent('Purchase', {
            params: {
              content_type: 'product',
              content_category: 'vip_membership',
              content_name: plan.nombre,
              content_ids: [planId],
              value: plan.precio / 1000,
              currency: 'COP',
              transaction_id: result?.orderId || orderId,
              num_items: 1,
              order_id: orderId,
              payment_method: 'bold_checkout',
              purchase_type: planId === 'season-pass' ? 'premium_annual' : 'entry_single',
              discount_applied: planId === 'season-pass' ? 'yes' : 'no',
              discount_amount: planId === 'season-pass' ? (plan.precio * 0.4) / 1000 : 0
            },
            event_id: purchaseEventId
          });

          toast.success('✅ Pago exitoso! Redirigiendo...', { duration: 2000 });
          setProcessingPlan(null);
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
          if (processingPlan) {
            toast.info('Pago cancelado');
            setProcessingPlan(null);
          }
        },
      });

    } catch (err: any) {
      console.error('Error en handlePurchase:', err);
      toast.error(err.message || 'Error al iniciar el proceso de pago');
      setProcessingPlan(null);
    }
  };

  // 6. Post-Auth Tracking
  useEffect(() => {
    if (!isSignedIn || !user) return;

    const pendingPlan = sessionStorage.getItem('pendingVipPlan');
    const pendingEventId = sessionStorage.getItem('pendingVipEventId');

    if (pendingPlan) {
      trackFBEvent('CompleteRegistration', {
        params: {
          content_category: 'vip_user_registration',
          content_name: `User Registration Completed for ${pendingPlan}`,
          registration_method: 'clerk_oauth',
          registration_source: 'purchase_flow',
          intended_purchase: pendingPlan,
          registration_step: 'completed',
          user_type: 'new_vip_member',
          predicted_ltv: pendingPlan === 'season-pass' ? 300 : 150,
          currency: 'COP'
        },
        email: user.primaryEmailAddress?.emailAddress,
        event_id: `registration_${pendingEventId || generateEventId()}`
      });

      // Clean up
      sessionStorage.removeItem('pendingVipPlan');
      sessionStorage.removeItem('pendingVipEventId');

      // Auto-trigger purchase after small delay
      const timer = setTimeout(() => {
        const button = document.querySelector(`[data-plan-id="${pendingPlan}"]`);
        if (button) {
          (button as HTMLButtonElement).click();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isSignedIn, user]);

  // ============================================================================
  // ADDITIONAL EFFECTS
  // ============================================================================

  // Check for existing unlock state
  useEffect(() => {
    const hasUnlocked = localStorage.getItem('vip_content_unlocked') === 'true';
    if (hasUnlocked) {
      setHasWatchedVideo(true);
      setShowUnlockButton(false);
    }
  }, []);

  // Scroll depth tracking - CUSTOM EVENT
  useEffect(() => {
    const handleScroll = () => {
      const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      
      if (scrollDepth >= 75 && !sessionStorage.getItem('scroll_75_tracked')) {
        sessionStorage.setItem('scroll_75_tracked', 'true');
        
        trackFBEvent('VIP_DeepScroll', {
          params: {
            content_category: 'page_engagement',
            content_name: 'Deep Page Scroll Engagement',
            content_type: 'page_interaction',
            engagement_type: 'scroll_depth',
            scroll_percentage: scrollDepth,
            engagement_quality: 'high'
          }
        });
      }
    };

    if (hasWatchedVideo) {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [hasWatchedVideo]);

  // Sticky button observer
  useEffect(() => {
    const planesEl = document.getElementById('planes');
    if (!planesEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { rootMargin: '0px 0px -100px 0px' }
    );
    observer.observe(planesEl);
    return () => observer.disconnect();
  }, []);

  // Load GP schedule
  useEffect(() => {
    supabase
      .from('gp_schedule')
      .select('gp_name, qualy_time, race_time')
      .order('race_time', { ascending: true })
      .then(({ data }) => data && setGpSchedule(data as GpSchedule[]));
  }, []);

  // Countdown logic
  useEffect(() => {
    if (!gpSchedule.length) return;

    const now = Date.now();
    let idx = gpSchedule.findIndex(g => new Date(g.race_time).getTime() > now);
    if (idx === -1) idx = gpSchedule.length - 1;
    setCurrentGp(gpSchedule[idx]);

    const tick = () => {
      if (!currentGp) return;
      const now2 = Date.now();
      const qDiff = new Date(currentGp.qualy_time).getTime() - now2;
      const rDiff = new Date(currentGp.race_time).getTime() - now2;

      setQualyCountdown({
        days: Math.floor(qDiff / 86400000),
        hours: Math.floor((qDiff % 86400000) / 3600000),
        minutes: Math.floor((qDiff % 3600000) / 60000),
        seconds: Math.floor((qDiff % 60000) / 1000),
      });
      setRaceCountdown({
        days: Math.floor(rDiff / 86400000),
        hours: Math.floor((rDiff % 86400000) / 3600000),
        minutes: Math.floor((rDiff % 3600000) / 60000),
        seconds: Math.floor((rDiff % 60000) / 1000),
      });
    };

    tick();
    const countdownInterval = setInterval(tick, 1000);
    const toggleInterval = setInterval(() => {
      setShowQualy(prev => !prev);
    }, 5000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(toggleInterval);
    };
  }, [gpSchedule, currentGp]);

  // ============================================================================
  // UI COMPONENTS
  // ============================================================================

  // Progress indicator component
  const VideoProgressIndicator = () => (
    <div className="mb-4 bg-black/80 backdrop-blur-sm border border-amber-500/40 rounded-lg p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-amber-300 text-sm font-semibold">Progreso del Video</span>
        <span className="text-amber-300 text-sm font-bold">{watchPercentage}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div
          className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${watchPercentage}%` }}
        ></div>
      </div>
      <p className="text-amber-300 text-xs text-center">
        {watchPercentage < 20
          ? `📊 ${20 - watchPercentage}% más para acceder a la oferta VIP`
          : watchPercentage < 50
            ? '🔓 ¡Ya puedes acceder! Haz clic abajo o sigue viendo'
            : '🎉 ¡Acceso completo desbloqueado!'
        }
      </p>
    </div>
  );

  // Unlock button component
  const UnlockButton = () => {
    if (!showUnlockButton) return null;

    return (
      <div className="mt-6 text-center">
        <button
          onClick={handleManualUnlock}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-8 py-4 rounded-xl text-lg shadow-xl hover:brightness-110 transition-all transform hover:scale-105 active:scale-95 animate-pulse"
        >
          🔓 DESBLOQUEAR CONTENIDO
        </button>
        <p className="text-gray-400 text-xs mt-2">
          O continúa viendo para desbloqueo automático al 50%
        </p>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <>
      {/* Bold Checkout Container */}
      {processingPlan && (
        <div
          id="bold-embed-vip"
          data-bold-embed
          className="fixed inset-0 z-[100] pointer-events-none"
        >
          <style>{`
            #bold-embed-vip > * {
              pointer-events: auto !important;
            }
          `}</style>
        </div>
      )}
  
      <MovingBarFantasy />
  
      {/* Urgency Banner - Only show if video is unlocked */}
      {hasWatchedVideo && (
        <div className="fixed top-8 left-0 w-full z-[55] bg-gradient-to-r from-red-600 to-red-500 text-white text-center py-2 px-4 overflow-hidden shadow-lg">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          <div className="relative z-10 flex items-center justify-center gap-2 text-sm font-bold">
            <span>40% DE DESCUENTO EN TU PASE VIP</span>
          </div>
        </div>
      )}
  
      {/* Background decorativo */}
      <div className="min-h-screen bg-neutral-950 text-gray-200 font-sans">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem]
                       bg-[radial-gradient(circle_at_center,_rgba(251,146,60,0.15),transparent_40%)]
                       animate-[spin_20s_linear_infinite]"
          />
          <div
            className="absolute bottom-[-30%] right-[-20%] w-[60rem] h-[60rem]
                       bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.15),transparent_45%)]
                       animate-[spin_25s_linear_infinite_reverse]"
          />
        </div>
  
        <main className="relative z-10">
          {/* HERO SECTION */}
          <section className="relative py-8 sm:py-12 lg:py-16 px-4 sm:px-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-transparent to-orange-900/10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,107,0.1),transparent_50%)]" />
  
            <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start lg:items-center">
              {/* First Column (Headline) */}
              <div className="space-y-6 text-center lg:text-left">
                {/* Social Proof Badge */}
                <motion.div
                  className="inline-flex items-center gap-2 bg-green-500/20 border border-green-400/40 rounded-full px-5 py-2.5 text-green-300 text-sm font-semibold shadow-lg backdrop-blur-sm"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="relative w-2 h-2">
                    <span className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
                    <span className="relative block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  </div>
                  +2,847 miembros VIP activos en Latinoamérica
                </motion.div>
  
                {/* Headline */}
                <motion.h1
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7 }}
                >
                  <span className="block text-white drop-shadow-lg">
                    Existe una forma secreta de ir a la F1 sin pagar.
                  </span>
                  <span className="block bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 drop-shadow-lg">
                    Esta activa ahora mismo!
                  </span>
                </motion.h1>

  
                {/* Subheadline */}
                <motion.h2
                  className="mt-4 text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold leading-snug text-white/90"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.15 }}
                >
                  Descubre en el video cómo fans comunes están consiguiendo acceso VIP a la F1 —
                  sin invitaciones y sin gastar miles de dólares.
                </motion.h2>
  
                {/* Countdown - Only show if unlocked */}
                {hasWatchedVideo && currentGp && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="w-80 mx-auto sm:mx-0 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-lg shadow-md px-4 py-3 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      <span className="text-xs font-semibold tracking-wide text-gray-200 truncate">
                        {currentGp.gp_name}
                      </span>
                    </div>
  
                    <div className="h-px w-full bg-white/10" />
  
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300 inline-block min-w-[108px] text-center">
                        {showQualy ? 'Clasificación en' : 'Carrera en'}
                      </span>
  
                      <div className="flex items-center gap-1 font-mono text-white">
                        {[
                          { v: (showQualy ? qualyCountdown : raceCountdown).days, l: 'd' },
                          { v: (showQualy ? qualyCountdown : raceCountdown).hours, l: 'h' },
                          { v: (showQualy ? qualyCountdown : raceCountdown).minutes, l: 'm' },
                          { v: (showQualy ? qualyCountdown : raceCountdown).seconds, l: 's' },
                        ].map((t, i) => (
                          <React.Fragment key={t.l}>
                            <span className="tabular-nums text-base font-bold">
                              {String(t.v).padStart(2, '0')}
                              <span className="text-[10px] ml-0.5 text-gray-400">{t.l}</span>
                            </span>
                            {i < 3 && <span className="text-base text-gray-500">:</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
  
              {/* Second Column (Video + CTA) */}
              <div className="flex flex-col items-center lg:items-start space-y-6">
                {/* Video Progress - Show only when video is locked */}
                {!hasWatchedVideo && <VideoProgressIndicator />}
  
                {/* Video */}
                <motion.div
                  className="w-full max-w-md mx-auto lg:mx-0"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                >
                  <VideoPlayer onWatchProgress={handleWatchProgress} />
                </motion.div>
  
                {/* Show unlock button OR regular CTA */}
                {!hasWatchedVideo ? (
                  <UnlockButton />
                ) : (
                  <StickyAccessCTA />
                )}
              </div>
            </div>
          </section>
  
          {/* REST OF CONTENT - Only show if video has been watched */}
          {hasWatchedVideo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {/* Premios VIP 2025 */}
              <section className="relative py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-900 to-neutral-950 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08),transparent_70%)]" />
                <div className="absolute top-0 left-1/3 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl" />
  
                <div className="relative max-w-6xl mx-auto">
                  <div className="grid gap-6 lg:gap-8 md:grid-cols-1">
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                      viewport={{ once: true }}
                      className="group relative rounded-2xl border border-amber-500/40 bg-gradient-to-br from-neutral-800/90 to-neutral-900/70 p-6 backdrop-blur-sm hover:border-amber-500/60 transition-all duration-300 hover:transform hover:scale-105"
                    >
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/30 to-orange-500/30 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
  
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-red-400">
                        🏆 Compite y gana
                      </span>
  
                      <div className="relative pt-4">
                        <div className="text-center mb-6">
                          <div className="text-3xl font-black text-amber-400 mb-2">Viaje VIP F1 2026</div>
                          <div className="text-amber-300 text-sm font-semibold">Valor: $20,000+ USD</div>
                        </div>
  
                        <div className="space-y-3 mb-6">
                          <div className="flex items-center gap-3 text-gray-300 text-sm">
                            <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                            <span><strong className="text-white">Top 2 del ranking anual</strong> ganan automáticamente</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-300 text-sm">
                            <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                            <span><strong className="text-white">1 ganador aleatorio</strong> entre todos los VIP</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-300 text-sm">
                            <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                            <span>Vuelos y estadía incluidos</span>
                          </div>
                        </div>
  
                        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-3 text-center">
                          <p className="text-amber-300 text-xs font-semibold">
                            ✈️ 3 ganadores en total!
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
  
                <motion.div
                  className="mt-8 text-center"
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  viewport={{ once: true }}
                >
                  <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-full px-4 py-2 text-red-400 text-sm font-medium">
                    <span className="animate-ping w-2 h-2 bg-red-400 rounded-full"></span>
                    Atención: Los cupos con descuento son limitados
                  </div>
                </motion.div>
              </section>
  
              {/* How It Works Section */}
              <section className="relative py-auto sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 to-neutral-900 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.04),transparent_70%)]" />
                <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl" />
  
                <div className="relative max-w-4xl mx-auto">
                  <motion.div
                    className="text-center mb-12"
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                  >
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 bg-gradient-to-r from-amber-400 via-orange-500 to-red-400 bg-clip-text text-transparent drop-shadow-lg">
                      Compite en 4 Simples Pasos
                    </h2>
                  </motion.div>
  
                  <div className="grid grid-cols-2 gap-6 md:gap-8 lg:grid-cols-4 text-center">
                    {[
                      {
                        icon: '📱',
                        title: 'Únete al VIP',
                        text: 'Elige tu plan y obtén acceso instantáneo a la plataforma.',
                        color: 'from-blue-500/20 to-cyan-500/20',
                        border: 'border-blue-500/30'
                      },
                      {
                        icon: '✍️',
                        title: 'Haz tus Predicciones',
                        text: 'Antes de cada carrera, envía tus pronósticos estratégicos.',
                        color: 'from-purple-500/20 to-pink-500/20',
                        border: 'border-purple-500/30'
                      },
                      {
                        icon: '🏁',
                        title: 'Suma Puntos',
                        text: 'Gana puntos según la precisión de tus predicciones.',
                        color: 'from-green-500/20 to-emerald-500/20',
                        border: 'border-green-500/30'
                      },
                      {
                        icon: '🏆',
                        title: 'Compite por un viaje a la F1',
                        text: 'Los mejores del ranking ganan un viaje a la F1 todo pago',
                        color: 'from-amber-500/20 to-orange-500/20',
                        border: 'border-amber-500/30'
                      },
                    ].map((item, index) => (
                      <motion.div
                        key={index}
                        className={`group relative p-6 bg-gradient-to-br from-neutral-800/80 to-neutral-900/60 rounded-2xl border ${item.border} backdrop-blur-sm hover:border-opacity-60 transition-all duration-300 hover:transform hover:scale-105`}
                        initial={{ y: 30, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        viewport={{ once: true }}
                      >
                        <div className={`absolute -inset-0.5 bg-gradient-to-r ${item.color} rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
  
                        <span className="absolute -top-3 -left-3 w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-bold rounded-full flex items-center justify-center shadow-lg">
                          {index + 1}
                        </span>
  
                        <div className="relative">
                          <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                            {item.icon}
                          </div>
                          <h3 className="font-bold text-white mb-3 text-lg">{item.title}</h3>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {item.text}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </section>
  
              {/* PredictionsTeaser */}
              <PredictionsTeaser />
  
              {/* PRICING PLANS */}
              <section id="planes" className="py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-900 to-neutral-950">
                <div className="max-w-5xl mx-auto">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    viewport={{ once: true }}
                    className="text-center mb-10 sm:mb-14"
                  >
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                      Elige Tu Pase de Acceso VIP
                    </h2>
                    <p className="mt-3 sm:mt-4 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
                      <strong className="text-white">Oferta por Tiempo Limitado:</strong> Ahorra hasta un 40% y asegura tu lugar.
                    </p>
                  </motion.div>
  
                  {/* Countdown dinámico */}
                  {currentGp && (
                    <div className="relative group bg-gradient-to-b from-blue-800 to-sky-600 p-4 rounded-xl shadow-lg flex flex-col justify-between overflow-hidden mb-8">
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="h-4 w-4 text-white/80" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                          <h2 className="text-sm font-semibold text-white truncate">
                            {currentGp.gp_name}
                          </h2>
                        </div>
                        <div className="flex flex-col items-center my-2">
                          <p className="text-[10px] uppercase text-white/70 mb-1">
                            {showQualy ? 'Tiempo para Qualy' : 'Tiempo para Carrera'}
                          </p>
                          <AnimatePresence mode="wait">
                            <motion.p
                              key={showQualy ? 'qualy' : 'race'}
                              className="font-mono text-2xl text-white font-bold"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.3 }}
                            >
                              {formatCountdown(showQualy ? qualyCountdown : raceCountdown)}
                            </motion.p>
                          </AnimatePresence>
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[10px] text-white/80">
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
                          </svg>
                          <span>
                            Carrera:{' '}
                            {new Date(currentGp.race_time).toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
  
                  {/* Trust Indicators */}
                  <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        ))}
                      </div>
                      <span className="text-gray-400 text-sm">4.9/5 (2,847 usuarios)</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                      🔒 Pago seguro • 💳 Garantía de devolución
                    </p>
                  </div>
  
                  {/* Pricing Cards */}
                  <div className="flex flex-col md:grid md:grid-cols-2 gap-6 mt-auto">
                    {planes.map((plan, i) => (
                      <motion.div
                        key={plan.id}
                        ref={(el) => {
                          if (el && hasWatchedVideo) {
                            const observer = new IntersectionObserver(
                              ([entry]) => {
                                if (entry.isIntersecting) {
                                  handlePlanView(plan.id, plan.precio, plan.nombre);
                                }
                              },
                              { threshold: 0.5 }
                            );
                            observer.observe(el);
                            return () => observer.disconnect();
                          }
                        }}
                        initial={{ y: 30, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
                        viewport={{ once: true, amount: 0.3 }}
                        className={`relative p-6 sm:p-8 rounded-2xl ring-1 bg-neutral-900/60 backdrop-blur-lg transition-all duration-300 hover:ring-white/20 hover:scale-[1.03] ${
                          plan.isPopular
                            ? 'border-2 border-amber-500 ring-2 ring-amber-500/30'
                            : 'border border-neutral-700'
                        }`}
                        onMouseEnter={() => {
                          if (hasWatchedVideo) {
                            trackFBEvent('VIP_PlanHover', {
                              params: {
                                content_type: 'product',
                                content_ids: [plan.id],
                                content_name: plan.nombre,
                                value: plan.precio / 1000,
                                currency: 'COP',
                                action: 'plan_hover'
                              }
                            });
                          }
                        }}
                      >
                        {plan.isPopular && (
                          <>
                            <div className="absolute top-0 right-4 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-bold rounded-full uppercase tracking-wide shadow-lg">
                              MÁS VALIOSO
                            </div>
                            <div className="absolute top-0 left-4 -translate-y-1/2 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full uppercase tracking-wide shadow-lg">
                              AHORRA 40%
                            </div>
                          </>
                        )}
  
                        <div className="flex flex-col h-full">
                          <h3 className="text-xl sm:text-2xl font-bold text-white">{plan.nombre}</h3>
  
                          <div className="my-5">
                            <div className="flex items-baseline gap-2 mb-2">
                              <span className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
                                {formatCOP(plan.precio)}
                              </span>
                              {plan.isPopular && (
                                <span className="text-lg text-gray-500 line-through">
                                  {formatCOP(Math.round(plan.precio * 1.66))}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs sm:text-sm mt-1">
                              {plan.periodo}
                            </p>
                          </div>
  
                          <ul className="space-y-3 sm:space-y-4 mb-6 text-sm">
                            {plan.beneficios.map((b) => (
                              <li key={b} className="flex items-start gap-3 text-gray-300">
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
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: b
                                      .replace('Top 2 del ranking', '<strong>Top 2 del ranking</strong>')
                                      .replace('3 ganadores aleatorios', '<strong>3 ganadores aleatorios</strong>'),
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
  
                          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                            <p className="text-green-400 text-xs font-semibold">
                              💡{' '}
                              {plan.isPopular
                                ? 'Acceso a TODO, máximo potencial de ganancias.'
                                : 'Ideal para probar y empezar a ganar.'}
                            </p>
                          </div>
  
                          {plan.id === 'race-pass' && currentGp && (
                            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                              <p className="text-blue-400 text-xs font-semibold text-center">
                                ✓ Válido para: {currentGp.gp_name}
                              </p>
                            </div>
                          )}
  
                          <div className="mt-auto">
                            <button
                              onClick={() => handlePurchase(plan.id)}
                              data-plan-id={plan.id}
                              disabled={processingPlan === plan.id}
                              className={`w-full py-4 rounded-xl font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-2 shadow-2xl ${
                                plan.isPopular
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110 animate-pulse'
                                  : 'bg-gradient-to-r from-gray-700 to-gray-600 text-white hover:from-gray-600 hover:to-gray-500'
                              } ${processingPlan === plan.id ? 'opacity-60 cursor-wait' : ''}`}
                            >
                              {processingPlan === plan.id ? (
                                <>
                                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
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
                                '🔥 QUIERO EL SEASON PASS'
                              ) : (
                                `Obtener ${plan.nombre}`
                              )}
                              {!processingPlan && (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </section>
  
              {/* Free Play Section */}
              <section className="py-12 sm:py-16 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 to-neutral-900">
                <div className="max-w-2xl mx-auto text-center">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="space-y-6"
                  >
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                      ¿No estás listo para competir?
                    </h2>
  
                    <p className="text-gray-400 text-lg max-w-xl mx-auto">
                      Prueba nuestra experiencia gratuita y familiarízate con el juego antes de unirte al club VIP.
                    </p>
  
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                      viewport={{ once: true }}
                    >
                      <a
                        href="/fantasy"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white font-bold rounded-xl text-lg shadow-xl transition-all transform hover:scale-105 active:scale-95"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Jugar Gratis
                      </a>
                    </motion.div>
  
                    <p className="text-gray-500 text-sm">
                      Sin tarjeta de crédito • Sin compromisos
                    </p>
                  </motion.div>
                </div>
              </section>
  
              {/* Telegram Link */}
              <div className="mt-12 text-center">
                <a
                  href="https://t.me/+573009290499"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-lg transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0C5.371 0 0 5.371 0 12c0 6.628 5.371 12 12 12s12-5.372 12-12C24 5.371 18.629 0 12 0zm5.363 8.55l-1.482 7.06c-.112.54-.4.676-.81.423l-2.25-1.66-1.084 1.043c-.12.12-.22.22-.45.22l.162-2.283 4.152-3.758c.18-.16 0-.25-.28-.09l-5.13 3.227-2.21-.69c-.48-.15-.49-.48.1-.71l8.64-3.33c.4-.15.75.09.62.68z" />
                  </svg>
                  <span>Dudas? Telegram Oficial</span>
                </a>
              </div>
  
              {/* Testimonial Section */}
              <section className="relative py-12 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 to-neutral-900 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.05),transparent_70%)]" />
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
  
                <div className="relative max-w-4xl mx-auto">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="text-center"
                  >
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-3 bg-gradient-to-r from-amber-400 via-orange-500 to-red-400 bg-clip-text text-transparent drop-shadow-lg">
                      Vive la F1 como nunca antes
                    </h2>
                    <p className="text-gray-300 text-lg lg:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
                      Latinoamérica ya vive la adrenalina de <strong className="text-amber-400">predecir,
                      sumar puntos y liderar el ranking</strong>
                    </p>
  
                    <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                      {[
                        { name: 'Juan Carlos', location: 'Medellín', country: 'Colombia', initials: 'JC', quote: 'Nunca había vivido una carrera con tanta emoción.' },
                        { name: 'María Rodríguez', location: 'Monterrey', country: 'México', initials: 'MR', quote: 'Competir contra otros y ver la tabla en vivo es adictivo' },
                        { name: 'Franco Suarez', location: 'Buenos Aires', country: 'Argentina', initials: 'AL', quote: 'Rompiendola, ese viaje es mio' }
                      ].map((testimonial, index) => (
                        <motion.div
                          key={index}
                          className="group relative rounded-2xl border border-amber-500/30 bg-gradient-to-br from-neutral-800/80 to-neutral-900/60 p-6 backdrop-blur-sm hover:border-amber-500/50 transition-all duration-300 hover:transform hover:scale-105"
                          initial={{ y: 20, opacity: 0 }}
                          whileInView={{ y: 0, opacity: 1 }}
                          transition={{ duration: 0.6, delay: index * 0.1 }}
                          viewport={{ once: true }}
                        >
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
  
                          <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-amber-300">
                            {testimonial.country}
                          </span>
  
                          <div className="relative">
                            <div className="flex items-center gap-3 mb-4 pt-4">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-bold text-black shadow-lg">
                                {testimonial.initials}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{testimonial.name}</p>
                                <p className="text-sm text-gray-400 flex items-center gap-1">
                                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                  {testimonial.location}
                                </p>
                              </div>
                            </div>
                            <p className="text-gray-300 text-sm italic mb-4 leading-relaxed">
                              "{testimonial.quote}"
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </section>
  
              {/* FAQ */}
              <section className="py-16 sm:py-20 px-4 sm:px-6 bg-neutral-950">
                <div className="max-w-4xl mx-auto">
                  <motion.h2
                    className="text-center text-2xl sm:text-3xl font-black mb-10 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                  >
                    Preguntas Frecuentes
                  </motion.h2>
  
                  <div className="space-y-6">
                    {faqData.map((faq, index) => (
                      <details key={index} className="group bg-neutral-900/60 p-6 rounded-xl ring-1 ring-white/5">
                        <summary className="flex cursor-pointer items-center justify-between font-medium text-white">
                          <span>{faq.q}</span>
                          <svg
                            className="w-5 h-5 transition-transform duration-200 group-open:rotate-180"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <p className="mt-4 text-gray-300 text-sm">
                          {faq.a}
                        </p>
                      </details>
                    ))}
  
                    {/* Additional FAQ items */}
                    <details className="group bg-neutral-900/60 p-6 rounded-xl ring-1 ring-white/5">
                      <summary className="flex cursor-pointer items-center justify-between font-medium text-white">
                        <span>¿Cómo envío mis predicciones?</span>
                        <svg
                          className="w-5 h-5 transition-transform duration-200 group-open:rotate-180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="mt-4 text-gray-300 text-sm">
                        A través de nuestro panel web o app móvil. Solo selecciona tus pronósticos antes del inicio de cada sesión de clasificación.
                      </p>
                    </details>
  
                    <details className="group bg-neutral-900/60 p-6 rounded-xl ring-1 ring-white/5">
                      <summary className="flex cursor-pointer items-center justify-between font-medium text-white">
                        <span>¿Contra quién compito?</span>
                        <svg
                          className="w-5 h-5 transition-transform duration-200 group-open:rotate-180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="mt-4 text-gray-300 text-sm">
                        Contra todos los miembros VIP. Hay rankings por carrera y ranking general de temporada.
                      </p>
                    </details>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </main>
      </div>
  
      {/* Telegram Support Button - Only show if unlocked */}
      {hasWatchedVideo && (
        <a
          href="https://t.me/+573009290499"
          target="_blank"
          rel="noopener noreferrer"
          title="Soporte 24/7"
          aria-label="Soporte 24/7"
          className="fixed bottom-32 right-4 z-50 bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center"
        >
          <span className="absolute -top-2 -right-2 bg-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            24/7
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 0C5.371 0 0 5.371 0 12c0 6.628 5.371 12 12 12s12-5.372 12-12C24 5.371 18.629 0 12 0zm5.363 8.55l-1.482 7.06c-.112.54-.4.676-.81.423l-2.25-1.66-1.084 1.043c-.12.12-.22.22-.45.22l.162-2.283 4.152-3.758c.18-.16 0-.25-.28-.09l-5.13 3.227-2.21-.69c-.48-.15-.49-.48.1-.71l8.64-3.33c.4-.15.75.09.62.68z" />
          </svg>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            Soporte
          </span>
        </a>
      )}
    </>
  );
}