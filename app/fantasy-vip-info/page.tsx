// /app/fantasy-vip-info/page.tsx
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence }   from 'framer-motion';
import { Disclosure }                from '@headlessui/react';
import Image                         from 'next/image';
import { useUser, useAuth }          from '@clerk/nextjs';
import { useRouter }                 from 'next/navigation';
import { toast }                     from 'sonner';

import {
  PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon,
  ForwardIcon, ChevronUpIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

import { createClient }   from '@supabase/supabase-js';
import { openBoldCheckout } from '@/lib/bold';           
import MovingBarFantasy     from '@/components/MovingBarFantasy';
import LoadingAnimation     from '@/components/LoadingAnimation';
import StickyAccessCTA from '@/components/StickyAccessCTA';

/* ──────────────────────────────────────────────────────────
   0. SUPABASE (para el teaser de resultados y el countdown)
   ────────────────────────────────────────────────────────── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ╔════════════════════════════════╗
   ║ 0-B. COLORES & UTILIDADES      ║
   ╚════════════════════════════════╝ */
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

/* ╔════════════════════════════════╗
   ║ 1. VIDEO PLAYER COMPONENT      ║
   ╚════════════════════════════════╝ */
function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeControlRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setHasError(false);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    const handleVolumeChangeEvent = () => {
      setIsMuted(video.muted || video.volume === 0);
      setVolume(video.volume);
    };
    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('volumechange', handleVolumeChangeEvent);
    video.addEventListener('error', handleError);

    video.muted = true;
    video.volume = volume;
    video.load();

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('volumechange', handleVolumeChangeEvent);
      video.removeEventListener('error', handleError);
    };
  }, [isMounted, volume]);

  const togglePlay = () => {
    if (hasError) return;
    const video = videoRef.current;
    if (video) {
      video.paused ? video.play() : video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      if (!video.muted && video.volume === 0) {
        video.volume = 0.8;
      }
    }
  };

  const handleVolumeChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
      video.muted = newVolume === 0;
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (hasError) return;
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasError) return;
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (video && bar) {
      const rect = bar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      video.currentTime = pos * video.duration;
    }
  };

  const retryVideo = () => {
    setHasError(false);
    setIsLoading(true);
    videoRef.current?.load();
  };

  // Antes de montar el video, muestra un loader con el mismo ancho
  if (!isMounted) {
    return (
      <div className="w-full max-w-md aspect-[9/16] bg-black/30 rounded-2xl flex items-center justify-center mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden shadow-2xl bg-black group mx-auto">
        {/* GIF cover de fondo: solo mientras isLoading sea true */}
        <div
          className={`
            absolute inset-0 bg-center bg-cover z-10 pointer-events-none
            transition-opacity duration-500
            ${isLoading ? 'opacity-100' : 'opacity-0'}
          `}
          style={{ backgroundImage: "url('/videos/vsl-cover.gif')" }}
        />

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-20 transition-opacity duration-300"
          style={{ opacity: isLoading || hasError ? 0 : 1 }}
          loop
          playsInline
          preload="auto"
          onClick={togglePlay}
          onCanPlay={() => setIsLoading(false)}  // marca listo cuando el video puede reproducir
          poster="/videos/vsl-cover.gif"
        >
          <source src="/videos/fantasyvip-vsl.mp4" type="video/mp4" />
        </video>

        <AnimatePresence>
          {(isLoading || hasError) && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {hasError ? (
                <div className="text-center p-6">
                  <ExclamationTriangleIcon className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                  <p className="text-white font-medium mb-2">Error de Video</p>
                  <p className="text-gray-300 text-sm mb-4">Verifica tu conexión y reintenta.</p>
                  <button
                    onClick={retryVideo}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold transition-colors active:scale-95"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <div className="text-center p-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-white font-medium">Cargando Video...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isPlaying && !isLoading && !hasError && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                onClick={togglePlay}
                className="w-20 h-20 rounded-full bg-amber-500/90 flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:bg-amber-500 active:scale-100 shadow-2xl"
                aria-label="Reproducir"
              >
                <PlayIcon className="h-8 w-8 text-black ml-1" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-14 sm:pt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="px-4 pb-3">
            {/* Barra de progreso */}
            <div
              ref={progressBarRef}
              onClick={handleProgressSeek}
              className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-3 group/progress"
            >
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full relative transition-all duration-150"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-amber-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"></div>
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="p-2" aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
                  {isPlaying ? (
                    <PauseIcon className="h-6 w-6 text-white" />
                  ) : (
                    <PlayIcon className="h-6 w-6 text-white" />
                  )}
                </button>

                <div
                  className="relative flex items-center"
                  onMouseEnter={() => setShowVolumeControl(true)}
                  onMouseLeave={() => setShowVolumeControl(false)}
                >
                  <button onClick={toggleMute} className="p-2" aria-label={isMuted ? 'Activar Sonido' : 'Silenciar'}>
                    {isMuted ? (
                      <SpeakerXMarkIcon className="h-6 w-6 text-white" />
                    ) : (
                      <SpeakerWaveIcon className="h-6 w-6 text-white" />
                    )}
                  </button>
                  <AnimatePresence>
                    {showVolumeControl && (
                      <motion.div
                        ref={volumeControlRef}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 80 }}
                        exit={{ opacity: 0, width: 0 }}
                        className="overflow-hidden ml-1"
                      >
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChangeInput}
                          className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-lg p-1">
                <ForwardIcon className="h-4 w-4 text-gray-300 mx-1" />
                {[1, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
                      playbackRate === rate ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/20'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ╔════════════════════════════════╗
   ║ 2. MINI-PANEL “PREDICE …”      ║
   ╚════════════════════════════════╝ */
type RaceResult = {
  gp_name: string | null;
  gp1: string | null;
  pole1: string | null;
  fastest_lap_driver: string | null;
  fastest_pit_stop_team: string | null;
  first_team_to_pit: string | null;
};

/* Tipo para el calendario de GPs con qualy y race */
type GpSchedule = { gp_name: string; qualy_time: string; race_time: string };

function PredictionsTeaser() {
  const [result, setResult] = useState<RaceResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // 1️⃣ CALENDARIO
        const { data: schedRaw, error: schErr } = await supabase
          .from('gp_schedule')
          .select('gp_name, race_time');

        if (schErr) throw schErr;
        const schedule = (schedRaw ?? []) as GpSchedule[];
        if (!schedule.length) throw new Error('Sin calendario');

        // 2️⃣ ÚLTIMO GP CORRIDO
        const now = Date.now();
        const prevGp = [...schedule]
          .reverse()
          .find(({ race_time }) => new Date(race_time).getTime() < now);

        if (!prevGp) throw new Error('Aún no hay GP previos');
        const raceDateStr = prevGp.race_time.split('T')[0];

        // 3️⃣ RESULTADOS
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

/* ╔════════════════════════════╗
   ║ 3. MAIN LANDING PAGE       ║
   ╚════════════════════════════════╝ */
interface Plan {
  id: 'race-pass' | 'season-pass';
  nombre: string;
  precio: number;        // COP
  periodo: string;
  beneficios: string[];
  isPopular?: boolean;
}

interface FAQ { q: string; a: string; }

export default function FantasyVipLanding() {
  /* ───────── Clerk & Router ───────── */
  const { isSignedIn, user } = useUser();
  const { getToken }         = useAuth();
  const router               = useRouter();

  // 1️⃣ Estado para mostrar/ocultar el sticky button
const [showSticky, setShowSticky] = useState(true);

// 2️⃣ Observer para la sección de paquetes
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

  /* ───────── State ───────── */
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [showSignModal, setShowSignModal]   = useState(false);

  /* ───────── Estados para el countdown ───────── */
  const [gpSchedule, setGpSchedule] = useState<GpSchedule[]>([]);
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [qualyCountdown, setQualyCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [raceCountdown, setRaceCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showQualy, setShowQualy] = useState(true);

  /* ───────── Planes ───────── */
  const planes: Plan[] = [
    {
      id: 'race-pass',
      nombre: 'Race Pass',
      precio: 2_000,
      periodo: 'por carrera',
      beneficios: [
        'Predicciones VIP para 1 GP',
        'Ranking exclusivo en vivo',
        'Compite por merch oficial',
        'Acceso al sorteo de premios en efectivo',
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

  /* ───────── FAQ ───────── */
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

  /* ───────── Helpers ───────── */
  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const formatCountdown = (c: typeof qualyCountdown) => {
    const d = String(Math.max(0, c.days)).padStart(2, '0');
    const h = String(Math.max(0, c.hours)).padStart(2, '0');
    const m = String(Math.max(0, c.minutes)).padStart(2, '0');
    const s = String(Math.max(0, c.seconds)).padStart(2, '0');
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  /* ───────── Cargar calendario de GPs ───────── */
  useEffect(() => {
    supabase
      .from('gp_schedule')
      .select('gp_name, qualy_time, race_time')
      .order('race_time', { ascending: true })
      .then(({ data }) => data && setGpSchedule(data as GpSchedule[]));
  }, []);

  /* ───────── Lógica del countdown ───────── */
  useEffect(() => {
    if (!gpSchedule.length) return;

    // Determina el próximo GP (primer GP futuro o buffer de 4h tras carrera)
    const now = Date.now();
    let idx = gpSchedule.findIndex(g => new Date(g.race_time).getTime() > now);
    if (idx === -1) idx = gpSchedule.length - 1; // Si no hay GPs futuros, usa el último
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
    const iv = setInterval(() => {
      tick();
      setShowQualy(prev => !prev); // Alterna cada 5 segundos
    }, 5000);
    return () => clearInterval(iv);
  }, [gpSchedule, currentGp]);

  /* ═════════════════════════════════════════════════
     handlePurchase → crea la orden + abre Bold embed
     ═════════════════════════════════════════════════ */
  const handlePurchase = async (planId: Plan['id']) => {
    console.log('🛒 handlePurchase invocado para:', planId);
    const plan = planes.find(p => p.id === planId);
    if (!plan) return;

    // 1️⃣ Requiere sesión
    if (!isSignedIn || !user) {
      setShowSignModal(true);
      return;
    }

    // 2️⃣ Verificar apiKey de Bold
    const apiKey = process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY;
    if (!apiKey) {
      toast.error('Pago deshabilitado: falta la apiKey de Bold.');
      return;
    }

    try {
      setProcessingPlan(planId);

      // 3️⃣ Crear orden en el backend
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
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error ?? 'Error creando orden');
      }

      // 4️⃣ Definir interface y desestructurar la respuesta
      interface ApiResp {
        orderId: string;
        amount: string;
        redirectionUrl: string;
        integritySignature: string;
      }
      const {
        orderId,
        amount,
        redirectionUrl,
        integritySignature,
      } = (await res.json()) as ApiResp;

      // 5️⃣ Montar la configuración para openBoldCheckout
      const config: Record<string, any> = {
        apiKey,
        orderId,
        amount,
        currency: 'COP',
        description: `Acceso VIP · ${plan.nombre}`,
        redirectionUrl,
        integritySignature,
        renderMode: 'embedded',
        containerId: 'bold-embed-vip',
      };

      // 6️⃣ Asegurar customerData siempre válido (nunca undefined)
      config.customerData = JSON.stringify({
        email: user.primaryEmailAddress?.emailAddress ?? '',
        fullName: user.fullName ?? '',
      });

      // 7️⃣ Abrir Bold Checkout embebido
      openBoldCheckout({
        ...config,
        onSuccess: () => {
          toast.success('✅ Pago confirmado. ¡Bienvenido a VIP!');
          setProcessingPlan(null);
          router.push('/fantasy-vip');
        },
        onFailed: ({ message }: { message?: string }) => {
          toast.error(`Pago rechazado: ${message ?? ''}`);
          setProcessingPlan(null);
        },
        onPending: () => {
          toast.info('Pago pendiente de confirmación.');
          setProcessingPlan(null);
        },
        onClose: () => setProcessingPlan(null),
      });
    } catch (err: any) {
      toast.error(err.message ?? 'Error iniciando pago');
      setProcessingPlan(null);
    }
  };

  /* ───────── Glow util ───────── */
  const Glow = () => (
    <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-400 to-red-500 opacity-0 group-hover:opacity-70 transition-opacity duration-300" />
  );

  /* ───────── Sección del countdown ───────── */
  const CountdownSection = () => {
    if (!currentGp) return null;

    const countdown = showQualy ? qualyCountdown : raceCountdown;
    const label = showQualy ? 'Qualy' : 'Carrera';

    return (
      <section className="py-10 px-4 bg-neutral-900 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          Próxima {label} en {currentGp.gp_name}
        </h2>
        <p className="text-xl text-amber-400 font-mono">
          {formatCountdown(countdown)}
        </p>
      </section>
    );
  };

/* ───────── Página VIP Fantasy – Copy alineado a oferta Race Pass / Season Pass (2025-2026) con optimizaciones ───────── */

return (
  <>
  {/* Contenedor para el embed de Bold */}
  <div id="bold-embed-vip" data-bold-embed className="fixed inset-0 z-[100] pointer-events-auto" />

    <MovingBarFantasy />

    {/* OPTIMIZATION: Urgency Banner - More prominent and specific */}
    <div className="fixed top-8 left-0 w-full z-[55] bg-gradient-to-r from-red-600 to-red-500 text-white text-center py-2 px-4 overflow-hidden shadow-lg">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative z-10 flex items-center justify-center gap-2 text-sm font-bold">
        <span className="animate-pulse">🔥</span>
        <span>ÚLTIMAS HORAS: 40% DE DESCUENTO EN TU PASE VIP</span>
        <span className="animate-pulse">🔥</span>
      </div>
    </div>

    {/* Background decorativo (No changes) */}
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

{/* ───────────── HERO OPTIMIZADO ───────────── */}
<section className="relative py-8 sm:py-12 lg:py-16 px-4 sm:px-6 overflow-hidden">
  {/* Background Enhancement */}
  <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-transparent to-orange-900/10" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,107,0.1),transparent_50%)]" />
  
  <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
    {/* 1️⃣ Headline */}
    <div className="order-1 space-y-6 text-center lg:text-left">
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
        +2,847 miembros VIP activos en Colombia
      </motion.div>

      {/* Headline */}
<motion.h1
  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight"
  initial={{ y: 30, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.7 }}
>
  <span className="block text-white drop-shadow-lg">
    Envía Tus Predicciones
  </span>
  <span className="block bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 drop-shadow-lg">
    Gana Un Viaje A La F1
  </span>
</motion.h1>

{/* 2️⃣ Video + CTA */}
<div className="order-2 flex flex-col items-center lg:items-start space-y-6">
  {/* Video */}
  <motion.div
    className="w-full max-w-md mx-auto lg:mx-0"
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.7, delay: 0.1 }}
  >
    <VideoPlayer />
  </motion.div>

  
<StickyAccessCTA />

</div>
</div>
</div>
</section>

{/* ─── Testimonial Section (Social Proof) ─── */}
<section className="relative py-12 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 to-neutral-900 overflow-hidden">
  {/* Background Elements */}
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
        El mejor fantasy de la F1
      </h2>
      <p className="text-gray-300 text-lg lg:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
        Nuestros miembros ya viven la adrenalina de <strong className="text-amber-400">predecir,
        sumar puntos y liderar el ranking</strong> antes del debut con premios.
      </p>

      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {/* Card 1 */}
        <motion.div 
          className="group relative rounded-2xl border border-amber-500/30 bg-gradient-to-br from-neutral-800/80 to-neutral-900/60 p-6 backdrop-blur-sm hover:border-amber-500/50 transition-all duration-300 hover:transform hover:scale-105"
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
        >
          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-amber-300">
            Top-20 Pretemporada
          </span>
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-4 pt-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-bold text-black shadow-lg">
                JC
              </div>
              <div>
                <p className="font-semibold text-white">Juan Carlos</p>
                <p className="text-sm text-gray-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Medellín, CO
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-sm italic mb-4 leading-relaxed">
              "Nunca había visto una carrera con tanta emoción. Mis predicciones
              suben en el ranking y ya quiero competir por premios."
            </p>
            <div className="text-amber-400 text-lg">⭐⭐⭐⭐⭐</div>
          </div>
        </motion.div>

        {/* Card 2 */}
        <motion.div 
          className="group relative rounded-2xl border border-amber-500/30 bg-gradient-to-br from-neutral-800/80 to-neutral-900/60 p-6 backdrop-blur-sm hover:border-amber-500/50 transition-all duration-300 hover:transform hover:scale-105"
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-amber-300">
            Fanática #1
          </span>
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-4 pt-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-bold text-black shadow-lg">
                MR
              </div>
              <div>
                <p className="font-semibold text-white">María Rodríguez</p>
                <p className="text-sm text-gray-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Bogotá, CO
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-sm italic mb-4 leading-relaxed">
              "Competir contra otros y ver la tabla en vivo es
              adictivo. ¡Ansiosa por los premios reales!"
            </p>
            <div className="text-amber-400 text-lg">⭐⭐⭐⭐⭐</div>
          </div>
        </motion.div>

        {/* Card 3 */}
        <motion.div 
          className="group relative rounded-2xl border border-amber-500/30 bg-gradient-to-br from-neutral-800/80 to-neutral-900/60 p-6 backdrop-blur-sm hover:border-amber-500/50 transition-all duration-300 hover:transform hover:scale-105"
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
        >
          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-amber-300">
            Season Pass
          </span>
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-4 pt-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-bold text-black shadow-lg">
                AL
              </div>
              <div>
                <p className="font-semibold text-white">Andrés López</p>
                <p className="text-sm text-gray-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Cali, CO
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-sm italic mb-4 leading-relaxed">
              "Solo por el dashboard y la comunidad ya vale la
              pena. Esto va a romperla cuando empiecen los premios."
            </p>
            <div className="text-amber-400 text-lg">⭐⭐⭐⭐⭐</div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  </div>
</section>

        {/* ─── Premios VIP 2025 (Optimized with testimonial patterns) ─── */}
<section className="relative py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-900 to-neutral-950 overflow-hidden">
  {/* Background Elements */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08),transparent_70%)]" />
  <div className="absolute top-0 left-1/3 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl" />
  <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl" />
  
  <div className="relative max-w-6xl mx-auto">
    <motion.div
      className="text-center mb-12"
      initial={{ y: 20, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 bg-gradient-to-r from-amber-400 via-orange-500 to-red-400 bg-clip-text text-transparent drop-shadow-lg">
        Un Botín de $75,000 USD te Espera
      </h2>
      <p className="text-gray-300 text-lg lg:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
        Tu membresía VIP es la llave para competir por estos premios que <strong className="text-amber-400">cambiarán tu vida</strong>.
      </p>
      
      {/* Urgency Indicator */}
      <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-full px-4 py-2 text-red-400 text-sm font-medium mb-8">
        <span className="animate-ping w-2 h-2 bg-red-400 rounded-full"></span>
        Cupos limitados con 40% de descuento
      </div>
    </motion.div>

    <div className="grid gap-6 lg:gap-8 md:grid-cols-3">
      {/* Prize Card 1 - Grand Prize */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        viewport={{ once: true }}
        className="group relative rounded-2xl border border-amber-500/40 bg-gradient-to-br from-neutral-800/90 to-neutral-900/70 p-6 backdrop-blur-sm hover:border-amber-500/60 transition-all duration-300 hover:transform hover:scale-105"
      >
        {/* Glow Effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/30 to-orange-500/30 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Badge */}
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-red-400">
          🏆 PREMIO MÁXIMO
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
              <span><strong className="text-white">1 ganador por sorteo</strong> entre todos los VIP</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
              <span>Vuelos, hotel 5⭐ y suite de hospitalidad incluidos</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-3 text-center">
            <p className="text-amber-300 text-xs font-semibold">
              ✈️ Experiencia todo pagado para 1 persona.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Prize Card 2 - Race Winnings */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        viewport={{ once: true }}
        className="group relative rounded-2xl border border-orange-500/40 bg-gradient-to-br from-neutral-800/90 to-neutral-900/70 p-6 backdrop-blur-sm hover:border-orange-500/60 transition-all duration-300 hover:transform hover:scale-105"
      >
        {/* Glow Effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/30 to-red-500/30 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Badge */}
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-orange-400">
          💰 CADA CARRERA
        </span>
        
        <div className="relative pt-4">
          <div className="text-center mb-6">
            <div className="text-3xl font-black text-orange-400 mb-2">$20,000 USD</div>
            <div className="text-orange-300 text-sm font-semibold">En premios por temporada</div>
          </div>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-gray-300 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
              <span><strong className="text-white">$500-$1,500 USD</strong> por carrera a los mejores</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
              <span>Merchandising oficial de F1 incluido</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
              <span>24 oportunidades de ganar en el año</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg p-3 text-center">
            <p className="text-orange-300 text-xs font-semibold">
              🏁 Gana dinero real cada fin de semana
            </p>
          </div>
        </div>
      </motion.div>

      {/* Prize Card 3 - Weekly Draws */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        viewport={{ once: true }}
        className="group relative rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-neutral-800/90 to-neutral-900/70 p-6 backdrop-blur-sm hover:border-cyan-500/60 transition-all duration-300 hover:transform hover:scale-105"
      >
        {/* Glow Effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Badge */}
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-cyan-400">
          🎲 SORTEOS VIP
        </span>
        
        <div className="relative pt-4">
          <div className="text-center mb-6">
            <div className="text-3xl font-black text-cyan-400 mb-2">$5,000 USD</div>
            <div className="text-cyan-300 text-sm font-semibold">En sorteos semanales</div>
          </div>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-gray-300 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
              <span><strong className="text-white">3 ganadores aleatorios</strong> cada GP</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
              <span>$200-$300 USD por ganador</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
              <span>Solo por participar, sin requisitos</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-lg p-3 text-center">
            <p className="text-cyan-300 text-xs font-semibold">
              🍀 Suerte pura, solo para miembros VIP
            </p>
          </div>
        </div>
      </motion.div>
    </div>

    {/* Final CTA Section */}
    <motion.div
      className="mt-12 text-center"
      initial={{ y: 20, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      viewport={{ once: true }}
    >
      <div className="bg-gradient-to-r from-neutral-800/80 to-neutral-900/60 border border-amber-500/30 rounded-2xl p-6 max-w-2xl mx-auto backdrop-blur-sm">
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
          ¿Listo para cambiar tu vida con F1?
        </h3>
        <p className="text-gray-300 text-sm sm:text-base mb-4">
          Más de <strong className="text-amber-400">$75,000 USD en premios</strong> esperan a los miembros VIP. 
          Tu oportunidad de ganar empieza ahora.
        </p>
        <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
          <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></span>
          <span>184 miembros VIP ya compitiendo</span>
        </div>
      </div>
    </motion.div>
  </div>

            {/* OPTIMIZATION: Urgency element - Made more specific and believable */}
            <motion.div
              className="mt-8 text-center"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-full px-4 py-2 text-red-400 text-sm font-medium">
                <span className="animate-ping w-2 h-2 bg-red-400 rounded-full"></span>
                Atención: Cupos con descuento limtiados
              </div>
            </motion.div>
        </section>
        
        {/* ─── How It Works Section (Optimized with visual enhancements) ─── */}
<section className="relative py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 to-neutral-900 overflow-hidden">
  {/* Background Elements */}
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
      <p className="text-gray-300 text-lg leading-relaxed">
        Así de fácil es <strong className="text-amber-400">empezar</strong>
      </p>
    </motion.div>
    
    <div className="grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-4 text-center">
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
          title: 'Cobra tus Premios', 
          text: 'Los mejores del ranking ganan dinero real. ¡Así de simple!',
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
          {/* Glow Effect */}
          <div className={`absolute -inset-0.5 bg-gradient-to-r ${item.color} rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          
          {/* Step Number */}
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
    
    {/* Connection Lines for Desktop */}
    <div className="hidden lg:block absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none">
      <div className="flex justify-between items-center max-w-4xl mx-auto px-24">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-16 h-0.5 bg-gradient-to-r from-amber-500/50 to-orange-500/50"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.5 + i * 0.2 }}
            viewport={{ once: true }}
          />
        ))}
      </div>
    </div>
    
    {/* Bottom CTA */}
    <motion.div
      className="mt-12 text-center"
      initial={{ y: 20, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      viewport={{ once: true }}
    >
      <div className="inline-flex items-center gap-2 bg-green-600/20 border border-green-500/30 rounded-full px-6 py-3 text-green-400 font-medium">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        Empiezas a competir en menos de 5 minutos
      </div>
    </motion.div>
  </div>
</section>

        {/* ─── PredictionsTeaser ─── */}
        <PredictionsTeaser />
        

        {/* ───────────── PLANES OPTIMIZADOS ───────────── */}
        <section id="planes" className="py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-900 to-neutral-950">
          <div className="max-w-5xl mx-auto">
            {/* OPTIMIZATION: Section Header - Creates more urgency and value */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: .5, ease: 'easeOut' }}
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

{/* ───── Countdown dinámico al siguiente GP ───── */}
<div className="relative group bg-gradient-to-b from-blue-800 to-sky-600 p-4 rounded-xl shadow-lg flex flex-col justify-between overflow-hidden">
  {currentGp && (
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
  )}
</div>

{/* ─── Pricing Cards ───────────────────────────── */}
<div className="flex flex-col md:grid md:grid-cols-2 gap-6 mt-6">
  {planes.map((plan, i) => (
    <motion.div
      key={plan.id}
      initial={{ y: 30, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
      viewport={{ once: true, amount: 0.3 }}
      className={`relative p-6 sm:p-8 rounded-2xl ring-1 bg-neutral-900/60 backdrop-blur-lg transition-all duration-300 hover:ring-white/20 hover:scale-[1.03] ${
        plan.isPopular
          ? 'border-2 border-amber-500 ring-2 ring-amber-500/30'
          : 'border border-neutral-700'
      }`}
    >
      {plan.isPopular && (
        <>
          <div className="absolute top-0 right-4 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-bold rounded-full uppercase tracking-wide shadow-lg">
            MÁS POPULAR
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
            {plan.isPopular && (
              <span className="block text-green-400 font-semibold">
                ¡Precio especial solo por hoy!
              </span>
            )}
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
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
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

        <div className="mt-auto">
          <button
            onClick={() => handlePurchase(plan.id)}
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
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4-293a1 1 0 010-1.414z"
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

            

            {/* OPTIMIZATION: Final CTA - Strong final push */}
            <motion.div
              className="mt-12 text-center"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-2xl p-6 max-w-2xl mx-auto">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  ¿Listo para unirte?
                </h3>
                <p className="text-gray-300 text-sm sm:text-base mb-6">
                  El descuento del <strong>40% desaparece pronto</strong>. Asegura tu pase ahora, únete a la comunidad y empieza a competir por premios que te cambiarán la vida.
                </p>
                <button
                  onClick={() =>
                    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold px-8 py-4 rounded-xl text-lg shadow-2xl active:scale-95 transition-transform hover:scale-105"
                >
                  QUIERO MI ACCESO VIP AHORA
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ───────── Botón Telegram ───────── */}
<div className="mt-12 text-center">
  <a
    href="https://t.me/+573009290499"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-3 px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-lg transition"
  >
    {/* Icono de Telegram */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-6 h-6"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 0C5.371 0 0 5.371 0 12c0 6.628 5.371 12 12 12s12-5.372 12-12C24 5.371 18.629 0 12 0zm5.363 8.55l-1.482 7.06c-.112.54-.4.676-.81.423l-2.25-1.66-1.084 1.043c-.12.12-.22.22-.45.22l.162-2.283 4.152-3.758c.18-.16 0-.25-.28-.09l-5.13 3.227-2.21-.69c-.48-.15-.49-.48.1-.71l8.64-3.33c.4-.15.75.09.62.68z"/>
    </svg>

    <span>Envíanos un mensaje por Telegram</span>
  </a>
</div>

        {/* ─── FAQ ─── */}
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
              {/* ADDED: FAQ Item */}
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
              
              {/* ADDED: FAQ Item */}
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

              <details className="group bg-neutral-900/60 p-6 rounded-xl ring-1 ring-white/5">
                <summary className="flex cursor-pointer items-center justify-between font-medium text-white">
                  <span>¿Qué es el Race Pass y el Season Pass?</span>
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
                  El Race Pass te da acceso a un solo Gran Premio, mientras que el Season Pass te da acceso a toda la temporada 2025-2026, incluyendo todos los Grandes Premios y beneficios exclusivos.
                </p>
              </details>

              <details className="group bg-neutral-900/60 p-6 rounded-xl ring-1 ring-white/5">
                <summary className="flex cursor-pointer items-center justify-between font-medium text-white">
                  <span>¿Cómo funcionan las predicciones?</span>
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
                  Con tu Race Pass o Season Pass, recibes acceso a nuestro panel de predicciones donde puedes enviar tus pronósticos para cada carrera. Nuestro sistema te guía con datos y análisis para maximizar tus posibilidades de éxito.
                </p>
              </details>
            </div>
          </div>
        </section>
      </main>
    </div>
  </>
);}