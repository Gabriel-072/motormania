'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Header from '@/components/Header';
import LoadingAnimation from '@/components/LoadingAnimation';
import StickyModal from '@/components/StickyModal';
import FullModal from '@/components/FullModal';
import { createAuthClient } from '@/lib/supabase';
import { useStickyStore } from '@/stores/stickyStore';
import { Howl } from 'howler';
import { PickSelection } from '@/app/types/picks';
import { toast } from 'sonner';
import { Dialog } from '@headlessui/react';
import { useRouter } from 'next/navigation';

// TYPES
type SessionType = 'qualy' | 'race';

interface GpSchedule {
  gp_name: string;
  race_time: string;
}

interface PicksConfig {
  id: string;
  is_qualy_enabled: boolean;
  is_race_enabled: boolean;
  updated_at?: string;
}

// Driver to Team Mapping
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
  'Jack Doohan': 'Alpine',
  'Alex Albon': 'Williams',
  'Carlos Sainz': 'Williams',
  'Oliver Bearman': 'Haas F1 Team',
  'Esteban Ocon': 'Haas F1 Team',
};

const staticDrivers: string[] = Object.keys(driverToTeam);

// Animated Border Configurations per Driver
const driverBorderStyles: Record<string, { gradient: string; speed: string; direction: string }> = {
  'Max Verstappen': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e3a8a 20deg, #38bdf8 30deg, #1e3a8a 40deg, transparent 50deg, transparent 360deg)',
    speed: '3s',
    direction: 'normal',
  },
  'Yuki Tsunoda': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e3a8a 20deg, #60a5fa 30deg, #1e3a8a 40deg, transparent 50deg, transparent 360deg)',
    speed: '5.5s',
    direction: 'reverse',
  },
  'Lando Norris': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #ea580c 20deg, #facc15 30deg, #ea580c 40deg, transparent 50deg, transparent 360deg)',
    speed: '3s',
    direction: 'normal',
  },
  'Oscar Piastri': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #ea580c 20deg, #fef08a 30deg, #ea580c 40deg, transparent 50deg, transparent 360deg)',
    speed: '4s',
    direction: 'reverse',
  },
  'Lewis Hamilton': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #b91c1c 20deg, #f87171 30deg, #b91c1c 40deg, transparent 50deg, transparent 360deg)',
    speed: '5s',
    direction: 'normal',
  },
  'Charles Leclerc': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #b91c1c 20deg, #fca5a5 30deg, #b91c1c 40deg, transparent 50deg, transparent 360deg)',
    speed: '4s',
    direction: 'reverse',
  },
  'George Russell': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #0d9488 20deg, #22d3ee 30deg, #0d9488 40deg, transparent 50deg, transparent 360deg)',
    speed: '5s',
    direction: 'normal',
  },
  'Kimi Antonelli': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #0d9488 20deg, #67e8f9 30deg, #0d9488 40deg, transparent 50deg, transparent 360deg)',
    speed: '4.5s',
    direction: 'reverse',
  },
  'Fernando Alonso': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #15803d 20deg, #86efac 30deg, #15803d 40deg, transparent 50deg, transparent 360deg)',
    speed: '6s',
    direction: 'normal',
  },
  'Lance Stroll': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #15803d 20deg, #4ade80 30deg, #15803d 40deg, transparent 50deg, transparent 360deg)',
    speed: '5.5s',
    direction: 'reverse',
  },
  'Liam Lawson': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e40af 20deg, #60a5fa 30deg, #1e40af 40deg, transparent 50deg, transparent 360deg)',
    speed: '4.3s',
    direction: 'normal',
  },
  'Isack Hadjar': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e40af 20deg, #93c5fd 30deg, #1e40af 40deg, transparent 50deg, transparent 360deg)',
    speed: '5.7s',
    direction: 'reverse',
  },
  'Nico Hulkenberg': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #86efac 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)',
    speed: '6s',
    direction: 'normal',
  },
  'Gabriel Bortoleto': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #4ade80 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)',
    speed: '4.5s',
    direction: 'reverse',
  },
  'Pierre Gasly': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e3a8a 20deg, #db2777 30deg, #1e3a8a 40deg, transparent 50deg, transparent 360deg)',
    speed: '5.5s',
    direction: 'normal',
  },
  'Jack Doohan': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e3a8a 20deg, #f9a8d4 30deg, #1e3a8a 40deg, transparent 50deg, transparent 360deg)',
    speed: '7s',
    direction: 'reverse',
  },
  'Alex Albon': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e40af 20deg, #60a5fa 30deg, #1e40af 40deg, transparent 50deg, transparent 360deg)',
    speed: '4.7s',
    direction: 'normal',
  },
  'Carlos Sainz': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e40af 20deg, #93c5fd 30deg, #1e40af 40deg, transparent 50deg, transparent 360deg)',
    speed: '3.5s',
    direction: 'reverse',
  },
  'Oliver Bearman': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #4b5563 20deg, #9ca3af 30deg, #4b5563 40deg, transparent 50deg, transparent 360deg)',
    speed: '6s',
    direction: 'normal',
  },
  'Esteban Ocon': {
    gradient: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #4b5563 20deg, #d1d5db 30deg, #4b5563 40deg, transparent 50deg, transparent 360deg)',
    speed: '4.5s',
    direction: 'reverse',
  },
};

const soundManager = {
  click: new Howl({ src: ['/sounds/f1-click.mp3'], volume: 0.4 }),
  rev: new Howl({ src: ['/sounds/f1-rev.mp3'], volume: 0.3 }),
};

export default function MMCGoContent() {
  const { getToken } = useAuth();
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
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
  const channelRef = useRef<any>(null);
  const hasPlayedRev = useRef(false);

  const {
    picks,
    currentSession,
    setSession,
    addPick,
    removePick,
    setShowSticky,
    setMultiplier,
    setPotentialWin,
  } = useStickyStore();

  // Restore picks from localStorage after login
  useEffect(() => {
    if (isSignedIn) {
      const savedPicks = localStorage.getItem('pendingPicks');
      if (savedPicks) {
        try {
          const restoredPicks = JSON.parse(savedPicks);
          useStickyStore.setState({ picks: restoredPicks });
          setShowFullModal(true);
          localStorage.removeItem('pendingPicks'); // Clear after restoration
        } catch (error) {
          console.error('Error restoring picks:', error);
          localStorage.removeItem('pendingPicks'); // Clear on error to prevent stale data
        }
      }
    }
  }, [isSignedIn]);

  const fetchData = async () => {
    try {
      console.log('🟡 fetchData iniciado...');
      let token: string | null = null;
      if (isSignedIn) {
        token = await getToken({ template: 'supabase' });
        if (!token) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          token = await getToken({ template: 'supabase' });
          if (!token) throw new Error('Token no encontrado');
        }
      }
      const supabase = createAuthClient(token);

      const { data: configData, error: configError } = await supabase
        .from('picks_config')
        .select('is_qualy_enabled, is_race_enabled')
        .eq('id', 'main')
        .single();
      if (configError) throw configError;
      setIsQualyEnabled(configData.is_qualy_enabled);
      setIsRaceEnabled(configData.is_race_enabled);

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('gp_schedule')
        .select('*')
        .order('race_time');
      if (scheduleError) throw new Error(scheduleError.message);

      const now = new Date();
      const current = scheduleData?.find((gp: GpSchedule) => new Date(gp.race_time) > now);
      if (!current) throw new Error('No se encontró un GP válido');
      setCurrentGp(current);

      const { data: linesData, error: linesError } = await supabase
        .from('lines')
        .select('driver, line')
        .eq('gp_name', current.gp_name)
        .eq('session_type', isQualyView ? 'qualy' : 'race');
      if (linesError) throw new Error(linesError.message);

      const map: Record<string, number> = {};
      linesData?.forEach(({ driver, line }) => {
        map[driver] = line;
      });
      setDriverLines(map);

      console.log('🎯 Datos cargados exitosamente:', {
        configData,
        currentGp: current.gp_name,
        lines: map,
      });

      setIsDataLoaded(true);
    } catch (err: any) {
      console.error('❌ Error en fetchData:', err);
      setErrors([err.message || 'Error inesperado']);
      setIsDataLoaded(true);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => fetchData(), 500);
    return () => clearTimeout(timer);
  }, [isLoaded, isQualyView]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let mounted = true;

    const subscribeToConfig = async () => {
      try {
        let token = await getToken({ template: 'supabase' });
        if (!token) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          token = await getToken({ template: 'supabase' });
          if (!token) throw new Error('Token no encontrado');
        }
        const supabase = createAuthClient(token);

        const channel = supabase
          .channel('realtime-picks-config')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'picks_config',
              filter: 'id=eq.main',
            },
            (payload) => {
              if (!mounted) return;
              const updated = payload.new as PicksConfig;
              setIsQualyEnabled(updated.is_qualy_enabled);
              setIsRaceEnabled(updated.is_race_enabled);
              setShowRealtimeModal(true);
              toast.success('⚡ Picks actualizados sin recargar');
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        console.error('❌ Error en la suscripción a Realtime:', err);
      }
    };

    subscribeToConfig();

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const totalPicks = picks.qualy.length + picks.race.length;
    setShowSticky(totalPicks >= 2);
  }, [picks.qualy, picks.race, setShowSticky]);

  useEffect(() => {
    const totalPicks = picks.qualy.length + picks.race.length;
    const payoutCombos: Record<number, number> = { 2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100 };
    const multiplier = payoutCombos[totalPicks] || 0;
    setMultiplier(multiplier);
    setPotentialWin(multiplier * 10000);
  }, [picks.qualy, picks.race, setMultiplier, setPotentialWin]);

  useEffect(() => {
    if (isDataLoaded && !hasPlayedRev.current) {
      soundManager.rev.play();
      hasPlayedRev.current = true;
      console.log('Sonido rev reproducido');
    }
  }, [isDataLoaded]);

  const getUserPick = (driver: string) => {
    return picks[currentSession].find((p) => p.driver === driver)?.betterOrWorse || null;
  };

  const handlePick = (driver: string, betterOrWorse: 'mejor' | 'peor') => {
    if (!currentGp) return;

    soundManager.click.play();

    const line = driverLines[driver] ?? 10.5;
    const team = driverToTeam[driver] || 'Default';

    const newPick: PickSelection = {
      driver,
      team,
      line,
      betterOrWorse,
      gp_name: currentGp.gp_name,
      session_type: currentSession,
    };

    const success = addPick(newPick);
    if (!success) {
      alert('Máximo 8 picks combinados entre Qualy y Carrera.');
    }
  };

  const handleReset = (driver: string) => {
    soundManager.click.play();
    removePick(driver, currentSession);
  };

  if (!isLoaded) {
    return <LoadingAnimation text="Cargando autenticación..." animationDuration={4} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white font-exo2">
      <Header />
      {!isDataLoaded ? (
        <LoadingAnimation text="Cargando MMC-GO..." animationDuration={3} />
      ) : (
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold">MMC-GO: Picks</h1>
            <p className="text-sm text-gray-300">Selecciona pilotos para tu PICK</p>
          </div>

          {errors.length > 0 && (
            <div className="text-red-400 text-center mb-4">
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}

          {picks.qualy.length + picks.race.length === 1 && (
            <div className="text-center text-sm text-amber-400 mb-4">
              Selecciona 1 pick más para activar tu jugada.
            </div>
          )}

          <div className="flex justify-center gap-4 mb-6">
            {isQualyEnabled ? (
              <button
                onClick={() => {
                  setIsQualyView(true);
                  setSession('qualy');
                }}
                className={`px-4 py-2 rounded ${isQualyView ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Qualy
              </button>
            ) : (
              <span className="px-4 py-2 rounded bg-gray-800 text-gray-500 cursor-not-allowed">
                Qualy (Desactivado)
              </span>
            )}

            {isRaceEnabled ? (
              <button
                onClick={() => {
                  setIsQualyView(false);
                  setSession('race');
                }}
                className={`px-4 py-2 rounded ${!isQualyView ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Carrera
              </button>
            ) : (
              <span className="px-4 py-2 rounded bg-gray-800 text-gray-500 cursor-not-allowed">
                Carrera (Desactivado)
              </span>
            )}
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg">
            <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {staticDrivers.map((driver) => {
                const image = `/images/pilots/${driver.toLowerCase().replace(/ /g, '-')}.png`;
                const team = driverToTeam[driver] || 'Default';
                const pick = getUserPick(driver);
                const line = driverLines[driver];
                const borderStyle = driverBorderStyles[driver];

                return (
                  <div
                    key={driver}
                    className="animate-rotate-border rounded-lg p-px"
                    style={{
                      background: borderStyle.gradient,
                      animationDuration: borderStyle.speed,
                      animationDirection: borderStyle.direction,
                    }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="relative bg-gray-800 p-4 rounded-lg shadow-md text-center transition-all duration-200"
                    >
                      {pick && (
                        <button
                          onClick={() => handleReset(driver)}
                          className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded hover:bg-yellow-600 transition-colors"
                          title="Resetear selección"
                        >
                          Reset
                        </button>
                      )}
                      <Image src={image} alt={driver} width={64} height={64} className="mx-auto rounded-full" />
                      <h3 className="text-sm font-bold mt-2">{driver}</h3>
                      <p className="text-xs text-gray-300">{team}</p>
                      <p className="text-xs text-amber-400">
                        {isQualyView ? 'Qualy' : 'Carrera'}: {line?.toFixed(1)}
                      </p>
                      <div className="flex justify-center gap-2 mt-2">
                        <button
                          onClick={() => handlePick(driver, 'mejor')}
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            pick === 'mejor' ? 'bg-green-500' : 'bg-gray-700'
                          }`}
                        >
                          Mejor
                        </button>
                        <button
                          onClick={() => handlePick(driver, 'peor')}
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            pick === 'peor' ? 'bg-red-500' : 'bg-gray-700'
                          }`}
                        >
                          Peor
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </section>
          </div>

          <StickyModal
            onFinish={async () => {
              if (!isSignedIn) {
                setShowAuthModal(true);
                return;
              }
              setShowFullModal(true);
            }}
          />
          {showFullModal && <FullModal isOpen={showFullModal} onClose={() => setShowFullModal(false)} />}

          {showAuthModal && (
            <Dialog open={true} onClose={() => setShowAuthModal(false)} className="relative z-50">
              <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
              <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-sm rounded-xl bg-white p-6 text-black shadow-xl text-center">
                  <Dialog.Title className="text-lg font-bold mb-2">Inicia sesión</Dialog.Title>
                  <Dialog.Description className="text-sm mb-4 text-gray-600">
                    Debes iniciar sesión para confirmar tus picks en MMC GO.
                  </Dialog.Description>
                  <button
                    onClick={() => {
                      console.log('Initiating sign-in redirect to /sign-in?redirect_url=/mmc-go'); // Debug log
                      localStorage.setItem('pendingPicks', JSON.stringify(picks));
                      router.push(`/sign-in?redirect_url=${encodeURIComponent('/mmc-go')}`);
                    }}
                    className="px-4 py-2 bg-black text-white rounded hover:bg-gray-900 transition"
                  >
                    Iniciar sesión
                  </button>
                </Dialog.Panel>
              </div>
            </Dialog>
          )}

          {showRealtimeModal && (
            <Dialog open={true} onClose={() => setShowRealtimeModal(false)} className="relative z-50">
              <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
              <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-sm rounded-xl bg-white p-6 text-black shadow-xl">
                  <Dialog.Title className="text-lg font-bold">⚡ Estado actualizado</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-gray-700">
                    Picks habilitados o deshabilitados en tiempo real.
                  </Dialog.Description>
                  <div className="mt-4 text-right">
                    <button
                      onClick={() => setShowRealtimeModal(false)}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Entendido
                    </button>
                  </div>
                </Dialog.Panel>
              </div>
            </Dialog>
          )}
        </main>
      )}
    </div>
  );
}