'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { toast, Toaster } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createAuthClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import LoadingAnimation from '@/components/LoadingAnimation';
import LeaderboardsSectionVip from '../../components/LeaderboardsSectionVip';
import useFantasyLeaderboardsVip from '../../hooks/useFantasyLeaderboardsVip';
import LastGpBreakdownVip from '../../components/LastGpBreakdownVip';
import { Dialog, Transition } from '@headlessui/react';
import { Howl } from 'howler';

// Types
type Prediction = {
  gp_name: string;
  pole1: string;
  pole2: string;
  pole3: string;
  gp1: string;
  gp2: string;
  gp3: string;
  fastest_pit_stop_team: string;
  fastest_lap_driver: string;
  driver_of_the_day: string;
  first_team_to_pit: string;
  first_retirement: string;
  submitted_at: string;
};

type PredictionScore = {
  gp_name: string;
  race_date: string;
  score: number;
};

type RaceResult = {
  gp_name: string;
  race_date: string;
  pole1: string;
  pole2: string;
  pole3: string;
  gp1: string;
  gp2: string;
  gp3: string;
  fastest_pit_stop_team: string;
  fastest_lap_driver: string;
  driver_of_the_day: string;
  first_team_to_pit: string;
  first_retirement: string;
};

type GpSchedule = {
  gp_name: string;
  qualy_time: string;
  race_time: string;
};

type LeaderboardEntry = {
  user_id: string;
  name: string;
  score: number;
  updated_at: string;
  quiz_completed: boolean;
  signup_bonus_claimed: boolean;
};

// Team Colors
const teamColors: Record<string, { gradientFrom: string; gradientTo: string; border: string }> = {
  'Red Bull Racing': { gradientFrom: 'from-blue-950', gradientTo: 'to-blue-600', border: 'border-blue-400/60' },
  McLaren: { gradientFrom: 'from-orange-800', gradientTo: 'to-orange-500', border: 'border-orange-400/60' },
  Mercedes: { gradientFrom: 'from-teal-800', gradientTo: 'to-cyan-400', border: 'border-cyan-300/60' },
  Ferrari: { gradientFrom: 'from-red-900', gradientTo: 'to-red-500', border: 'border-red-400/60' },
  'Aston Martin': { gradientFrom: 'from-emerald-900', gradientTo: 'to-emerald-500', border: 'border-emerald-400/60' },
  RB: { gradientFrom: 'from-indigo-900', gradientTo: 'to-indigo-500', border: 'border-indigo-400/60' },
  'Haas F1 Team': { gradientFrom: 'from-gray-800', gradientTo: 'to-red-600', border: 'border-red-500/60' },
  Alpine: { gradientFrom: 'from-blue-900', gradientTo: 'to-blue-400', border: 'border-blue-300/60' },
  Williams: { gradientFrom: 'from-blue-800', gradientTo: 'to-sky-400', border: 'border-sky-300/60' },
  Sauber: { gradientFrom: 'from-green-900', gradientTo: 'to-lime-500', border: 'border-lime-400/60' },
  Default: { gradientFrom: 'from-gray-800', gradientTo: 'to-gray-400', border: 'border-gray-300/60' },
};

// Driver to Team Mapping
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

// Helper Functions
const getDriverImage = (driverName: string): string => {
  if (!driverName) return '/images/pilots/default-driver.png';
  const normalizedName = driverName.trim().replace(' ', '-').toLowerCase();
  return `/images/pilots/${normalizedName}.png`;
};

const getTeamCarImage = (teamName: string): string => {
  if (!teamName) return '/images/cars/default-car.png';
  const slug = teamName.toLowerCase().replace(/\s+/g, '-');
  return `/images/cars/${slug}.png`;
};

// Components
const EmptyStateCard = ({ title, message, icon, action }: { 
  title: string; 
  message: string; 
  icon: string;
  action?: { label: string; href: string };
}) => (
  <div className="bg-gray-800/50 rounded-xl p-8 text-center">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-lg font-bold text-gray-300 mb-2">{title}</h3>
    <p className="text-gray-500 text-sm mb-4">{message}</p>
    {action && (
      <Link 
        href={action.href}
        className="inline-block px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-semibold transition"
      >
        {action.label}
      </Link>
    )}
  </div>
);

const SkeletonCard = ({ height = 'h-40' }: { height?: string }) => (
  <div className="animate-pulse">
    <div className={`bg-gray-800/50 rounded-xl p-4 ${height}`}>
      <div className="h-4 bg-gray-700 rounded w-1/3 mb-3"></div>
      <div className="h-8 bg-gray-700 rounded w-2/3 mb-3"></div>
      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
    </div>
  </div>
);

const ConnectionIndicator = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const checkConnection = () => {
      const wasOffline = !isOnline;
      setIsOnline(navigator.onLine);
      if (navigator.onLine && wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    
    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-red-600 text-white py-2 px-4 text-center z-50 text-sm">
        Sin conexión - Trabajando sin conexión
      </div>
    );
  }

  if (showReconnected) {
    return (
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed top-0 left-0 right-0 bg-green-600 text-white py-2 px-4 text-center z-50 text-sm"
      >
        ¡Conexión restaurada!
      </motion.div>
    );
  }

  return null;
};

const SafeImage = ({ src, alt, fallback = '/images/default-driver.png', ...props }: any) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  
  return (
    <Image
      {...props}
      src={hasError ? fallback : imgSrc}
      alt={alt}
      onError={() => {
        setHasError(true);
        setImgSrc(fallback);
      }}
    />
  );
};

export default function F1FantasyPanel() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  
  // State
  const [seasonScore, setSeasonScore] = useState<number | null>(null);
  const [gpScore, setGpScore] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [pastPredictions, setPastPredictions] = useState<Prediction[]>([]);
  const [pastScores, setPastScores] = useState<PredictionScore[]>([]);
  const [scoreMap, setScoreMap] = useState<Map<string, number>>(new Map());
  const [previousResults, setPreviousResults] = useState<RaceResult | null>(null);
  const [gpSchedule, setGpSchedule] = useState<GpSchedule[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [loadingDuration, setLoadingDuration] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [signupBonusClaimed, setSignupBonusClaimed] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<string[]>(Array(5).fill(''));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [top10LastGP, setTop10LastGP] = useState<{ name: string; score: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  
  const clickSound = new Howl({ src: ['/sounds/f1-click.mp3'], volume: 5, preload: true });
  const { lastGpName } = useFantasyLeaderboardsVip();

  // Quiz Questions
  const quizQuestions = [
    {
      question: '¿Quién ganó el campeonato de F1 en 2021?',
      options: ['Lewis Hamilton', 'Max Verstappen', 'Charles Leclerc'],
      correctAnswer: 'Max Verstappen',
    },
    {
      question: '¿Qué equipo ha ganado más títulos de constructores?',
      options: ['McLaren', 'Ferrari', 'Mercedes'],
      correctAnswer: 'Ferrari',
    },
    {
      question: '¿En qué circuito se corre el GP de Mónaco?',
      options: ['Monza', 'Monte Carlo', 'Silverstone'],
      correctAnswer: 'Monte Carlo',
    },
    {
      question: '¿Quién tiene el récord de más victorias en F1?',
      options: ['Michael Schumacher', 'Lewis Hamilton', 'Sebastian Vettel'],
      correctAnswer: 'Lewis Hamilton',
    },
    {
      question: '¿En qué año comenzó la Fórmula 1 moderna?',
      options: ['1950', '1960', '1970'],
      correctAnswer: '1950',
    },
  ];

  // Helper Functions
  const getUserName = (): string => {
    if (!user) return 'Usuario Desconocido';
    return user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario Desconocido';
  };

  const validatePredictions = (pred: any): boolean => {
    return !!(
      pred.pole1 || pred.pole2 || pred.pole3 ||
      pred.gp1 || pred.gp2 || pred.gp3 ||
      pred.fastest_pit_stop_team || pred.fastest_lap_driver ||
      pred.driver_of_the_day || pred.first_team_to_pit ||
      pred.first_retirement
    );
  };

  // Quiz Handlers
  const handleQuizAnswer = (answer: string) => {
    const newAnswers = [...quizAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setQuizAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleQuizSubmit = async () => {
    if (!user) {
      toast.error('Debes estar autenticado para enviar el quiz.');
      return;
    }

    if (quizAnswers.some((answer) => !answer)) {
      toast.error('Por favor, responde todas las preguntas antes de enviar.');
      return;
    }

    const allCorrect = quizAnswers.every((answer, i) => answer === quizQuestions[i].correctAnswer);
    const token = await getToken({ template: 'supabase' });

    if (!token) {
      toast.error('Error de autenticación. Intenta de nuevo más tarde.');
      return;
    }

    const supabase = createAuthClient(token);
    const userId = user.id;

    if (allCorrect) {
      try {
        const { data, error } = await supabase
          .from('vip_leaderboard')
          .select('score, quiz_completed')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          toast.error(`Error al obtener datos: ${error.message}`);
          return;
        }

        if (!data) {
          const userName = getUserName();
          const { error: insertError } = await supabase.from('vip_leaderboard').insert({
            user_id: userId,
            name: userName,
            score: 10,
            quiz_completed: true,
            signup_bonus_claimed: false,
          });

          if (insertError) {
            toast.error(`No pudimos guardar tus puntos: ${insertError.message}`);
            return;
          }

          setSeasonScore(10);
        } else if (!data.quiz_completed) {
          const currentScore = data.score ?? 0;
          const newScore = currentScore + 10;

          const { error: updateError } = await supabase
            .from('vip_leaderboard')
            .update({ score: newScore, quiz_completed: true })
            .eq('user_id', userId);

          if (updateError) {
            toast.error(`No pudimos guardar tus puntos: ${updateError.message}`);
            return;
          }

          setSeasonScore(newScore);
        }

        setQuizCompleted(true);
        setShowQuizModal(false);
        setQuizAnswers(Array(5).fill(''));
        setCurrentQuestionIndex(0);
        toast.success('¡Felicidades! Has ganado 10 puntos extra.');
      } catch (err) {
        toast.error('Error al procesar el quiz. Intenta de nuevo.');
      }
    } else {
      toast.error('No todas las respuestas son correctas. ¡Intenta de nuevo!');
    }
  };

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (!user || !isSignedIn) return;

    const startTime = performance.now();
    const minDuration = 3000;
    setSectionErrors({});

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación.');

      const supabase = createAuthClient(token);
      const userId = user.id;
      const userName = getUserName();

      // Fetch all data with individual error handling
      const results = await Promise.allSettled([
        supabase.from('vip_leaderboard').select('*').eq('user_id', userId).single(),
        supabase.from('vip_predictions').select('*').eq('user_id', userId).order('submitted_at', { ascending: false }),
        supabase.from('vip_prediction_scores').select('gp_name, race_date, score').eq('user_id', userId).order('race_date', { ascending: false }),
        supabase.from('gp_schedule').select('*').order('race_time', { ascending: true }),
        supabase.from('top10_last_gp').select('*'),
      ]);

      // Handle leaderboard data
      if (results[0].status === 'fulfilled') {
        const { data: leaderboardData, error: leaderboardError } = results[0].value;
        
        if (leaderboardError && leaderboardError.code === 'PGRST116') {
          // New user
          const { error: insertError } = await supabase.from('vip_leaderboard').insert({
            user_id: userId,
            name: userName,
            score: 0,
            quiz_completed: false,
            signup_bonus_claimed: false,
          });

          if (!insertError) {
            setSeasonScore(0);
            setQuizCompleted(false);
            setSignupBonusClaimed(false);
          }
        } else if (!leaderboardError && leaderboardData) {
          setSeasonScore(leaderboardData.score ?? 0);
          setQuizCompleted(leaderboardData.quiz_completed ?? false);
          setSignupBonusClaimed(leaderboardData.signup_bonus_claimed ?? false);
          
          if (leaderboardData.score != null) {
            const { count } = await supabase
              .from('vip_leaderboard')
              .select('user_id', { head: true, count: 'exact' })
              .gt('score', leaderboardData.score);
            setMyRank((count ?? 0) + 1);
          }
        }
      } else {
        setSectionErrors(prev => ({ ...prev, leaderboard: 'Error al cargar puntajes' }));
      }

      // Handle predictions data
      if (results[1].status === 'fulfilled') {
        const { data: predictionsData } = results[1].value;
        setPastPredictions(predictionsData || []);
      } else {
        setSectionErrors(prev => ({ ...prev, predictions: 'Error al cargar predicciones' }));
      }

      // Handle scores data
      if (results[2].status === 'fulfilled') {
        const { data: scoresData } = results[2].value;
        setPastScores(scoresData || []);
        
        if (scoresData && scoresData.length > 0) {
          setGpScore(scoresData[0].score ?? null);
        } else {
          setGpScore(null);
        }
        
        const map = new Map<string, number>();
        scoresData?.forEach((score) => {
          map.set(score.gp_name, score.score);
        });
        setScoreMap(map);
      }

      // Handle schedule data
      if (results[3].status === 'fulfilled') {
        const { data: scheduleData } = results[3].value;
        setGpSchedule(scheduleData || []);

        // Get previous race results
        const now = new Date();
        let previousGpIndex = -1;

        for (let i = 0; i < (scheduleData?.length ?? 0); i++) {
          const raceDate = new Date(scheduleData![i].race_time);
          if (raceDate < now) {
            previousGpIndex = i;
          }
        }

        if (previousGpIndex >= 0 && scheduleData) {
          const previousGp = scheduleData[previousGpIndex];
          const raceDateStr = scheduleData[previousGpIndex].race_time.split('T')[0];

          const { data: resultsData } = await supabase
            .from('race_results')
            .select('*')
            .eq('gp_name', previousGp.gp_name)
            .eq('race_date', raceDateStr)
            .maybeSingle();

          setPreviousResults(resultsData || null);
        }
      }

      // Handle top 10 data
      if (results[4].status === 'fulfilled') {
        const { data: top10Data } = results[4].value;
        setTop10LastGP(top10Data || []);
      }

    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Error al cargar los datos. Por favor, recarga la página.');
    } finally {
      const elapsed = performance.now() - startTime;
      const duration = Math.max(elapsed / 1000, 3);
      setLoadingDuration(duration);
      
      if (elapsed < minDuration) {
        setTimeout(() => setIsDataLoaded(true), minDuration - elapsed);
      } else {
        setIsDataLoaded(true);
      }
      setRefreshing(false);
    }
  }, [getToken, isSignedIn, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleGoToPredictions = () => {
    router.push('/fantasy-vip');
  };

  useEffect(() => {
    if (!isSignedIn || !user) return;
    fetchData();
  }, [isSignedIn, user, fetchData]);

  // Result Card Component
  const ResultCard = ({ 
    title, 
    driver, 
    icon, 
    iconColor, 
    gpName,
    animation 
  }: any) => {
    if (!driver) {
      return (
        <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 p-6 h-40 flex items-center justify-center">
          <div className="text-center">
            <span className={`text-3xl ${iconColor} mb-2 block`}>{icon}</span>
            <p className="text-gray-500 text-sm font-semibold">{title}</p>
            <p className="text-gray-600 text-xs mt-1">Sin datos disponibles</p>
          </div>
        </div>
      );
    }

    const team = driverToTeam[driver];
    const colors = team && teamColors[team] ? teamColors[team] : teamColors.Default;

    return (
      <div className={`animate-rotate-border rounded-xl p-px`} style={animation}>
        <motion.div
          className={`relative p-3 sm:p-4 pb-0 rounded-xl shadow-lg z-10 bg-gradient-to-br h-40 overflow-hidden ${colors.gradientFrom} ${colors.gradientTo}`}
        >
          <div className="absolute inset-0 bg-gradient-to-bl from-black/70 via-black/40 to-transparent z-0 pointer-events-none" />
          <div className="relative z-10 pr-[35%] sm:pr-[40%] flex flex-col justify-center h-full space-y-1">
            <div className="flex items-center gap-2">
              <span className={`${iconColor} text-lg sm:text-xl drop-shadow-md`}>{icon}</span>
              <p className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight drop-shadow-md">
                {title}: {driver.split(' ')[1]}
              </p>
            </div>
            <p className="text-xs sm:text-sm text-gray-200 font-exo2 leading-tight drop-shadow-md">
              {gpName}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-300 font-exo2 leading-tight drop-shadow-md">
              {team || 'Equipo Desconocido'}
            </p>
          </div>
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="absolute bottom-0 right-[-5px] w-[70%] sm:w-[75%] max-w-[200px] h-full"
          >
            <SafeImage
              src={getDriverImage(driver)}
              alt={driver}
              fill
              sizes="(max-width: 640px) 70vw, (max-width: 840px) 75vw, 200px"
              className="object-contain object-bottom drop-shadow-xl"
            />
          </motion.div>
        </motion.div>
      </div>
    );
  };

  // Loading State
  if (!isLoaded || !isDataLoaded) {
    return <LoadingAnimation animationDuration={loadingDuration} />;
  }

  // Not Signed In
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso Requerido</h1>
          <p className="text-xl font-exo2 mb-6">Por favor, inicia sesión para ver tu panel de F1 Fantasy.</p>
          <Link href="/sign-in" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-semibold transition">
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  // Main Render
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white overflow-hidden relative">
      <ConnectionIndicator />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        {/* Score Summary Card */}
        <div className="relative rounded-xl shadow-2xl bg-gradient-to-br from-gray-800 to-black border border-gray-700/80 hover:border-amber-400/80 transition-colors duration-300 mb-6">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-black/30 to-black/70 backdrop-blur-md z-0 pointer-events-none rounded-xl opacity-80" />
          <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 pointer-events-none z-10" />
          
          <div className="relative z-20 flex flex-col justify-between h-40 p-4 sm:p-6">
            <motion.h2
              className="text-sm sm:text-base font-bold text-neutral-200 font-exo2 uppercase tracking-wider leading-tight mb-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Resumen de Puntaje
            </motion.h2>

            <div className="grid grid-cols-2 place-items-center flex-grow gap-3">
              <div className="text-center">
                <p className="text-xs sm:text-sm text-gray-400 font-exo2 uppercase tracking-wide">Temporada</p>
                <div className="relative">
                  {seasonScore !== null ? (
                    <>
                      <span className="text-3xl sm:text-4xl font-bold text-amber-400 font-exo2">
                        {seasonScore}
                      </span>
                      <span className="absolute -top-1 -right-2 text-lg sm:text-xl font-bold text-amber-500/80 font-exo2">pts</span>
                      <div className="absolute inset-0 text-amber-400 blur-md opacity-30 -z-10">
                        {seasonScore}
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl text-gray-600">—</div>
                  )}
                </div>
                {myRank != null ? (
                  <p className="text-xs text-gray-500 font-exo2 mt-1">#{myRank} global</p>
                ) : seasonScore === 0 ? (
                  <p className="text-xs text-gray-600 font-exo2 mt-1">Sin ranking</p>
                ) : null}
              </div>

              <div className="text-center">
                <p className="text-xs sm:text-sm text-gray-400 font-exo2 uppercase tracking-wide">Último GP</p>
                <div className="relative">
                  {gpScore !== null ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold text-emerald-400 font-exo2">
                        {gpScore}
                      </span>
                      <span className="absolute -top-1 -right-2 text-md sm:text-lg font-bold text-emerald-500/80 font-exo2">pts</span>
                      <div className="absolute inset-0 text-emerald-400 blur-sm opacity-30 -z-10">
                        {gpScore}
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl text-gray-600">—</div>
                  )}
                </div>
              </div>
            </div>

            {/* No data message */}
            {seasonScore === null && gpScore === null && (
              <div className="absolute inset-0 bg-gray-900/80 rounded-xl flex items-center justify-center">
                <p className="text-gray-400 text-sm text-center px-4">
                  Aún no tienes puntajes registrados.<br/>
                  <Link href="/fantasy-vip" className="text-amber-400 underline hover:no-underline">
                    ¡Haz tu primera predicción!
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-700 my-6" />

        {/* Last GP Breakdown */}
        {sectionErrors.breakdown ? (
          <div className="mb-8 bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">{sectionErrors.breakdown}</p>
          </div>
        ) : (
          <div className="mb-8">
            <LastGpBreakdownVip lastGpName={lastGpName} />
          </div>
        )}

        <hr className="border-gray-700 my-6" />

        {/* Leaderboards Section */}
        {sectionErrors.leaderboards ? (
          <div className="mb-8 bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">{sectionErrors.leaderboards}</p>
          </div>
        ) : (
          <LeaderboardsSectionVip />
        )}

        <hr className="border-gray-700 my-6" />

        {/* Results Grid - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <ResultCard
            title="Ganador"
            driver={previousResults?.gp1}
            icon="🏆"
            iconColor="text-amber-400"
            gpName={previousResults?.gp_name}
            animation={{
              //@ts-ignore
              '--border-angle': '0deg',
              background: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #d4af37 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)',
              animation: 'rotate-border 3s linear infinite reverse',
            }}
          />

          <ResultCard
            title="Pole Position"
            driver={previousResults?.pole1}
            icon="🏁"
            iconColor="text-blue-400"
            gpName={previousResults?.gp_name}
            animation={{
              //@ts-ignore
              '--border-angle': '45deg',
              background: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1d4ed8 20deg, #3b82f6 30deg, #1d4ed8 40deg, transparent 50deg, transparent 360deg)',
              animation: 'rotate-border 3.5s linear infinite',
            }}
          />

          <ResultCard
            title="Vuelta Rápida"
            driver={previousResults?.fastest_lap_driver}
            icon="⏱️"
            iconColor="text-green-400"
            gpName={previousResults?.gp_name}
            animation={{
              //@ts-ignore
              '--border-angle': '180deg',
              background: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #86efac 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)',
              animation: 'rotate-border 4s linear infinite',
            }}
          />
        </div>

        {/* Results Grid - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <ResultCard
            title="Piloto del Día"
            driver={previousResults?.driver_of_the_day}
            icon="⭐"
            iconColor="text-purple-400"
            gpName={previousResults?.gp_name}
            animation={{
              //@ts-ignore
              '--border-angle': '270deg',
              background: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)',
              animation: 'rotate-border 6s linear infinite reverse',
            }}
          />

          {/* Fastest Pit Stop */}
          {previousResults?.fastest_pit_stop_team ? (
            <div
              className="animate-rotate-border rounded-xl p-px"
              style={{
                //@ts-ignore
                '--border-angle': '180deg',
                background: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #0d9488 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)',
                animation: 'rotate-border 5s linear infinite',
              }}
            >
              <motion.div
                className={`rounded-xl shadow-lg relative z-10 flex flex-col items-center bg-gradient-to-br h-40 overflow-hidden ${
                  teamColors[previousResults.fastest_pit_stop_team]
                    ? `${teamColors[previousResults.fastest_pit_stop_team].gradientFrom} ${teamColors[previousResults.fastest_pit_stop_team].gradientTo}`
                    : 'from-gray-700 to-gray-600'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none rounded-xl" />
                <div className="relative z-20 w-full text-center flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-1">
                  <h2 className="text-base sm:text-lg font-bold text-white font-exo2 drop-shadow-md flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
                    </svg>
                    Pit Stop Más Rápido
                  </h2>
                  <p className="text-[10px] sm:text-xs text-white/90 font-exo2 drop-shadow-md truncate">
                    {previousResults.fastest_pit_stop_team} - {previousResults.gp_name}
                  </p>
                </div>
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="absolute inset-0 w-full h-full z-0"
                >
                  <SafeImage
                    src={getTeamCarImage(previousResults.fastest_pit_stop_team)}
                    alt={`${previousResults.fastest_pit_stop_team} car`}
                    fill
                    className="object-cover object-center"
                  />
                </motion.div>
              </motion.div>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 p-6 h-40 flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl text-cyan-600 mb-2 block">⏱️</span>
                <p className="text-gray-500 text-sm font-semibold">Pit Stop Más Rápido</p>
                <p className="text-gray-600 text-xs mt-1">Sin datos disponibles</p>
              </div>
            </div>
          )}

          {/* First Team to Pit */}
          {previousResults?.first_team_to_pit ? (
            <div
              className="animate-rotate-border rounded-xl p-px"
              style={{
                //@ts-ignore
                '--border-angle': '135deg',
                background: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #0d9488 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)',
                animation: 'rotate-border 5s linear infinite',
              }}
            >
              <motion.div
                className={`rounded-xl shadow-lg relative z-10 flex flex-col items-center bg-gradient-to-br h-40 overflow-hidden ${
                  teamColors[previousResults.first_team_to_pit]
                    ? `${teamColors[previousResults.first_team_to_pit].gradientFrom} ${teamColors[previousResults.first_team_to_pit].gradientTo}`
                    : 'from-gray-700 to-gray-600'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none rounded-xl" />
                <div className="relative z-20 w-full text-center flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-1">
                  <h2 className="text-base sm:text-lg font-bold text-white font-exo2 drop-shadow-md flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
                    </svg>
                    Primer Equipo en Pits
                  </h2>
                  <p className="text-[10px] sm:text-xs text-white/90 font-exo2 drop-shadow-md truncate">
                    {previousResults.first_team_to_pit} - {previousResults.gp_name}
                  </p>
                </div>
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="absolute inset-0 w-full h-full z-0"
                >
                  <SafeImage
                    src={getTeamCarImage(previousResults.first_team_to_pit)}
                    alt={`${previousResults.first_team_to_pit} car`}
                    fill
                    className="object-cover object-center"
                  />
                </motion.div>
              </motion.div>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 p-6 h-40 flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl text-cyan-600 mb-2 block">🏁</span>
                <p className="text-gray-500 text-sm font-semibold">Primer Equipo en Pits</p>
                <p className="text-gray-600 text-xs mt-1">Sin datos disponibles</p>
              </div>
            </div>
          )}
        </div>

        {/* Past Predictions Section */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <motion.div
            className="animate-rotate-border rounded-xl p-0.5"
            style={{
              //@ts-ignore
              '--border-angle': '0deg',
              background: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)',
              animationDuration: '6s',
              animationDirection: 'reverse',
            }}
          >
            <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                Tus Predicciones Pasadas
              </h2>
              
              {sectionErrors.predictions ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-4">{sectionErrors.predictions}</p>
                  <button onClick={handleRefresh} className="text-sm text-red-300 underline hover:no-underline">
                    Reintentar
                  </button>
                </div>
              ) : pastPredictions.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {pastPredictions.map((pred, index) => {
                    const score = scoreMap.get(pred.gp_name);
                    const hasValidPredictions = validatePredictions(pred);
                    
                    return (
                      <div
                        key={index}
                        className={`bg-gray-900/80 p-4 sm:p-6 rounded-xl border backdrop-blur-sm transition-all ${
                          hasValidPredictions ? 'border-purple-500/30 hover:border-purple-400/50' : 'border-gray-700/30'
                        }`}
                      >
                        <div
                          className="flex justify-between items-center cursor-pointer"
                          onClick={() => {
                            setExpandedIndex(expandedIndex === index ? null : index);
                            clickSound.play();
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-lg sm:text-xl font-semibold text-purple-400 font-exo2">
                              {pred.gp_name || 'GP Desconocido'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {pred.submitted_at 
                                ? new Date(pred.submitted_at).toLocaleDateString('es-CO', { 
                                    timeZone: 'America/Bogota',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })
                                : 'Fecha desconocida'
                              }
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {score !== undefined && (
                              <span className="text-green-400 font-bold text-lg">{score} pts</span>
                            )}
                            <span className="text-white font-exo2 text-lg">
                              {expandedIndex === index ? '▲' : '▼'}
                            </span>
                          </div>
                        </div>

                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ 
                            height: expandedIndex === index ? 'auto' : 0, 
                            opacity: expandedIndex === index ? 1 : 0 
                          }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          {hasValidPredictions ? (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-300 font-exo2 text-sm sm:text-base">
                              <div className="space-y-2">
                                <p>
                                  <strong className="text-purple-300">Pole:</strong> {pred.pole1 || '-'}, {pred.pole2 || '-'}, {pred.pole3 || '-'}
                                </p>
                                <p>
                                  <strong className="text-cyan-300">GP:</strong> {pred.gp1 || '-'}, {pred.gp2 || '-'}, {pred.gp3 || '-'}
                                </p>
                                <p>
                                  <strong className="text-yellow-300">Primer Equipo en Pits:</strong> {pred.first_team_to_pit || '-'}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  <strong className="text-blue-300">Pit Stop Más Rápido:</strong> {pred.fastest_pit_stop_team || '-'}
                                </p>
                                <p>
                                  <strong className="text-green-300">Vuelta Rápida:</strong> {pred.fastest_lap_driver || '-'}
                                </p>
                                <p>
                                  <strong className="text-pink-300">Piloto del Día:</strong> {pred.driver_of_the_day || '-'}
                                </p>
                                <p>
                                  <strong className="text-orange-300">Primer Retiro:</strong> {pred.first_retirement || '-'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 text-center text-gray-500 py-4">
                              <p>No hay predicciones válidas para mostrar</p>
                            </div>
                          )}
                          
                          {score !== undefined && (
                            <p className="mt-4 text-center text-green-400 font-exo2 text-sm sm:text-base">
                              HICISTE&nbsp;
                              <span className="font-bold text-lg">{score}</span>&nbsp;
                              PUNTOS EN&nbsp;
                              <span className="uppercase">{pred.gp_name}</span>
                            </p>
                          )}
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyStateCard
                  title="Sin predicciones todavía"
                  message="Haz tu primera predicción para empezar a competir por premios increíbles"
                  icon="🏎️"
                  action={{ label: "Hacer mi primera predicción", href: "/fantasy-vip" }}
                />
              )}
            </div>
          </motion.div>
        </div>

        {/* Sticky Predict Button (Mobile) */}
        <AnimatePresence>
          <motion.div
            key="sticky-fantasy-btn"
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 50 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className="fixed bottom-6 right-6 z-40 md:hidden"
          >
            <button
              onClick={handleGoToPredictions}
              className="flex items-center gap-2 pl-3 pr-4 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-exo2 font-bold text-sm rounded-full shadow-xl hover:from-amber-600 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 transform hover:scale-105 active:scale-100"
              aria-label="Ir a predecir"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
              <span>¡Predecir!</span>
            </button>
          </motion.div>
        </AnimatePresence>

        {/* Refresh Button */}
        {refreshing ? (
          <div className="fixed bottom-20 right-6 p-3 bg-gray-800 rounded-full shadow-lg">
            <svg className="w-5 h-5 text-gray-300 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        ) : (
          <button
            onClick={handleRefresh}
            className="fixed bottom-20 right-6 p-3 bg-gray-800 hover:bg-gray-700 rounded-full shadow-lg transition-colors hidden md:block"
            aria-label="Actualizar datos"
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}

        {/* Toast Container */}
        <Toaster 
          richColors 
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151',
            },
          }}
        />

        {/* Quiz Modal */}
        <AnimatePresence>
          {showQuizModal && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
              onClick={() => setShowQuizModal(false)}
            >
              <motion.div
                className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-amber-500/50 max-w-lg w-full shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.h3
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="text-2xl font-bold text-amber-400 mb-4 font-exo2 text-center"
                >
                  F1 Trivia Quiz - ¡Gana 10 Puntos Extra!
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="text-gray-300 mb-6 font-exo2 text-center"
                >
                  Responde correctamente las 5 preguntas para sumar 10 puntos a tu cuenta.
                </motion.p>

                <motion.div
                  key={currentQuestionIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-800/80 p-4 rounded-xl border border-amber-500/30 shadow-md"
                >
                  <p className="text-gray-200 mb-3 font-exo2 text-lg">
                    {currentQuestionIndex + 1}. {quizQuestions[currentQuestionIndex].question}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {quizQuestions[currentQuestionIndex].options.map((option) => (
                      <motion.button
                        key={option}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleQuizAnswer(option)}
                        className={`px-4 py-2 rounded-full font-exo2 text-sm transition-all ${
                          quizAnswers[currentQuestionIndex] === option
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'bg-gray-700 text-amber-400 hover:bg-gray-600'
                        }`}
                      >
                        {option}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                <div className="flex justify-between mt-6">
                  {currentQuestionIndex > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePreviousQuestion}
                      className="px-6 py-3 bg-gray-700 text-gray-300 rounded-full font-exo2 font-semibold transition-all hover:bg-gray-600"
                    >
                      Anterior
                    </motion.button>
                  )}
                  {currentQuestionIndex === quizQuestions.length - 1 ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleQuizSubmit}
                      disabled={quizAnswers.some((answer) => !answer)}
                      className={`px-6 py-3 rounded-full font-exo2 font-semibold transition-all ${
                        quizAnswers.some((answer) => !answer)
                          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                          : 'bg-amber-500 text-white hover:bg-amber-400'
                      }`}
                    >
                      Enviar Respuestas
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleNextQuestion}
                      disabled={!quizAnswers[currentQuestionIndex]}
                      className={`px-6 py-3 rounded-full font-exo2 font-semibold transition-all ml-auto ${
                        quizAnswers[currentQuestionIndex]
                          ? 'bg-amber-500 text-white hover:bg-amber-400'
                          : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      Siguiente
                    </motion.button>
                  )}
                </div>

                <div className="mt-4 flex justify-center gap-2">
                  {quizQuestions.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentQuestionIndex ? 'bg-amber-500' : 'bg-gray-500'
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}