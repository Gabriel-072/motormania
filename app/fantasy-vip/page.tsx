// /app/fantasy-vip/page.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Disclosure } from '@headlessui/react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ForwardIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { createClient } from '@supabase/supabase-js';
import MovingBarFantasy from '@/components/MovingBarFantasy';

/* ╔════════════════════════════════╗
   ║ 0. SUPABASE CLIENT            ║
   ╚════════════════════════════════╝ */
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

  if (!isMounted) {
    return (
      <div className="aspect-[9/16] w-full max-w-xs sm:max-w-sm lg:max-w-lg bg-black/30 rounded-2xl flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full aspect-[9/16] sm:aspect-[4/5] lg:aspect-video rounded-xl overflow-hidden shadow-2xl bg-black group max-w-xs sm:max-w-sm md:max-w-md lg:max-w-xl mx-auto">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300"
          style={{ opacity: isLoading || hasError ? 0 : 1 }}
          loop
          playsInline
          preload="auto"
          onClick={togglePlay}
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='560' height='315' viewBox='0 0 560 315'%3E%3Crect width='100%25' height='100%25' fill='%23000'%2F%3E%3C/svg%3E"
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

type GpSchedule = { gp_name: string; race_time: string };

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
   ╚════════════════════════════╝ */
interface Plan {
  id: string;
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

export default function FantasyVipLanding() {
  const planes: Plan[] = [
    {
      id: 'race-pass',
      nombre: 'Race Pass',
      precio: 20000,
      periodo: 'por carrera',
      beneficios: [
        'Predicciones VIP para 1 GP',
        'Ranking exclusivo en vivo',
        'Estadísticas avanzadas de piloto',
        'Notificaciones push prioritarias',
      ],
    },
    {
      id: 'season-pass',
      nombre: 'Season Pass',
      precio: 200000,
      periodo: 'temporada completa',
      beneficios: [
        'Acceso VIP a todos los GPs',
        'Ahorra un 15% vs Race Pass',
        '10% de descuento en MMC Coins',
        'Early-access a nuevas funciones',
        'Soporte prioritario 24/7',
      ],
      isPopular: true,
    },
  ];

  const faqData: FAQ[] = [
    {
      q: '¿Qué incluye exactamente el Race Pass?',
      a: 'El Race Pass te da acceso VIP a nuestras predicciones avanzadas, el ranking exclusivo con premios especiales y estadísticas detalladas para un único Gran Premio de tu elección.',
    },
    {
      q: '¿Puedo cambiar de Race Pass a Season Pass más tarde?',
      a: '¡Claro! Puedes hacer el upgrade en cualquier momento. Pagarás solo la diferencia y todos los puntos que hayas acumulado en tu ranking se mantendrán.',
    },
    {
      q: '¿Qué tan seguro es el proceso de pago?',
      a: 'Utilizamos Bold Checkout, una pasarela de pagos líder que cumple con los más altos estándares de seguridad, incluyendo cifrado TLS 1.2. Tu información de pago nunca toca nuestros servidores.',
    },
    {
      q: '¿Cuál es la política de reembolso?',
      a: 'Ofrecemos una garantía de satisfacción. Tienes 7 días para solicitar un reembolso completo, siempre y cuando no se haya disputado ningún Gran Premio desde el momento de tu compra.',
    },
  ];

  const formatCOP = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handlePurchase = (planId: string) => {
    console.log(`Redirecting to checkout for: ${planId}`);
    alert(`Iniciando compra para: ${planId}`);
  };

  const Glow = () => (
    <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-400 to-red-500 opacity-0 transition-opacity duration-300 group-hover:opacity-70" />
  );

  return (
    <>
      <MovingBarFantasy />

      <div className="min-h-screen bg-neutral-950 text-gray-200 font-sans">
        {/* Fondos Animados */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-[radial-gradient(circle_at_center,_rgba(251,146,60,0.15),transparent_40%)] animate-[spin_20s_linear_infinite]"></div>
          <div className="absolute bottom-[-30%] right-[-20%] w-[60rem] h-[60rem] bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.15),transparent_45%)] animate-[spin_25s_linear_infinite_reverse]"></div>
        </div>

        <main className="relative z-10">
          {/* HERO SECTION */}
          <section className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto flex flex-col-reverse lg:grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 text-center lg:text-left">
                <motion.h1
                  className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="block bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
                    Desbloquea la
                  </span>
                  <span className="block bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 bg-clip-text text-transparent">
                    Experiencia VIP
                  </span>
                </motion.h1>

                <motion.p
                  className="text-base sm:text-lg md:text-xl text-gray-300 max-w-md mx-auto lg:mx-0"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  Sumérgete en cada Gran Premio con predicciones exclusivas, rankings en tiempo real y
                  la oportunidad de ganar premios.{' '}
                  <span className="text-amber-400 font-semibold">Elige tu pase</span> y compite en la
                  cima.
                </motion.p>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <button
                    onClick={() =>
                      document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="group relative inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-xl bg-neutral-900 font-bold text-white text-base sm:text-lg transition-transform duration-200 active:scale-[0.97]"
                  >
                    <Glow />
                    <span className="relative z-10">Ver Planes VIP</span>
                  </button>
                </motion.div>
              </div>

              <motion.div
                className="w-full sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto lg:mx-0"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <VideoPlayer />
              </motion.div>
            </div>
          </section>

          {/* ───────── PREMIO VIP & PREMIOS POR CARRERA ───────── */}
          <section className="py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 to-neutral-900">
            <div className="max-w-6xl mx-auto">
              <motion.h2
                className="text-center text-2xl sm:text-3xl md:text-4xl font-black mb-12 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                Premios VIP 2025
              </motion.h2>

              <div className="grid gap-8 md:grid-cols-3">
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                  className="relative p-6 rounded-2xl bg-neutral-800/60 ring-1 ring-white/5 backdrop-blur-lg overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#e70b38]/40 via-[#ff9800]/30 to-transparent" />
                  <div className="relative z-10 space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      🏆 Viaje VIP a un GP
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      <strong>TOP 2 de la temporada 2025</strong> + <strong>1 usuario VIP aleatorio</strong>{' '}
                      se llevarán un viaje todo pago (*hospitality suits*) a un Gran Premio de F1.
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  viewport={{ once: true }}
                  className="relative p-6 rounded-2xl bg-neutral-800/60 ring-1 ring-white/5 backdrop-blur-lg overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#ffb300]/20 via-[#ff5722]/20 to-transparent" />
                  <div className="relative z-10 space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      💰 TOP 3 en cada carrera
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Premios en efectivo <em>(monto por definir)</em> + merchandising oficial para los
                      tres mejores de cada GP.
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="relative p-6 rounded-2xl bg-neutral-800/60 ring-1 ring-white/5 backdrop-blur-lg overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00e0ff]/20 via-[#00bcd4]/20 to-transparent" />
                  <div className="relative z-10 space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      🎲 3 ganadores aleatorios
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      En cada GP sorteamos <strong>3 participantes VIP</strong> que reciben premios en
                      efectivo <em>(monto por definir)</em>.
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* NUEVA SECCIÓN “PREDICE…” */}
          <PredictionsTeaser />

          {/* PRICING SECTION */}
          <section id="planes" className="py-16 sm:py-20 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                viewport={{ once: true }}
                className="text-center mb-10 sm:mb-14"
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  Elige Tu Acceso VIP
                </h2>
                <p className="mt-3 sm:mt-4 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
                  Un plan para cada tipo de fanático. Invierte en tu pasión y domina la temporada.
                </p>
              </motion.div>

              <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
                {planes.map((plan, i) => (
                  <motion.div
                    key={plan.id}
                    className={`relative p-6 sm:p-8 rounded-2xl ring-1 ring-white/5 bg-neutral-900/60 backdrop-blur-lg transition hover:ring-white/10 ${
                      plan.isPopular ? 'border-2 border-amber-500/70' : ''
                    }`}
                    initial={{ y: 30, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
                    viewport={{ once: true, amount: 0.3 }}
                  >
                    {plan.isPopular && (
                      <div className="absolute top-0 right-4 -translate-y-1/2 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-bold rounded-full uppercase tracking-wide shadow-lg">
                        Más popular
                      </div>
                    )}

                    <div className="flex flex-col h-full">
                      <h3 className="text-xl sm:text-2xl font-bold text-white">{plan.nombre}</h3>

                      <div className="my-5">
                        <span className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
                          {formatCOP(plan.precio)}
                        </span>
                        <p className="text-gray-400 text-xs sm:text-sm mt-1">{plan.periodo}</p>
                      </div>

                      <ul className="space-y-3 sm:space-y-4 mb-6">
                        {plan.beneficios.map((b) => (
                          <li key={b} className="flex items-start gap-3 text-gray-300 text-sm">
                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mt-0.5">
                              <svg
                                className="w-3.5 h-3.5 text-black"
                                strokeWidth={3}
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                fill="none"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handlePurchase(plan.id)}
                        className={`mt-auto w-full py-3 sm:py-4 rounded-2xl font-bold text-base sm:text-lg active:scale-95 transition ${
                          plan.isPopular
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110'
                            : 'bg-neutral-800 text-white hover:bg-neutral-700'
                        }`}
                      >
                        Contratar {plan.nombre}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ SECTION */}
          <section className="py-16 sm:py-20 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto">
              <motion.h2
                className="text-2xl sm:text-3xl font-black text-center mb-10 sm:mb-12 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                viewport={{ once: true }}
              >
                Preguntas Frecuentes
              </motion.h2>

              <div className="space-y-3 sm:space-y-4">
                {faqData.map((faq, index) => (
                  <motion.div
                    key={faq.q}
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
                    viewport={{ once: true, amount: 0.5 }}
                  >
                    <Disclosure as="div" className="bg-neutral-900/70 border border-white/5 rounded-2xl">
                      {({ open }) => (
                        <>
                          <Disclosure.Button className="w-full flex justify-between items-center gap-3 px-5 py-4">
                            <span className="font-medium text-white text-sm sm:text-base">{faq.q}</span>
                            <ChevronUpIcon
                              className={`h-5 w-5 text-amber-500 transition-transform ${
                                open ? 'rotate-180' : ''
                              }`}
                            />
                          </Disclosure.Button>
                          <AnimatePresence>
                            {open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <Disclosure.Panel static className="px-5 pb-5 text-gray-300 text-sm leading-relaxed">
                                  {faq.a}
                                </Disclosure.Panel>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </Disclosure>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}