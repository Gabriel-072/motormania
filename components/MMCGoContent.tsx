// components/MMCGoContent.tsx
'use client';

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: Imports
// ──────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useRef, useCallback, Fragment
} from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, Transition } from '@headlessui/react';
import { Howl } from 'howler';
import { toast } from 'sonner';

import MMCGoSubHeader from '@/components/MMCGoSubHeader';
import LoadingAnimation from '@/components/LoadingAnimation';
import StickyModal from '@/components/StickyModal';
import FullModal from '@/components/FullModal';
import NextGpCountdown from '@/components/NextGpCountdown';
import { createAuthClient } from '@/lib/supabase';
import { useStickyStore } from '@/stores/stickyStore';
import { PickSelection } from '@/app/types/picks';
import { trackFBEvent } from '@/lib/trackFBEvent';

import { FaQuestionCircle, FaCheck, FaTimes, FaSyncAlt } from 'react-icons/fa';

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: Types
// ──────────────────────────────────────────────────────────────────────────────
type SessionType = 'qualy' | 'race';

interface GpSchedule {
  gp_name: string;
  qualy_time: string;
  race_time: string;
}
interface PicksConfig {
  id: string;
  is_qualy_enabled: boolean;
  is_race_enabled: boolean;
}
interface DriverVisibility {
  driver: string;
  qualy_visible: boolean;
  race_visible: boolean;
  qualy_order: number;
  race_order: number;
  is_hot: boolean;
  is_promo: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: Constants
// ──────────────────────────────────────────────────────────────────────────────
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
const staticDrivers = Object.keys(driverToTeam);

const soundManager = {
  click: new Howl({ src: ['/sounds/f1-click.mp3'], volume: 0.4, preload: true }),
  rev: new Howl({ src: ['/sounds/f1-rev.mp3'], volume: 0.3, preload: true }),
};

const DynamicTutorialModal = dynamic(() => import('@/components/TutorialModal'), {
  loading: () => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <p className="text-white text-lg font-semibold animate-pulse">Cargando Tutorial…</p>
    </div>
  ),
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: Component
// ──────────────────────────────────────────────────────────────────────────────
export default function MMCGoContent() {
  // Clerk / router
  const { getToken } = useAuth();
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  // ── State
  const [isDataLoaded, setIsDataLoaded]   = useState(false);
  const [linesBySession, setLinesBySession] = useState<{
    qualy: Record<string, number>;
    race:  Record<string, number>;
  }>({ qualy: {}, race: {} });
  const [currentGp, setCurrentGp]         = useState<GpSchedule | null>(null);
  const [errors, setErrors]               = useState<string[]>([]);
  const [isQualyView, setIsQualyView]     = useState(true);
  const [showFullModal, setShowFullModal] = useState(false);
  const [showRealtimeModal, setShowRealtimeModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isQualyEnabled, setIsQualyEnabled] = useState(true);
  const [isRaceEnabled,  setIsRaceEnabled]  = useState(true);
  const [showTutorial,  setShowTutorial]    = useState(false);
  const [driverVisibility, setDriverVisibility] = useState<Record<string, DriverVisibility>>({});

  // Refs & stores
  const channelRef             = useRef<any>(null);
  const channelRefVisibility   = useRef<any>(null);
  const hasPlayedRev           = useRef(false);
  const {
    picks, currentSession, setSession,
    addPick, removePick, setShowSticky,
    setMultiplier, setPotentialWin
  } = useStickyStore();

  // ──────────────────────────────────────────────────────────────────────────
  // EFFECT: Restore pending picks after login
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;
    const saved = localStorage.getItem('pendingPicks');
    if (!saved) return;
    try {
      useStickyStore.setState({ picks: JSON.parse(saved) });
      setShowFullModal(true);
    } catch { /* ignore */ }
    localStorage.removeItem('pendingPicks');
  }, [isSignedIn]);

  // ──────────────────────────────────────────────────────────────────────────
  // FUNCTION: Fetch data (config, schedule, lines, visibility)
  // ──────────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setErrors([]);
    try {
      let token: string | null = null;
      if (isSignedIn) token = await getToken({ template: 'supabase' });
      const supabase = createAuthClient(token);
  
      /* 1) Config + schedule */
      const [cfg, sch] = await Promise.all([
        supabase.from('picks_config')
          .select('is_qualy_enabled, is_race_enabled').eq('id', 'main').single(),
        supabase.from('gp_schedule')
          .select('gp_name, qualy_time, race_time').order('race_time'),
      ]);
      if (cfg.error) throw cfg.error;
      if (sch.error) throw sch.error;
  
      setIsQualyEnabled(cfg.data.is_qualy_enabled);
      setIsRaceEnabled(cfg.data.is_race_enabled);
  
      /* 2) Decide pestaña activa YA MISMO */
      const activeSession: SessionType =
        cfg.data.is_qualy_enabled ? 'qualy'
        : cfg.data.is_race_enabled ? 'race'
        : 'qualy';                       // fallback si ambas off
  
      setIsQualyView(activeSession === 'qualy'); // ← actualiza UI
      setSession(activeSession);                 // ← Zustand
  
      /* 3) Próximo GP */
      const now  = new Date();
      const next = sch.data?.find((gp: GpSchedule) => new Date(gp.race_time) > now);
      if (!next) throw new Error('No se encontró GP');
      setCurrentGp(next);
  
      /* 4) Líneas de AMBAS sesiones (prefetch) */
      const [qLines, rLines] = await Promise.all([
        supabase.from('lines').select('driver, line')
          .eq('gp_name', next.gp_name).eq('session_type', 'qualy'),
        supabase.from('lines').select('driver, line')
          .eq('gp_name', next.gp_name).eq('session_type', 'race'),
      ]);
      if (qLines.error) throw qLines.error;
      if (rLines.error) throw rLines.error;
  
      const toMap = (rows: any[] | null) =>
        rows?.reduce((m, { driver, line }) => ({ ...m, [driver]: line }), {}) || {};
      setLinesBySession({ qualy: toMap(qLines.data), race: toMap(rLines.data) });
  
      /* 5) Visibilidad */
      const vis = await supabase.from('driver_visibility').select('*');
      if (vis.error) throw vis.error;
      const visMap: Record<string, DriverVisibility> = {};
      vis.data.forEach(v => { visMap[v.driver] = v; });
      setDriverVisibility(visMap);
  
      setIsDataLoaded(true);
    } catch (e: any) {
      setErrors([e.message ?? 'Error inesperado']);
      setIsDataLoaded(true);
      setLinesBySession({ qualy: {}, race: {} });
      setDriverVisibility({});
      setCurrentGp(null);
    }
  }, [getToken, isSignedIn, setSession]);

  // ── Fetch on load / when Clerk ready
  useEffect(() => {
    if (!isLoaded) return;
    setIsDataLoaded(false);
    fetchData();
  }, [isLoaded, fetchData]);

  // ──────────────────────────────────────────────────────────────────────────
  // EFFECT: Sticky modal visibility / multipliers
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const total = picks.qualy.length + picks.race.length;
    setShowSticky(total >= 2);

    const pay = { 2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100 }[total] || 0;
    setMultiplier(pay);
    setPotentialWin(pay * 10000);
  }, [picks.qualy, picks.race, setShowSticky, setMultiplier, setPotentialWin]);

  // FX: engine rev once on first load
  useEffect(() => {
    if (isDataLoaded && !hasPlayedRev.current) {
      soundManager.rev.play();
      hasPlayedRev.current = true;
    }
  }, [isDataLoaded]);

  // Helpers
  const driverLines = isQualyView ? linesBySession.qualy : linesBySession.race;
  const getUserPick = useCallback((d: string) =>
    picks[currentSession].find(p => p.driver === d)?.betterOrWorse ?? null
  , [picks, currentSession]);

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  if (!isLoaded) return <LoadingAnimation text="Cargando autenticación…" animationDuration={4} />;

  // Tailwind classes (podrías moverlos a un hook util si lo prefieres)
  const driverGridClasses   = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';
  const mainContainerClasses = 'min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white font-exo2';

  return (
    <div className={mainContainerClasses}>
      <MMCGoSubHeader />

      {!isDataLoaded ? (
        <LoadingAnimation text="Cargando MMC‑GO…" animationDuration={2} />
      ) : (
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 pb-32">

          {/* Countdown */}
          <div className="mb-4">
            <NextGpCountdown currentGp={currentGp} isQualyView={isQualyView} />
          </div>

          {/* Subtítulo */}
          <motion.p
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}
            className="mb-6 text-center text-sm text-gray-400"
          >
            Juega Ahora — Solo elige <span className="text-green-400">Mejor</span> o <span className="text-red-400">Peor</span> que su línea.
          </motion.p>

          {/* Toggle compacto */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>
            <div className="relative mx-auto mb-6 flex h-10 w-[150px] items-center rounded-full bg-gray-800 p-1 shadow">
              {/* pill */}
              <motion.span
                layout
                className="absolute h-8 w-[72px] rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                animate={{ x: isQualyView ? 0 : 74 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
              {/* Qualy btn */}
              <button
                disabled={!isQualyEnabled}
                onClick={() => {
                  if (!isQualyView && isQualyEnabled) { setIsQualyView(true); setSession('qualy'); }
                }}
                className={`relative z-10 flex-1 text-center text-xs font-semibold ${
                  !isQualyEnabled
                    ? 'cursor-not-allowed text-gray-500'
                    : isQualyView
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Qualy
              </button>
              {/* Race btn */}
              <button
                disabled={!isRaceEnabled}
                onClick={() => {
                  if (isQualyView && isRaceEnabled) { setIsQualyView(false); setSession('race'); }
                }}
                className={`relative z-10 flex-1 text-center text-xs font-semibold ${
                  !isRaceEnabled
                    ? 'cursor-not-allowed text-gray-500'
                    : !isQualyView
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Carrera
              </button>
            </div>
          </motion.div>

          {/* Grid de pilotos */}
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .2 }}>
            <div className="bg-gradient-to-br from-gray-800/50 via-black/50 to-gray-900/50 p-4 sm:p-6 rounded-xl shadow-xl border border-gray-700/50">
              <div className={driverGridClasses}>
                {staticDrivers.map((driver, idx) => {
                  const vis = driverVisibility[driver];
                  if (!vis || !(isQualyView ? vis.qualy_visible : vis.race_visible)) return null;

                  const line = driverLines[driver];
                  if (line == null) return null;

                  const pick   = getUserPick(driver);
                  const imgSrc = `/images/pilots/${driver.toLowerCase().replace(/ /g, '-')}.png`;

                  return (
                    <motion.div
                      key={`${driver}-${currentSession}`}
                      initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: .2, delay: idx * .02 }}
                      className="rounded-xl"
                    >
                      <div className="relative flex h-full flex-col justify-between rounded-lg bg-gray-800 pt-4 shadow-lg transition hover:shadow-cyan-500/10">
                        {/* HOT / PROMO badges */}
                        {vis.is_promo && (
                          <span className="absolute top-1 left-1 z-10 rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-black">PROMO</span>
                        )}
                        {vis.is_hot && (
                          <span className={`absolute top-1 ${vis.is_promo ? 'right-8' : 'right-1'} z-10 text-lg`}>🔥</span>
                        )}

                        {/* Reset */}
                        {pick && (
                          <button
                            onClick={() => removePick(driver, currentSession)}
                            className="absolute right-1 top-1 z-10 rounded-full bg-yellow-500/80 p-1 text-black hover:bg-yellow-500"
                          >
                            <FaSyncAlt size={10} />
                          </button>
                        )}

                        {/* Info */}
                        <div className="flex flex-col items-center px-1">
                          <Image
                            src={imgSrc}
                            alt={driver}
                            width={80} height={80}
                            className="mb-2 h-16 w-16 rounded-full border-2 border-gray-600 object-cover"
                            unoptimized priority={idx < 10}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/pilots/default-pilot.png'; }}
                          />
                          <h3 className="px-2 text-sm font-bold text-gray-100">{driver}</h3>
                          <p className="mb-1 px-2 text-xs text-gray-400">{driverToTeam[driver]}</p>
                          <p className="mb-2 px-2 text-xs font-semibold text-amber-400">
                            {isQualyView ? 'Qualy' : 'Carrera'}: {line.toFixed(1)}
                          </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex w-full overflow-hidden rounded-b-lg">
                          {(['mejor', 'peor'] as const).map((opt) => {
                            const selected = pick === opt;
                            const base = 'flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5';
                            const palette = opt === 'mejor'
                              ? selected ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-green-600'
                              : selected ? 'bg-red-500 text-white'   : 'bg-gray-700 hover:bg-red-600';
                            const Icon = opt === 'mejor' ? FaCheck : FaTimes;
                            return (
                              <button
                                key={opt}
                                disabled={selected}
                                onClick={() => addPick({
                                  driver,
                                  team: driverToTeam[driver],
                                  line,
                                  betterOrWorse: opt,
                                  gp_name: currentGp?.gp_name ?? '',
                                  session_type: currentSession,
                                })}
                                className={`${base} ${palette} ${selected ? 'shadow-md' : ''}`}
                              >
                                <Icon size={12} /> {opt === 'mejor' ? 'Mejor' : 'Peor'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.section>

          {/* Botón tutorial */}
          <button
            onClick={() => setShowTutorial(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 p-3 text-sm font-semibold text-black shadow-xl transition hover:scale-110"
          >
            <FaQuestionCircle /> ¿Cómo jugar?
          </button>

          {/* === Modals === */}

          {/* Tutorial Modal (Dynamically Imported) */}
          {showTutorial && (
            <DynamicTutorialModal
              show={showTutorial}
              onClose={() => setShowTutorial(false)}
            />
          )}

          {/* Sticky Footer Modal (Summary) */}
          <StickyModal
            onFinish={async () => {
              if (!isSignedIn) {
                localStorage.setItem('pendingPicks', JSON.stringify(picks));
                setShowAuthModal(true);
                return;
              }
              setShowFullModal(true);
            }}
          />

          {/* Full Screen Confirmation Modal */}
          {showFullModal && (
            <FullModal
              isOpen={showFullModal}
              onClose={() => setShowFullModal(false)}
            />
          )}

          {/* Modals wrapped in AnimatePresence for entry/exit animations */}
          <AnimatePresence>
            {/* Authentication Required Modal */}
            {showAuthModal && (
              <Transition appear show={showAuthModal} as={Fragment}>
                <Dialog as="div" className="relative z-[60]" onClose={() => setShowAuthModal(false)}>
                  <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
                  </Transition.Child>
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                      <Dialog.Panel className="mx-auto max-w-sm rounded-xl bg-gradient-to-br from-gray-800 to-black border border-amber-500/30 p-6 text-white shadow-xl text-center">
                        <Dialog.Title className="text-lg font-bold mb-2 text-amber-400">Inicia sesión</Dialog.Title>
                        <Dialog.Description className="text-sm mb-4 text-gray-300">
                          Debes iniciar sesión para confirmar tus picks en MMC GO. Tus selecciones se guardarán.
                        </Dialog.Description>
                        <button
                          onClick={() => { router.push(`/sign-in?redirect_url=${encodeURIComponent('/mmc-go')}`); }}
                          className="w-full px-4 py-2 bg-amber-500 text-black font-bold rounded-md hover:bg-amber-400 transition-colors duration-200"
                        >
                          Iniciar sesión / Registrarse
                        </button>
                        <button onClick={() => setShowAuthModal(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-200">
                          Cancelar
                        </button>
                      </Dialog.Panel>
                    </Transition.Child>
                  </div>
                </Dialog>
              </Transition>
            )}

            {/* Realtime Update Notification Modal */}
            {showRealtimeModal && (
              <Transition appear show={showRealtimeModal} as={Fragment}>
                <Dialog as="div" className="relative z-[60]" onClose={() => setShowRealtimeModal(false)}>
                  <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                     <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
                  </Transition.Child>
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                     <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                       <Dialog.Panel className="mx-auto max-w-sm rounded-xl bg-gradient-to-br from-gray-800 to-black border border-cyan-500/30 p-6 text-white shadow-xl">
                          <Dialog.Title className="text-lg font-bold text-cyan-400">⚡ Estado Actualizado</Dialog.Title>
                          <Dialog.Description className="mt-1 text-sm text-gray-300">
                             La disponibilidad de los picks (Qualy/Carrera) ha cambiado en tiempo real.
                          </Dialog.Description>
                          <div className="mt-4 text-right">
                             <button
                                onClick={() => setShowRealtimeModal(false)}
                                className="px-4 py-2 text-sm font-medium bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors duration-200"
                             >
                               Entendido
                             </button>
                          </div>
                       </Dialog.Panel>
                     </Transition.Child>
                  </div>
                </Dialog>
              </Transition>
            )}
          </AnimatePresence>
          {/* === End Modals === */}

        </main>
      )} {/* End of conditional rendering for isDataLoaded */}
    </div> // End of main container div
  ); // End of return statement
} // End of MMCGoContent component function