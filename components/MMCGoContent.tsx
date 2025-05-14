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
import { toast } from 'sonner'; // Import toast from sonner

import MMCGoSubHeader from '@/components/MMCGoSubHeader'; // Ajusta ruta si es necesario
import LoadingAnimation from '@/components/LoadingAnimation'; // Ajusta ruta si es necesario
import StickyModal from '@/components/StickyModal'; // Ajusta ruta si es necesario
import FomoBar from '@/components/FomoBar';
import FullModal from '@/components/FullModal'; // Ajusta ruta si es necesario
import NextGpCountdown from '@/components/NextGpCountdown'; // Ajusta ruta si es necesario
import { createAuthClient } from '@/lib/supabase'; // Ajusta ruta si es necesario
import { useStickyStore } from '@/stores/stickyStore'; // Ajusta ruta si es necesario
import { PickSelection } from '@/app/types/picks'; // Ajusta ruta si es necesario
import { trackFBEvent } from '@/lib/trackFBEvent'; // Ajusta ruta si es necesario

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
interface LineData { // Para datos de Supabase 'lines'
    driver: string;
    line: number;
    session_type: SessionType; // Incluir session_type para el handler de realtime
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: Constants
// ──────────────────────────────────────────────────────────────────────────────
const driverToTeam: Readonly<Record<string, string>> = {
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
const staticDrivers: ReadonlyArray<string> = Object.keys(driverToTeam);

const soundManager = {
  click: new Howl({ src: ['/sounds/f1-click.mp3'], volume: 0.4, preload: true }),
  rev: new Howl({ src: ['/sounds/f1-rev.mp3'], volume: 0.3, preload: true }),
};

const DynamicTutorialModal = dynamic(() => import('@/components/TutorialModal'), { // Ajusta ruta
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
  const configChannelRef       = useRef<any>(null);
  const visibilityChannelRef   = useRef<any>(null);
  const linesChannelRef        = useRef<any>(null);
  const {
    picks, currentSession, setSession,
    addPick, removePick, setShowSticky,
    setMultiplier, setPotentialWin
  } = useStickyStore();

  // EFFECT: Restore pending picks after login
  useEffect(() => {
    if (!isSignedIn || !isLoaded) return;
    const saved = localStorage.getItem('pendingPicks');
    if (!saved) return;
    try {
      const parsedPicks = JSON.parse(saved);
      if (parsedPicks && typeof parsedPicks === 'object' && parsedPicks.qualy && parsedPicks.race) {
           useStickyStore.setState({ picks: parsedPicks });
           setShowFullModal(true);
      } else {
          console.warn("Pending picks en localStorage no válidos."); // CORREGIDO: console.warn existe
      }
    } catch (e) {
        console.error("Error parseando pending picks:", e);
    } finally {
        localStorage.removeItem('pendingPicks');
    }
  }, [isSignedIn, isLoaded]);

  // FUNCTION: Fetch data (config, schedule, lines, visibility)
  const fetchData = useCallback(async (): Promise<void> => {
    console.log("[MMCGoContent] Iniciando fetchData...");
    setErrors([]);
    try {
      let token: string | null = null;
      if (isSignedIn) {
        token = await getToken({ template: 'supabase' });
      }
      const supabase = createAuthClient(token);

      /* 1) Config + schedule */
      console.log("[MMCGoContent] Fetching config y schedule...");
      const [cfgResult, schResult] = await Promise.all([
        supabase.from('picks_config').select('is_qualy_enabled, is_race_enabled').eq('id', 'main').single(),
        supabase.from('gp_schedule').select('gp_name, qualy_time, race_time').order('race_time'),
      ]);

      if (cfgResult.error) throw new Error(`Error cargando config: ${cfgResult.error.message}`);
      if (schResult.error) throw new Error(`Error cargando schedule: ${schResult.error.message}`);
      if (!cfgResult.data) throw new Error('No se recibieron datos de configuración.');
      if (!schResult.data) throw new Error('No se recibieron datos de calendario.');

      const configData = cfgResult.data;
      const scheduleData = schResult.data;
      console.log("[MMCGoContent] Config y schedule recibidos.");

      setIsQualyEnabled(configData.is_qualy_enabled);
      setIsRaceEnabled(configData.is_race_enabled);

      /* 2) Decide pestaña activa */
      const activeSession: SessionType = configData.is_qualy_enabled ? 'qualy' : configData.is_race_enabled ? 'race' : 'qualy';
      console.log("[MMCGoContent] Sesión activa determinada:", activeSession);
      setIsQualyView(activeSession === 'qualy');
      setSession(activeSession);

      /* 3) Próximo GP */
      const now = new Date();
      const nextGp = scheduleData.find((gp: GpSchedule) => new Date(gp.race_time) > now);

      if (!nextGp) {
          console.warn('[MMCGoContent] No se encontró próximo GP.'); // CORREGIDO: console.warn existe
          setCurrentGp(null);
          setLinesBySession({ qualy: {}, race: {} });
          setDriverVisibility({});
          setIsDataLoaded(true);
          toast.warning("No se encontró un próximo Gran Premio en el calendario."); // CORREGIDO: toast.warning
          return;
      }
      console.log("[MMCGoContent] Próximo GP:", nextGp.gp_name);
      setCurrentGp(nextGp);

      /* 4) Líneas */
      console.log(`[MMCGoContent] Fetching lines para ${nextGp.gp_name}...`);
      const [qLinesResult, rLinesResult] = await Promise.all([
        supabase.from('lines').select('driver, line').eq('gp_name', nextGp.gp_name).eq('session_type', 'qualy'),
        supabase.from('lines').select('driver, line').eq('gp_name', nextGp.gp_name).eq('session_type', 'race'),
      ]);

      // Permitir continuar aunque fallen las líneas, pero loguear warning
      if (qLinesResult.error) console.warn(`Error cargando líneas Qualy: ${qLinesResult.error.message}`);
      if (rLinesResult.error) console.warn(`Error cargando líneas Race: ${rLinesResult.error.message}`);

      const toMap = (rows: { driver: string; line: number }[] | null): Record<string, number> =>
        rows?.reduce((map, { driver, line }) => ({ ...map, [driver]: line }), {}) || {};
      const qualyLinesMap = toMap(qLinesResult.data);
      const raceLinesMap = toMap(rLinesResult.data);
      console.log("[MMCGoContent] Líneas Qualy:", Object.keys(qualyLinesMap).length, " Race:", Object.keys(raceLinesMap).length);
      setLinesBySession({ qualy: qualyLinesMap, race: raceLinesMap });

      /* 5) Visibilidad */
      console.log("[MMCGoContent] Fetching driver visibility...");
      const visResult = await supabase.from('driver_visibility').select('*');
      if (visResult.error) throw new Error(`Error cargando visibilidad: ${visResult.error.message}`);
      if (!visResult.data) throw new Error('No se recibieron datos de visibilidad.');

      const visMap: Record<string, DriverVisibility> = {};
      staticDrivers.forEach(driver => {
          const existingVis = visResult.data.find(v => v.driver === driver);
          visMap[driver] = existingVis || { driver, qualy_visible: true, race_visible: true, qualy_order: 999, race_order: 999, is_hot: false, is_promo: false };
      });
      console.log("[MMCGoContent] Driver visibility mapeado para ", Object.keys(visMap).length, " pilotos.");
      setDriverVisibility(visMap);

      setIsDataLoaded(true);
      console.log("[MMCGoContent] fetchData completado exitosamente.");

    } catch (e: any) {
      console.error("[MMCGoContent] Error en fetchData:", e);
      setErrors(prev => [...prev, e.message ?? 'Error inesperado durante la carga']);
      setIsDataLoaded(true);
      setLinesBySession({ qualy: {}, race: {} });
      setDriverVisibility({});
      setCurrentGp(null);
      setIsQualyEnabled(false);
      setIsRaceEnabled(false);
    }
  }, [getToken, isSignedIn, setSession]); // Dependencias fetchData

  // EFFECT: Fetch on initial load
  useEffect(() => {
    if (!isLoaded) return;
    console.log("[MMCGoContent] Clerk listo. Llamando a fetchData...");
    setIsDataLoaded(false);
    fetchData();
  }, [isLoaded, fetchData]);

  // EFFECT: Supabase Realtime Subscriptions
  useEffect(() => {
    if (!isLoaded || !currentGp?.gp_name) { // Asegurarse de tener GP para suscribirse a líneas
      console.log(`[MMCGoContent] No se suscribe a Realtime. isLoaded: ${isLoaded}, currentGp: ${currentGp?.gp_name}`);
      return;
    }

    let supabaseClient = createAuthClient(null);
    const channelsToRemove: any[] = [];

    const setupSubscriptions = async () => {
      let token: string | null = null;
      if (isSignedIn) {
        try { token = await getToken({ template: 'supabase' }); } catch (error) { console.error("Error obteniendo token", error); }
      }
      supabaseClient = createAuthClient(token);
      console.log(`[MMCGoContent] Configurando suscripciones con cliente ${token ? 'autenticado' : 'anónimo'}.`);

      // --- Suscripción a picks_config ---
      if (configChannelRef.current) { try { await supabaseClient.removeChannel(configChannelRef.current); } catch (e) { console.warn("Error limpiando canal config previo:", e); } configChannelRef.current = null; }
      console.log('[MMCGoContent] Configurando suscripción a picks_config');
      const newConfigChannel = supabaseClient
        .channel('public:picks_config:mmcgo')
        .on<PicksConfig>(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'picks_config', filter: 'id=eq.main' },
          (payload) => {
            console.log('[MMCGoContent] Cambio en picks_config:', payload.new);
            if (payload.new) {
              const newConfig = payload.new;
              const didQualyChange = isQualyEnabled !== newConfig.is_qualy_enabled;
              const didRaceChange = isRaceEnabled !== newConfig.is_race_enabled;
              if(didQualyChange || didRaceChange) { toast.info('La disponibilidad de picks ha cambiado.'); }
              setIsQualyEnabled(newConfig.is_qualy_enabled);
              setIsRaceEnabled(newConfig.is_race_enabled);
              const newActiveSession: SessionType = newConfig.is_qualy_enabled ? 'qualy' : newConfig.is_race_enabled ? 'race' : (isQualyView ? 'qualy' : 'race');
              const currentViewSession = isQualyView ? 'qualy' : 'race';
              if (newActiveSession !== currentViewSession) { setIsQualyView(newActiveSession === 'qualy'); setSession(newActiveSession); }
              if (currentViewSession === 'qualy' && !newConfig.is_qualy_enabled && newConfig.is_race_enabled) { setIsQualyView(false); setSession('race'); toast.info("Picks de Qualy cerrados. Mostrando Carrera.", { duration: 5000 }); }
              else if (currentViewSession === 'race' && !newConfig.is_race_enabled && newConfig.is_qualy_enabled) { setIsQualyView(true); setSession('qualy'); toast.info("Picks de Carrera cerrados. Mostrando Qualy.", { duration: 5000 }); }
              else if (!newConfig.is_qualy_enabled && !newConfig.is_race_enabled) { toast.warning("¡Atención! Picks de Qualy y Carrera están cerrados.", { duration: 5000 }); } // CORREGIDO: toast.warning
              else if (didQualyChange || didRaceChange) { setShowRealtimeModal(true); }
            }
          }
        )
        .subscribe((status: string, err?: Error) => {
           if (status === 'SUBSCRIBED') console.log('[MMCGoContent] Suscrito a picks_config!');
           else if (err) console.error(`[MMCGoContent] Error suscripción picks_config: ${status}`, err);
        });
      configChannelRef.current = newConfigChannel;
      channelsToRemove.push(newConfigChannel);

      // --- Suscripción a driver_visibility ---
      if (visibilityChannelRef.current) { try { await supabaseClient.removeChannel(visibilityChannelRef.current); } catch(e) { console.warn("Error limpiando canal visibilidad previo:", e); } visibilityChannelRef.current = null; }
      console.log('[MMCGoContent] Configurando suscripción a driver_visibility');
      const newVisibilityChannel = supabaseClient
        .channel('public:driver_visibility:mmcgo')
        .on<DriverVisibility>(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_visibility' },
          (payload) => {
            console.log(`[MMCGoContent] Cambio en driver_visibility (${payload.eventType}):`, payload.new || payload.old);
            toast.info('Visibilidad/Orden de pilotos actualizado.');
            const record = (payload.eventType === 'DELETE' ? payload.old : payload.new) as DriverVisibility;
            if (record && record.driver) {
              setDriverVisibility(prev => {
                const updated = { ...prev };
                if (payload.eventType === 'DELETE') {
                   delete updated[record.driver];
                   console.warn(`Piloto ${record.driver} eliminado de visibilidad.`); // CORREGIDO: console.warn
                } else { updated[record.driver] = record; }
                return updated;
              });
            } else { console.warn("[MMCGoContent] Payload inesperado de driver_visibility, recargando datos."); fetchData(); } // CORREGIDO: console.warn
          }
        )
        .subscribe((status: string, err?: Error) => {
           if (status === 'SUBSCRIBED') console.log('[MMCGoContent] Suscrito a driver_visibility!');
           else if (err) console.error(`[MMCGoContent] Error suscripción driver_visibility: ${status}`, err);
        });
      visibilityChannelRef.current = newVisibilityChannel;
      channelsToRemove.push(newVisibilityChannel);

      // --- Suscripción a lines ---
      const gpName = currentGp.gp_name; // Safe now due to effect condition
      if (linesChannelRef.current) { try { await supabaseClient.removeChannel(linesChannelRef.current); } catch(e) { console.warn("Error limpiando canal lines previo:", e); } linesChannelRef.current = null; }
      console.log(`[MMCGoContent] Configurando suscripción a lines para GP: ${gpName}`);
      const newLinesChannel = supabaseClient
        .channel(`public:lines:gp:${gpName}:mmcgo`)
        .on<LineData & { session_type: SessionType }>(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lines', filter: `gp_name=eq.${gpName}` },
          (payload) => {
            console.log(`[MMCGoContent] Cambio en lines (${payload.eventType}) para ${gpName}:`, payload.new || payload.old);
            toast.info('Líneas de pilotos actualizadas.');
            const record = (payload.eventType === 'DELETE' ? payload.old : payload.new);

            if (record && typeof record.driver === 'string' && typeof record.session_type === 'string' && (payload.eventType !== 'DELETE' ? typeof record.line === 'number' : true)) {
              const { driver, session_type } = record;
              const line = payload.eventType !== 'DELETE' ? record.line : undefined;

              setLinesBySession(prev => {
                const updatedSessionLines = { ...(prev[session_type] || {}) };
                if (payload.eventType === 'DELETE') { delete updatedSessionLines[driver]; }
                else { updatedSessionLines[driver] = line as number; }
                if (JSON.stringify(prev[session_type]) !== JSON.stringify(updatedSessionLines)) { return { ...prev, [session_type]: updatedSessionLines }; }
                return prev;
              });
            } else { console.warn("[MMCGoContent] Payload inesperado de lines, recargando datos.", payload); fetchData(); } // CORREGIDO: console.warn
          }
        )
        .subscribe((status: string, err?: Error) => {
           if (status === 'SUBSCRIBED') console.log(`[MMCGoContent] Suscrito a lines para GP: ${gpName}!`);
           else if (err) console.error(`[MMCGoContent] Error suscripción lines para ${gpName}: ${status}`, err);
        });
      linesChannelRef.current = newLinesChannel;
      channelsToRemove.push(newLinesChannel);

    };

    setupSubscriptions();

    // Función de limpieza
    return () => {
      console.log('[MMCGoContent] Limpiando suscripciones de Supabase...');
      const cleanupClient = createAuthClient(null); // Usar cliente genérico para limpiar
      channelsToRemove.forEach(channel => {
        if (channel) {
          cleanupClient.removeChannel(channel)
            .then(status => console.log(`[MMCGoContent] Canal ${channel.topic} desuscrito:`, status))
            .catch(error => console.error(`[MMCGoContent] Error al desuscribir canal ${channel.topic}:`, error));
        }
      });
      configChannelRef.current = null;
      visibilityChannelRef.current = null;
      linesChannelRef.current = null;
    };
  }, [isLoaded, isSignedIn, getToken, fetchData, setSession, isQualyView, currentGp]); // Dependencias suscripción


  // EFFECT: Sticky modal visibility / multipliers
  useEffect(() => {
    const totalPicks = (picks.qualy?.length || 0) + (picks.race?.length || 0); // Check for undefined picks arrays
    setShowSticky(totalPicks >= 2);

    const multipliers: Record<number, number> = { 2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100 };
    const currentMultiplier = multipliers[totalPicks] || 0;

    setMultiplier(currentMultiplier);
    setPotentialWin(currentMultiplier * 10000); // Asumiendo $10,000 COP

  }, [picks.qualy, picks.race, setShowSticky, setMultiplier, setPotentialWin]); // Dependencias correctas

  // Sounds FX:

  // ■■■ CREATE CLICK SOUND ON CLIENT ■■■
  const clickSound = useRef<Howl | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    clickSound.current = new Howl({
      src: ['/sounds/f1-click.mp3'],
      volume: 0.4,
      preload: true,
    });
    // fuerza la carga inmediata
    clickSound.current.load();
  }, []);

  // ■■■ engine rev once on first load (sigue usando tu rev global) ■■■
  const hasPlayedRev = useRef(false);
  useEffect(() => {
    if (isDataLoaded && !hasPlayedRev.current) {
      soundManager.rev.play();
      hasPlayedRev.current = true;
    }
  }, [isDataLoaded]);

  // Helper para obtener líneas de la sesión activa
  const driverLines = isQualyView ? linesBySession.qualy : linesBySession.race;

  // Helper para obtener el pick actual del usuario para un piloto
  const getUserPick = useCallback((driverName: string): 'mejor' | 'peor' | null => {
    const currentPicks = picks[currentSession]; // Acceder a los picks de la sesión actual
    if (!Array.isArray(currentPicks)) return null; // Verificar si es un array
    const pick = currentPicks.find(p => p.driver === driverName);
    return pick?.betterOrWorse ?? null;
  } , [picks, currentSession]); // Dependencias correctas


  // Helper para obtener la lista ordenada y visible de pilotos
  const getOrderedVisibleDrivers = useCallback((): string[] => {
    if (!isDataLoaded || Object.keys(driverVisibility).length === 0) {
      return []; // No mostrar nada si la visibilidad no está cargada
    }

    const visibleDrivers = staticDrivers.filter(driver => {
      const vis = driverVisibility[driver];
      return vis && (isQualyView ? vis.qualy_visible : vis.race_visible);
    });

    visibleDrivers.sort((a, b) => {
      const visA = driverVisibility[a];
      const visB = driverVisibility[b];
      const orderField = isQualyView ? 'qualy_order' : 'race_order';
      const orderA = visA?.[orderField] ?? 999;
      const orderB = visB?.[orderField] ?? 999;
      return orderA - orderB;
    });

    return visibleDrivers;
  }, [driverVisibility, isQualyView, isDataLoaded]);

  // Obtener la lista ordenada para renderizar
  const orderedDriversForDisplay = getOrderedVisibleDrivers();


  // ──────────────────────────────────────────────────────────────────────────
  // RENDER LOGIC
  // ──────────────────────────────────────────────────────────────────────────

  if (!isLoaded) {
      return <LoadingAnimation text="Cargando autenticación…" animationDuration={4} />;
  }

  const mainContainerClasses = 'min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white font-exo2';
  const driverGridClasses   = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';

  return (
    <div className={mainContainerClasses}>
      <MMCGoSubHeader />

      {/* Estado de Carga / Error */}
      {!isDataLoaded && !errors.length ? (
        <LoadingAnimation text="Cargando MMC‑GO…" animationDuration={2} />
      ) : errors.length > 0 ? (
        <div className="container mx-auto px-4 py-10 text-center">
            <p className="text-red-400 text-lg">Error al cargar los datos:</p>
            {errors.map((err, i) => <p key={i} className="text-red-500 text-sm">{err}</p>)}
            <button
                onClick={() => { setIsDataLoaded(false); fetchData(); }}
                className="mt-4 px-4 py-2 bg-amber-500 text-black font-semibold rounded hover:bg-amber-600"
            >
                Reintentar Carga
            </button>
        </div>
      ) : (
        // Contenido Principal (Datos Cargados)
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

          {/* Toggle Qualy/Race */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>
            <div className="relative mx-auto mb-6 flex h-10 w-[150px] items-center rounded-full bg-gray-800 p-1 shadow">
              <motion.span layout className="absolute h-8 w-[72px] rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" animate={{ x: isQualyView ? 0 : 74 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
              <button disabled={!isQualyEnabled} onClick={() => { if (!isQualyView && isQualyEnabled) { soundManager.click.play(); setIsQualyView(true); setSession('qualy'); } }} className={`relative z-10 flex-1 text-center text-xs font-semibold transition-colors duration-200 ${!isQualyEnabled ? 'cursor-not-allowed text-gray-500' : isQualyView ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}> Qualy </button>
              <button disabled={!isRaceEnabled} onClick={() => { if (isQualyView && isRaceEnabled) { soundManager.click.play(); setIsQualyView(false); setSession('race'); } }} className={`relative z-10 flex-1 text-center text-xs font-semibold transition-colors duration-200 ${!isRaceEnabled ? 'cursor-not-allowed text-gray-500' : !isQualyView ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}> Carrera </button>
            </div>
          </motion.div>

          {/* Grid de pilotos */}
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .2 }}>
            <div className="bg-gradient-to-br from-gray-800/50 via-black/50 to-gray-900/50 p-4 sm:p-6 rounded-xl shadow-xl border border-gray-700/50">
              <div className={driverGridClasses}>
                {orderedDriversForDisplay.length === 0 && isDataLoaded ? (
                    <p className="col-span-full text-center text-gray-400 py-8"> No hay pilotos disponibles para mostrar en esta sesión. </p>
                ) : (
                    orderedDriversForDisplay.map((driver, idx) => {
                    const vis = driverVisibility[driver];
                    const safeVis = vis || { driver, qualy_visible: isQualyView, race_visible: !isQualyView, qualy_order: 999, race_order: 999, is_hot: false, is_promo: false };
                    const line = driverLines[driver];

                    if (line === undefined && isDataLoaded) {
                        return (
                            <motion.div key={`${driver}-noline`} className="rounded-xl opacity-60" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ duration: 0.3 }}>
                                <div className="relative flex h-full flex-col items-center justify-center rounded-lg bg-gray-700/60 pt-4 shadow-md p-3 text-center">
                                    <Image src={`/images/pilots/${driver.toLowerCase().replace(/ /g, '-')}.png`} alt={driver} width={50} height={50} className="mb-2 h-12 w-12 rounded-full border border-gray-500 object-cover opacity-50" unoptimized onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/pilots/default-pilot.png'; }}/>
                                    <p className="text-sm font-semibold text-gray-300 truncate w-full px-1">{driver}</p>
                                    <p className="text-xs text-gray-400 mt-1">Línea no disp.</p>
                                </div>
                            </motion.div>
                        );
                    }
                    if (line === undefined && !isDataLoaded) return null;

                    const pick   = getUserPick(driver);
                    const imgSrc = `/images/pilots/${driver.toLowerCase().replace(/ /g, '-')}.png`;

                    return (
                      <motion.div
                        key={`${driver}-${currentSession}`}
                        layout initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .2, delay: idx * .015 }}
                        className="rounded-xl group" // Añadido group para hover en padre
                      >
                        <div className="relative flex h-full flex-col justify-between rounded-lg bg-gray-800 pt-4 shadow-lg transition duration-200 ease-in-out hover:shadow-cyan-500/20 border border-transparent group-hover:border-cyan-600/30">
                          {/* Badges y Reset */}
                          <div className="absolute top-1 left-1 right-1 z-10 flex justify-between items-start h-6">
                              <div> {safeVis.is_promo && ( <span className="rounded bg-gradient-to-r from-yellow-400 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-black shadow">PROMO</span> )} </div>
                              <div className="flex items-center gap-1">
                                  {safeVis.is_hot && ( <span className="text-lg leading-none">🔥</span> )}
                                  {pick && ( <button onClick={() => removePick(driver, currentSession)} title="Quitar pick" className="rounded-full bg-yellow-500/80 p-1 text-black hover:bg-yellow-400 transition transform hover:scale-110"> <FaSyncAlt size={10} /> </button> )}
                              </div>
                          </div>

                          {/* Info Piloto */}
                          <div className="flex flex-col items-center px-1 text-center pt-5"> {/* Added pt-5 to make space for badges */}
                            <Image src={imgSrc} alt={driver} width={80} height={80} className="mb-2 h-16 w-16 rounded-full border-2 border-gray-600 object-cover group-hover:border-cyan-500 transition-colors" unoptimized priority={idx < 10} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/pilots/default-pilot.png'; }} />
                            <h3 className="w-full px-1 text-sm font-bold text-gray-100 truncate">{driver}</h3>
                            <p className="w-full mb-1 px-1 text-xs text-indigo-400 truncate">{driverToTeam[driver] || "Equipo desc."}</p>
                            <p className="mb-2 px-1 text-xs font-semibold text-amber-400"> {isQualyView ? 'Qualy' : 'Carrera'}: <span className="text-base">{typeof line === 'number' ? line.toFixed(1) : 'N/A'}</span> </p>
                          </div>

                           {/* Botones Mejor/Peor */}
<div className="mt-auto flex w-full overflow-hidden rounded-b-lg">
  {(['mejor','peor'] as const).map(opt => {
    const selected = getUserPick(driver) === opt;
    const isBetter = opt === 'mejor';

    // 👇 vuelve a poner estas dos líneas:
    const baseClasses = 'flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-150 ease-in-out';
    const colorClasses = isBetter
      ? selected
        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-inner'
        : 'bg-gray-700/80 text-green-400 hover:bg-green-700/90 hover:text-white'
      : selected
        ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-inner'
        : 'bg-gray-700/80 text-red-400 hover:bg-red-700/90 hover:text-white';

    const Icon = isBetter ? FaCheck : FaTimes;

    return (
      <button
        key={opt}
        disabled={selected}
        onClick={() => {
          clickSound.current?.play();
          addPick({ driver, team: driverToTeam[driver] || 'N/A',
                    line: typeof line === 'number' ? line : 0,
                    betterOrWorse: opt,
                    gp_name: currentGp?.gp_name ?? '',
                    session_type: currentSession });
          trackFBEvent('Lead', { params: { content_name: `Pick_${currentSession}_${driver}_${opt}` } });
        }}
        className={`${baseClasses} ${colorClasses} ${selected ? 'cursor-default' : 'hover:scale-[1.02]'}`}
      >
        <Icon size={12}/> {isBetter ? 'Mejor' : 'Peor'}
      </button>
    );
  })}
</div>


                        </div>
                      </motion.div>
                    );
                  }) // End map
                )}
              </div> {/* End driverGridClasses */}
            </div> {/* End Section Background */}
          </motion.section>

          {/* Botón Tutorial Fijo */}
          <button onClick={() => { soundManager.click.play(); setShowTutorial(true); }} className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 p-3 text-sm font-semibold text-black shadow-xl transition hover:scale-110 hover:shadow-amber-400/40 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"> <FaQuestionCircle /> ¿Cómo jugar? </button>

          {/* === Modals === */}
          {showTutorial && ( <DynamicTutorialModal show={showTutorial} onClose={() => setShowTutorial(false)} /> )}
          <FomoBar /> 
          <StickyModal onFinish={async () => { soundManager.click.play(); if (!isSignedIn) { localStorage.setItem('pendingPicks', JSON.stringify(picks)); setShowAuthModal(true); return; } setShowFullModal(true); }} />
          {showFullModal && ( <FullModal isOpen={showFullModal} onClose={() => setShowFullModal(false)} /> )}
          <AnimatePresence>
            {showAuthModal && ( <Transition appear show={showAuthModal} as={Fragment}> <Dialog as="div" className="relative z-[90]" onClose={() => setShowAuthModal(false)}> <Transition.Child as={Fragment} {...{/* Overlay */} }> <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" /> </Transition.Child> <div className="fixed inset-0 flex items-center justify-center p-4"> <Transition.Child as={Fragment} {...{/* Panel */} }> <Dialog.Panel className="mx-auto max-w-sm w-full rounded-xl bg-gradient-to-br from-gray-800 to-black border border-amber-500/30 p-6 text-white shadow-xl text-center"> <Dialog.Title className="text-lg font-bold mb-2 text-amber-400">Inicia sesión o Regístrate</Dialog.Title> <Dialog.Description className="text-sm mb-4 text-gray-300"> Para guardar y confirmar tus picks en MMC GO, necesitas una cuenta. ¡Es rápido y gratis! Tus selecciones actuales se guardarán. </Dialog.Description> <button onClick={() => { router.push(`/sign-in?redirect_url=${encodeURIComponent('/mmc-go')}`); }} className="w-full px-4 py-2.5 mb-2 bg-amber-500 text-black font-bold rounded-md hover:bg-amber-400 transition-colors duration-200 shadow hover:shadow-lg"> Iniciar sesión / Registrarse </button> <button onClick={() => setShowAuthModal(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-200"> Cancelar </button> </Dialog.Panel> </Transition.Child> </div> </Dialog> </Transition> )}
            {showRealtimeModal && ( <Transition appear show={showRealtimeModal} as={Fragment}> <Dialog as="div" className="relative z-[90]" onClose={() => setShowRealtimeModal(false)}> <Transition.Child as={Fragment} {...{/* Overlay */} }> <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" /> </Transition.Child> <div className="fixed inset-0 flex items-center justify-center p-4"> <Transition.Child as={Fragment} {...{/* Panel */} }> <Dialog.Panel className="mx-auto max-w-xs w-full rounded-xl bg-gradient-to-br from-gray-800 to-black border border-cyan-500/30 p-6 text-white shadow-xl text-center"> <Dialog.Title className="text-lg font-bold text-cyan-400 flex items-center justify-center gap-2"><span className="text-xl">⚡</span> Estado Actualizado</Dialog.Title> <Dialog.Description className="mt-2 text-sm text-gray-300"> La disponibilidad de picks (Qualy/Carrera) ha sido actualizada. </Dialog.Description> <div className="mt-4"> <button onClick={() => setShowRealtimeModal(false)} className="w-full px-4 py-2 text-sm font-medium bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors duration-200 shadow"> Entendido </button> </div> </Dialog.Panel> </Transition.Child> </div> </Dialog> </Transition> )}
          </AnimatePresence>
          {/* === End Modals === */}

        </main>
      )} {/* End Main Content Render */}
    </div> // End Main Container Div
  ); // End Component Return
} // End MMCGoContent Component