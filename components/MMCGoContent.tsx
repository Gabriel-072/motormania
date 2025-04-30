// /Users/imgabrieltoro/Projects/motormania/app/mmc-go/page.tsx (o la ruta relevante)
'use client';

// --- React y Next.js Imports ---
import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic'; // Importación para carga dinámica

// --- Librerías de Autenticación y UI ---
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, Transition } from '@headlessui/react';
import { Howl } from 'howler';
import { toast } from 'sonner';

// --- Importaciones Específicas del Proyecto ---
import MMCGoSubHeader from '@/components/MMCGoSubHeader';
import LoadingAnimation from '@/components/LoadingAnimation';
import StickyModal from '@/components/StickyModal';
import FullModal from '@/components/FullModal';
import { createAuthClient } from '@/lib/supabase';
import { useStickyStore } from '@/stores/stickyStore';
import { PickSelection } from '@/app/types/picks';
import { trackFBEvent } from '@/lib/trackFBEvent';

// --- Iconos ---
import { FaQuestionCircle, FaCheck, FaTimes, FaSyncAlt, FaDollarSign, FaSpinner } from 'react-icons/fa';

// --- Definiciones de Tipos ---
type SessionType = 'qualy' | 'race';
interface GpSchedule { gp_name: string; race_time: string; }
interface PicksConfig { id: string; is_qualy_enabled: boolean; is_race_enabled: boolean; updated_at?: string; }
interface DriverVisibility {
  driver: string;
  qualy_visible: boolean;
  race_visible: boolean;
  qualy_order: number;
  race_order: number;
  is_hot: boolean;
  is_promo: boolean;
}

// --- Constantes y Mapeos ---
const driverToTeam: Record<string, string> = {
  'Max Verstappen': 'Red Bull Racing', 'Yuki Tsunoda': 'Red Bull Racing', 'Lando Norris': 'McLaren', 'Oscar Piastri': 'McLaren', 'Lewis Hamilton': 'Ferrari', 'Charles Leclerc': 'Ferrari', 'George Russell': 'Mercedes', 'Kimi Antonelli': 'Mercedes', 'Fernando Alonso': 'Aston Martin', 'Lance Stroll': 'Aston Martin', 'Liam Lawson': 'RB', 'Isack Hadjar': 'RB', 'Nico Hulkenberg': 'Sauber', 'Gabriel Bortoleto': 'Sauber', 'Pierre Gasly': 'Alpine', 'Jack Doohan': 'Alpine', 'Alex Albon': 'Williams', 'Carlos Sainz': 'Williams', 'Oliver Bearman': 'Haas F1 Team', 'Esteban Ocon': 'Haas F1 Team',
};
const staticDrivers: string[] = Object.keys(driverToTeam);

const soundManager = {
  click: new Howl({ src: ['/sounds/f1-click.mp3'], volume: 0.4, preload: true }),
  rev: new Howl({ src: ['/sounds/f1-rev.mp3'], volume: 0.3, preload: true }),
};

// --- Componentes Cargados Dinámicamente ---
const DynamicTutorialModal = dynamic(() => import('@/components/TutorialModal'), {
  loading: () => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <p className="text-white text-lg font-semibold animate-pulse">Cargando Tutorial...</p>
    </div>
  ),
});

// --- Definición del Componente ---
export default function MMCGoContent() {
  // --- Hooks ---
  const { getToken } = useAuth();
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  // --- Estado ---
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [driverLines, setDriverLines] = useState<Record<string, number>>({});
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isQualyView, setIsQualyView] = useState(true);
  const [showFullModal, setShowFullModal] = useState(false);
  const [showRealtimeModal, setShowRealtimeModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isQualyEnabled, setIsQualyEnabled] = useState(true);
  const [isRaceEnabled, setIsRaceEnabled] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [driverVisibility, setDriverVisibility] = useState<Record<string, DriverVisibility>>({});

  // --- Referencias ---
  const channelRef = useRef<any>(null);
  const channelRefVisibility = useRef<any>(null); // Ref para la suscripción a driver_visibility
  const hasPlayedRev = useRef(false);

  // --- Hooks de Zustand Store ---
  const { picks, currentSession, setSession, addPick, removePick, setShowSticky, setMultiplier, setPotentialWin, setQualyPicks, setRacePicks } = useStickyStore();

  // --- Efectos ---
  // Restaurar picks pendientes
  useEffect(() => {
    if (isSignedIn) {
      const savedPicks = localStorage.getItem('pendingPicks');
      if (savedPicks) {
        try {
          const restoredPicks = JSON.parse(savedPicks);
          useStickyStore.setState({ picks: restoredPicks });
          setShowFullModal(true);
          localStorage.removeItem('pendingPicks');
        } catch (error) {
          console.error('Error restoring picks:', error);
          localStorage.removeItem('pendingPicks');
        }
      }
    }
  }, [isSignedIn]);

  // Función para obtener datos
  const fetchData = useCallback(async () => {
    setErrors([]);
    try {
      console.log(`🟡 fetchData iniciado para ${isQualyView ? 'Qualy' : 'Race'}...`);
      let token: string | null = null;
      if (isSignedIn) {
        token = await getToken({ template: 'supabase' });
        if (!token) { console.warn('Token no encontrado para usuario logueado.'); }
      }
      const supabase = createAuthClient(token);

      const [configResult, scheduleResult] = await Promise.all([
        supabase.from('picks_config').select('is_qualy_enabled, is_race_enabled').eq('id', 'main').single(),
        supabase.from('gp_schedule').select('*').order('race_time')
      ]);

      if (configResult.error) throw configResult.error;
      setIsQualyEnabled(configResult.data.is_qualy_enabled);
      setIsRaceEnabled(configResult.data.is_race_enabled);

      if (scheduleResult.error) throw new Error(scheduleResult.error.message);
      const now = new Date();
      const current = scheduleResult.data?.find((gp: GpSchedule) => new Date(gp.race_time) > now);
      if (!current) throw new Error('No se encontró un próximo GP válido');
      setCurrentGp(current);

      console.log(`🟡 Fetching lines for GP: ${current.gp_name}, Session: ${isQualyView ? 'qualy' : 'race'}`);
      const { data: linesData, error: linesError } = await supabase
        .from('lines')
        .select('driver, line')
        .eq('gp_name', current.gp_name)
        .eq('session_type', isQualyView ? 'qualy' : 'race');

      if (linesError) throw new Error(`Error al cargar líneas: ${linesError.message}`);

      if (!linesData || linesData.length === 0) {
        console.warn(`🟡 No lines found for GP: ${current.gp_name}, Session: ${isQualyView ? 'qualy' : 'race'}`);
        setDriverLines({});
      } else {
        const map: Record<string, number> = {};
        linesData.forEach(({ driver, line }) => { map[driver] = line; });
        setDriverLines(map);
        console.log(`🎯 Líneas cargadas para ${isQualyView ? 'Qualy' : 'Race'}:`, Object.keys(map).length);
      }

      console.log(`🟡 Fetching visibility data...`);
      const { data: visibilityData, error: visError } = await supabase
        .from('driver_visibility')
        .select('*');

      if (visError) throw new Error(`Error al cargar visibilidad: ${visError.message}`);

      const visMap: Record<string, DriverVisibility> = {};
      if (visibilityData) {
        visibilityData.forEach((item) => { visMap[item.driver] = item; });
      } else {
        console.warn(`🟡 No visibility data found.`);
      }
      setDriverVisibility(visMap);
      console.log(`🎯 Visibilidad cargada:`, Object.keys(visMap).length);

      setIsDataLoaded(true);

    } catch (err: any) {
      console.error('❌ Error en fetchData:', err);
      setErrors([err.message || 'Error inesperado al cargar datos']);
      setIsDataLoaded(true);
      setDriverLines({});
      setDriverVisibility({});
    }
  }, [isSignedIn, getToken, isQualyView]);

  // Disparar fetchData
  useEffect(() => {
    if (!isLoaded) return;
    setIsDataLoaded(false);
    const timer = setTimeout(() => fetchData(), 200);
    return () => clearTimeout(timer);
  }, [isLoaded, isQualyView, fetchData]);

  // Suscripción en tiempo real para picks_config
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let mounted = true;
    const subscribeToConfig = async () => {
      try {
        let token = await getToken({ template: 'supabase' });
        if (!token) { throw new Error('Token no encontrado'); }
        const supabase = createAuthClient(token);
        const channel = supabase.channel('realtime-picks-config').on(
          'postgres_changes', { event: 'UPDATE', schema: 'public', table: 'picks_config', filter: 'id=eq.main' },
          (payload) => {
            if (!mounted) return;
            console.log('🟢 Realtime config update received:', payload);
            const updated = payload.new as PicksConfig;
            const wasQualyEnabled = isQualyEnabled;
            const wasRaceEnabled = isRaceEnabled;
            setIsQualyEnabled(updated.is_qualy_enabled);
            setIsRaceEnabled(updated.is_race_enabled);
            if (wasQualyEnabled !== updated.is_qualy_enabled || wasRaceEnabled !== updated.is_race_enabled) {
              setShowRealtimeModal(true);
              toast.success('⚡ Estado de los Picks actualizado.');
              if (isQualyView && !updated.is_qualy_enabled && updated.is_race_enabled) { setIsQualyView(false); setSession('race'); toast.info('Cambiado a vista de Carrera (Qualy desactivada).'); }
              else if (!isQualyView && !updated.is_race_enabled && updated.is_qualy_enabled) { setIsQualyView(true); setSession('qualy'); toast.info('Cambiado a vista de Qualy (Carrera desactivada).'); }
            }
          }
        ).subscribe((status) => { console.log('🟢 Realtime subscription status:', status); });
        channelRef.current = channel;
      } catch (err) { console.error('❌ Error en la suscripción a Realtime:', err); }
    };
    subscribeToConfig();
    return () => { mounted = false; if (channelRef.current) { channelRef.current.unsubscribe(); console.log('⚪ Desuscrito de Realtime config.'); } };
  }, [isLoaded, isSignedIn, isQualyView, isQualyEnabled, isRaceEnabled, setSession, getToken, fetchData]);

  // Suscripción en tiempo real para driver_visibility
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let mounted = true;
    (async () => {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      const supabase = createAuthClient(token);
      const channel = supabase
        .channel('realtime-driver-visibility')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'driver_visibility' },
          payload => {
            if (!mounted) return;
            setDriverVisibility(prev => ({
              ...prev,
              [payload.new.driver]: payload.new
            }));
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'driver_visibility' },
          payload => {
            if (!mounted) return;
            setDriverVisibility(prev => ({
              ...prev,
              [payload.new.driver]: payload.new
            }));
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'driver_visibility' },
          payload => {
            if (!mounted) return;
            setDriverVisibility(prev => {
              const next = { ...prev };
              delete next[payload.old.driver];
              return next;
            });
          }
        )
        .subscribe(status => {
          console.log('⚡ realtime-driver-visibility status:', status);
        });
      channelRefVisibility.current = channel;
    })();
    return () => {
      mounted = false;
      if (channelRefVisibility.current) {
        channelRefVisibility.current.unsubscribe();
      }
    };
  }, [isLoaded, isSignedIn, getToken]);

  // Visibilidad del Sticky Modal
  useEffect(() => {
    const totalPicks = picks.qualy.length + picks.race.length;
    setShowSticky(totalPicks >= 2);
  }, [picks.qualy, picks.race, setShowSticky]);

  // Cálculo de ganancia potencial
  useEffect(() => {
    const totalPicks = picks.qualy.length + picks.race.length;
    const payoutCombos: Record<number, number> = { 2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100 };
    const multiplier = payoutCombos[totalPicks] || 0;
    setMultiplier(multiplier);
    setPotentialWin(multiplier * 10000);
  }, [picks.qualy, picks.race, setMultiplier, setPotentialWin]);

  // Reproducir efecto de sonido
  useEffect(() => {
    if (isDataLoaded && !hasPlayedRev.current) {
      setTimeout(() => {
        soundManager.rev.play();
        hasPlayedRev.current = true;
      }, 100);
    }
  }, [isDataLoaded]);

  // --- Funciones Auxiliares ---
  const getUserPick = useCallback((driver: string): 'mejor' | 'peor' | null => {
    return picks[currentSession].find((p) => p.driver === driver)?.betterOrWorse || null;
  }, [picks, currentSession]);

  // --- Manejadores de Eventos ---
  const handlePick = useCallback((driver: string, betterOrWorse: 'mejor' | 'peor') => {
    if (!currentGp || !isDataLoaded) return;
    const totalPicks = picks.qualy.length + picks.race.length;
    if (totalPicks === 0) {
      trackFBEvent('Lead', { params: { page: 'mmc-go' } });
      trackFBEvent('IntentoPick', { params: { page: 'mmc-go' } });
    }
    soundManager.click.play();
    const line = driverLines[driver] ?? 10.5;
    const team = driverToTeam[driver] || 'Unknown Team';
    const newPick: PickSelection = { driver, team, line, betterOrWorse, gp_name: currentGp.gp_name, session_type: currentSession };
    const success = addPick(newPick);
    if (!success) { toast.error('Máximo 8 picks combinados entre Qualy y Carrera.'); }
  }, [currentGp, isDataLoaded, picks, currentSession, driverLines, addPick]);

  const handleReset = useCallback((driver: string) => {
    soundManager.click.play();
    removePick(driver, currentSession);
  }, [currentSession, removePick]);

  // --- Lógica de Renderizado ---
  if (!isLoaded) { return <LoadingAnimation text="Cargando autenticación..." animationDuration={4} />; }

  // --- Definiciones de Clases Tailwind ---
  const mainContainerClasses = "min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white font-exo2";
  const contentWrapperClasses = "container mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-32";
  const pageTitleClasses = "text-3xl sm:text-4xl font-bold text-center text-amber-400 tracking-tight";
  const pageSubtitleClasses = "text-sm text-center text-gray-400 mt-1 mb-8";
  const sessionToggleContainerClasses = "flex justify-center items-center gap-2 mb-8 p-1 bg-gray-800 rounded-lg shadow-md max-w-xs mx-auto";
  const sessionButtonBaseClasses = "flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800";
  const sessionButtonActiveClasses = "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg focus:ring-cyan-400";
  const sessionButtonInactiveClasses = "bg-transparent text-gray-400 hover:bg-gray-700 hover:text-gray-200 focus:ring-gray-500";
  const sessionButtonDisabledClasses = "bg-gray-700 text-gray-500 cursor-not-allowed opacity-60";
  const driverGridContainerClasses = "bg-gradient-to-br from-gray-800/50 via-black/50 to-gray-900/50 p-4 sm:p-6 rounded-xl shadow-xl border border-gray-700/50";
  const driverGridClasses = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4 sm:gap-5";
  const driverCardWrapperClasses = "rounded-xl";
  const driverCardInnerBaseClasses = "relative bg-gray-800 pt-3 sm:pt-4 rounded-lg shadow-lg text-center h-full flex flex-col justify-between transition-shadow duration-300 ease-in-out overflow-hidden";
  const driverCardHoverClasses = "hover:bg-gray-750 hover:shadow-xl hover:shadow-cyan-500/10";
  const driverImageClasses = "mx-auto rounded-full w-16 h-16 sm:w-20 sm:h-20 object-cover border-2 border-gray-600 mb-2";
  const driverNameClasses = "text-sm sm:text-base font-bold mt-2 text-gray-100 px-2";
  const driverTeamClasses = "text-xs text-gray-400 mb-1 px-2";
  const driverLineClasses = "text-xs font-semibold text-amber-400 mb-2 px-2";
  const pickButtonContainerClasses = "flex justify-center gap-0 mt-auto w-full rounded-b-lg overflow-hidden";
  const pickButtonBaseClasses = "flex-1 py-2.5 text-sm font-bold transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-inset focus:ring-offset-0 flex items-center justify-center gap-1.5";
  const pickButtonBetterClasses = "bg-gray-700 hover:bg-green-600 focus:ring-green-500";
  const pickButtonWorseClasses = "bg-gray-700 hover:bg-red-600 focus:ring-red-500";
  const pickButtonSelectedBetterClasses = "bg-green-500 text-white shadow-md focus:ring-green-400";
  const pickButtonSelectedWorseClasses = "bg-red-500 text-white shadow-md focus:ring-red-400";
  const resetButtonClasses = "absolute top-1.5 right-1.5 bg-yellow-500/80 text-black p-1 rounded-full hover:bg-yellow-500 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 focus:ring-offset-gray-800 z-10";
  const tutorialButtonClasses = "fixed bottom-6 right-6 z-50 bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-xl p-3 rounded-full hover:scale-110 hover:shadow-orange-500/30 transition-all duration-300 ease-in-out flex items-center gap-2 text-sm font-semibold";
  const errorContainerClasses = "bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center mb-6 shadow-md";
  const infoTextClasses = "text-center text-sm text-amber-400 mb-6 animate-pulse";
  const noLinesAvailableClasses = "text-center text-lg text-gray-500 my-10";

  // Generar la lista filtrada y ordenada de pilotos visibles
  const visibleDrivers = staticDrivers
    .map((driver) => ({
      name: driver,
      config: driverVisibility[driver] || {
        driver: driver,
        qualy_visible: true,
        race_visible: true,
        qualy_order: 999,
        race_order: 999,
        is_hot: false,
        is_promo: false
      }
    }))
    .filter(({ config }) => isQualyView ? config.qualy_visible : config.race_visible)
    .sort((a, b) => isQualyView ? a.config.qualy_order - b.config.qualy_order : a.config.race_order - b.config.race_order);

  // --- Renderizado JSX ---
  return (
    <div className={mainContainerClasses}>
      <MMCGoSubHeader />

      {!isDataLoaded ? (
        <LoadingAnimation text="Cargando MMC-GO..." animationDuration={2} />
      ) : (
        <main className={contentWrapperClasses}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="mb-6">
              <h1 className={pageTitleClasses}>MMC-GO: Picks</h1>
              {currentGp && ( <p className="text-center text-lg text-gray-300 mt-1"> Próximo GP: <span className="font-semibold text-amber-300">{currentGp.gp_name}</span> </p> )}
              <p className={pageSubtitleClasses}> Selecciona pilotos y predice si quedarán <span className="text-green-400 font-medium">Mejor</span> o <span className="text-red-400 font-medium">Peor</span> que su línea. </p>
            </div>
          </motion.div>
          <AnimatePresence> {errors.length > 0 && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={errorContainerClasses}> {errors.map((err, i) => (<p key={i}>{err}</p>))} </motion.div> )} </AnimatePresence>
          <AnimatePresence> {isDataLoaded && !errors.length && picks.qualy.length + picks.race.length === 1 && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={infoTextClasses}> ⚡ Selecciona 1 pick más para activar tu jugada ⚡ </motion.div> )} </AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <div className={sessionToggleContainerClasses}>
              {isQualyEnabled ? ( <button onClick={() => { setIsQualyView(true); setSession('qualy'); }} className={`${sessionButtonBaseClasses} ${isQualyView ? sessionButtonActiveClasses : sessionButtonInactiveClasses}`}> Qualy </button> ) : ( <span className={`${sessionButtonBaseClasses} ${sessionButtonDisabledClasses}`}> Qualy </span> )}
              {isRaceEnabled ? ( <button onClick={() => { setIsQualyView(false); setSession('race'); }} className={`${sessionButtonBaseClasses} ${!isQualyView ? sessionButtonActiveClasses : sessionButtonInactiveClasses}`}> Carrera </button> ) : ( <span className={`${sessionButtonBaseClasses} ${sessionButtonDisabledClasses}`}> Carrera </span> )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className={driverGridContainerClasses}>
              <section className={driverGridClasses}>
                {visibleDrivers.map(({ name: driver, config }, index) => {
                  const image = `/images/pilots/${driver.toLowerCase().replace(/ /g, '-')}.png`;
                  const team = driverToTeam[driver] || 'Unknown Team';
                  const pick = getUserPick(driver);
                  const line = driverLines[driver];

                  if (line === undefined || line === null) {
                    return null;
                  }

                  return (
                    <motion.div
                      key={`${driver}-${currentSession}`}
                      className={driverCardWrapperClasses}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                    >
                      <div className={`${driverCardInnerBaseClasses} ${driverCardHoverClasses}`}>
                        {config.is_promo && (
                          <span className="absolute top-1.5 left-1.5 z-10 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow">PROMOCIÓN</span>
                        )}
                        {config.is_hot && (
                          <span className="absolute top-1.5 right-8 text-lg z-10" title="¡Piloto HOT!"> 🔥</span>
                        )}
                        {pick && ( <button onClick={() => handleReset(driver)} className={resetButtonClasses} aria-label={`Resetear selección para ${driver}`}> <FaSyncAlt size={10} /> </button> )}

                        <div className="flex-grow flex flex-col items-center pt-4">
                          <Image src={image} alt={driver} width={80} height={80} className={driverImageClasses} unoptimized priority={index < 10} onError={(e) => { e.currentTarget.src = '/images/pilots/default-pilot.png'; }} />
                          <h3 className={driverNameClasses}>{driver}</h3>
                          <p className={driverTeamClasses}>{team}</p>
                          <p className={driverLineClasses}> {isQualyView ? 'Qualy' : 'Carrera'}: {line?.toFixed(1)} </p>
                        </div>
                        <div className={pickButtonContainerClasses}>
                          <button onClick={() => handlePick(driver, 'mejor')} className={`${pickButtonBaseClasses} ${pick === 'mejor' ? pickButtonSelectedBetterClasses : pickButtonBetterClasses}`} disabled={pick === 'mejor'}> <FaCheck size={12} /> Mejor </button>
                          <button onClick={() => handlePick(driver, 'peor')} className={`${pickButtonBaseClasses} ${pick === 'peor' ? pickButtonSelectedWorseClasses : pickButtonWorseClasses}`} disabled={pick === 'peor'}> <FaTimes size={12} /> Peor </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {isDataLoaded && visibleDrivers.filter(d => driverLines[d.name] != null).length === 0 && !errors.length && (
                  <div className={`col-span-full ${noLinesAvailableClasses}`}> No hay pilotos disponibles con líneas para {isQualyView ? 'Qualy' : 'Carrera'} en este momento. </div>
                )}
              </section>
            </div>
          </motion.div>

          <button onClick={() => setShowTutorial(true)} className={tutorialButtonClasses} aria-label="¿Cómo jugar?"> <FaQuestionCircle /> ¿Cómo Jugar? </button>
          {showTutorial && (
            <DynamicTutorialModal
              show={showTutorial}
              onClose={() => setShowTutorial(false)}
            />
          )}
          <StickyModal onFinish={async () => { if (!isSignedIn) { localStorage.setItem('pendingPicks', JSON.stringify(picks)); setShowAuthModal(true); return; } setShowFullModal(true); }} />
          {showFullModal && <FullModal isOpen={showFullModal} onClose={() => setShowFullModal(false)} />}

          <AnimatePresence>
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
                        <Dialog.Description className="text-sm mb-4 text-gray-300"> Debes iniciar sesión para confirmar tus picks en MMC GO. Tus selecciones se guardarán. </Dialog.Description>
                        <button onClick={() => { router.push(`/sign-in?redirect_url=${encodeURIComponent('/mmc-go')}`); }} className="w-full px-4 py-2 bg-amber-500 text-black font-bold rounded-md hover:bg-amber-400 transition-colors duration-200"> Iniciar sesión / Registrarse </button>
                        <button onClick={() => setShowAuthModal(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-200"> Cancelar </button>
                      </Dialog.Panel>
                    </Transition.Child>
                  </div>
                </Dialog>
              </Transition>
            )}
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
                        <Dialog.Description className="mt-1 text-sm text-gray-300"> La disponibilidad de los picks (Qualy/Carrera) ha cambiado en tiempo real. </Dialog.Description>
                        <div className="mt-4 text-right"> <button onClick={() => setShowRealtimeModal(false)} className="px-4 py-2 text-sm font-medium bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors duration-200" > Entendido </button> </div>
                      </Dialog.Panel>
                    </Transition.Child>
                  </div>
                </Dialog>
              </Transition>
            )}
          </AnimatePresence>
        </main>
      )}
    </div>
  );
}