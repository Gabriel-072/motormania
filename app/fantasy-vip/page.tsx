// /app/fantasy-vip/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Disclosure } from '@headlessui/react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ForwardIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/solid';

/* ────────────────── Componente VIDEO PLAYER ────────────────── */
function VslPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  /* Controlar carga y progreso */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolume = () => setIsMuted(v.muted);
    const handleTime = () => setProgress((v.currentTime / v.duration) * 100 || 0);
    const handleCanPlay = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);

    v.addEventListener('play', handlePlay);
    v.addEventListener('pause', handlePause);
    v.addEventListener('volumechange', handleVolume);
    v.addEventListener('timeupdate', handleTime);
    v.addEventListener('canplay', handleCanPlay);
    v.addEventListener('waiting', handleWaiting);

    // Autoplay silenciado (policy)
    v.muted = true;
    v.play().catch(() => {});

    return () => {
      v.removeEventListener('play', handlePlay);
      v.removeEventListener('pause', handlePause);
      v.removeEventListener('volumechange', handleVolume);
      v.removeEventListener('timeupdate', handleTime);
      v.removeEventListener('canplay', handleCanPlay);
      v.removeEventListener('waiting', handleWaiting);
    };
  }, []);

  /* Handlers */
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) v.play();
    else v.pause();
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };
  const changeRate = (rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
  };

  /* Tailwind helpers */
  const btnCls =
    'p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-amber-500 active:scale-95 transition';
  const speedBtn = (rate: number) =>
    `px-1.5 py-0.5 rounded text-xs font-semibold ${
      playbackRate === rate ? 'bg-amber-500 text-black' : 'bg-white/10 hover:bg-white/20'
    }`;

  return (
    <div
      className="relative w-full max-w-[320px] aspect-[9/16] rounded-xl overflow-hidden shadow-lg border border-gray-700/60 bg-black group"
    >
      <video
        ref={videoRef}
        src="/videos/fantasyvip-vsl.mp4"
        poster="/videos/fantasyvip-poster.jpg"
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover cursor-pointer"
        onClick={togglePlay}
      />

      {/* Cargando */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {/* Gradiente y controles */}
      <div className="absolute inset-x-0 bottom-0 pt-10 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        {/* Progreso */}
        <div className="mx-3 mb-3 h-1.5 bg-white/20 rounded-full">
          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        {/* Controles */}
        <div className="flex items-center justify-between px-3 pb-3" >
          <div className="flex items-center gap-2">
            <button className={btnCls} onClick={togglePlay} aria-label="Play/Pause">
              {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
            </button>
            <button className={btnCls} onClick={toggleMute} aria-label="Mute/Unmute">
              {isMuted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
            </button>
          </div>
          <div className="flex items-center gap-1 text-white text-xs">
            <ForwardIcon className="h-4 w-4 text-gray-300" />
            {[0.75, 1, 1.5, 2].map((r) => (
              <button key={r} onClick={() => changeRate(r)} className={speedBtn(r)}>
                {r}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────── LANDING PAGE ────────────────── */
export default function FantasyVipLanding() {
  /** Datos de planes */
  const planes = [
    {
      id: 'race-pass',
      nombre: 'Race Pass',
      precio: 20000,
      periodo: 'por carrera',
      beneficios: ['Predicciones VIP para 1 GP', 'Ranking exclusivo en vivo', 'Estadísticas avanzadas'],
    },
    {
      id: 'season-pass',
      nombre: 'Season Pass',
      precio: 200000,
      periodo: 'temporada completa',
      beneficios: [
        'Acceso VIP a todos los GPs del año',
        '10 % de descuento en MMC Coins',
        'Early‑access a nuevas funciones',
      ],
    },
  ];

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-black to-[#0a0f14] text-gray-100">
      {/* ─────── HERO con VSL ─────── */}
      <section className="relative py-24 px-6">
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#f59e0b22,transparent_60%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ duration: 2, repeat: Infinity, repeatType: 'mirror' }}
        />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Texto */}
          <div>
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-lg"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}
            >
              Experiencia Fantasy VIP
            </motion.h1>
            <motion.p
              className="mt-6 text-lg sm:text-xl text-gray-300 max-w-md"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              Vive cada Gran Premio con estadísticas en tiempo real, ranking exclusivo y premios. <span className="text-amber-400 font-semibold">Elige tu pase</span> y sube al podio.
            </motion.p>
            <motion.button
              className="mt-8 px-8 py-4 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 font-bold text-black hover:brightness-110 active:scale-95 transition"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 12 }}
              onClick={() => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Ver planes VIP
            </motion.button>
          </div>

          {/* Video */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="justify-self-center"
          >
            <VslPlayer />
          </motion.div>
        </div>
      </section>

      {/* ─────── PLANES ─────── */}
      <section id="planes" className="py-20 px-6 bg-gradient-to-b from-[#0a0f14] to-black">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
          {planes.map((p) => (
            <div key={p.id} className="rounded-2xl border border-gray-700 p-8 bg-[#111827] shadow-lg hover:-translate-y-1 transition">
              <h3 className="text-2xl font-bold mb-3">{p.nombre}</h3>
              <p className="text-4xl font-extrabold mb-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                {formatCOP(p.precio)}
              </p>
              <p className="text-sm text-gray-400 mb-6">{p.periodo}</p>
              <ul className="space-y-2 mb-8 text-sm">
                {p.beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.285 6.708a1 1 0 010 1.414l-9 9a1 1 0 01-1.414 0l-5-5a1 1 0 111.414-1.414l4.293 4.293 8.293-8.293a1 1 0 011.414 0z" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => alert(`Abrir Bold Checkout para ${p.id}`)}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 font-bold text-black hover:brightness-110 active:scale-95 transition"
              >
                Contratar {p.nombre}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ─────── FAQ ─────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-10 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Preguntas Frecuentes
          </h2>
          <div className="space-y-4">
            {[
              {
                q: '¿Qué incluye exactamente el Race Pass?',
                a: 'Acceso VIP a las predicciones avanzadas para un solo GP, ranking exclusivo y chance de premios especiales.',
              },
              {
                q: '¿Puedo subir de Race Pass a Season Pass?',
                a: 'Sí, pagas solo la diferencia y mantienes tus puntos acumulados.',
              },
              {
                q: '¿Cómo se procesa el pago?',
                a: 'Usamos Bold Checkout con cifrado TLS 1.2; tu tarjeta nunca pasa por nuestros servidores.',
              },
              {
                q: '¿Puedo pedir reembolso?',
                a: 'Tienes 7 días si aún no se ha corrido ningún GP desde la compra.',
              },
            ].map(({ q, a }) => (
              <Disclosure key={q} as="div" className="border border-gray-700 rounded-lg">
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex w-full justify-between items-center px-4 py-3 text-left text-sm font-medium text-gray-100 hover:bg-white/10 focus:outline-none focus-visible:ring focus-visible:ring-amber-500 focus-visible:ring-opacity-75">
                      <span>{q}</span>
                      <ChevronUpIcon className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </Disclosure.Button>
                    <Disclosure.Panel className="px-4 pb-4 pt-1 text-sm text-gray-300">{a}</Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            ))}
          </div>
        </div>
      </section>

      {/* ─────── FOOTER ─────── */}
      <footer className="py-10 text-center text-xs text-gray-500 bg-black/40">
        © {new Date().getFullYear()} MotorManía Colombia — Todos los derechos reservados.
      </footer>
    </div>
  );
}
