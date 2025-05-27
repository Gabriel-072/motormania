'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { toast, Toaster } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createAuthClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import LoadingAnimation from '@/components/LoadingAnimation';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';  // si no lo tienes ya
import { Howl } from 'howler';

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

// Team Colors for Gradients
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

// Image Functions
const getDriverImage = (driverName: string): string => {
  const normalizedName = driverName.trim().replace(' ', '-').toLowerCase();
  return `/images/pilots/${normalizedName}.png`;
};

const getTeamCarImage = (teamName: string): string =>
  `/images/cars/${teamName.toLowerCase().replace(' ', '-')}.png` || '/images/cars/default-car.png';

export default function F1FantasyPanel() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [seasonScore, setSeasonScore] = useState<number | null>(null);
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
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [demoPick, setDemoPick] = useState<'mejor' | 'peor' | null>(null);
  const clickSound = new Howl({ src: ['/sounds/f1-click.mp3'], volume: 5, preload: true });


  // 5-Question F1 Quiz
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

  // Helper to get user's full name
  const getUserName = (): string => {
    if (!user) return 'Usuario Desconocido';
    return user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario Desconocido';
  };

  // Handle claiming sign-up bonus
  const handleClaimSignupBonus = async () => {
    if (!user || signupBonusClaimed) return;

    const token = await getToken({ template: 'supabase' });
    if (!token) {
      setErrors((prev) => [...prev, 'Error de autenticación. Intenta de nuevo más tarde.']);
      return;
    }

    const supabase = createAuthClient(token);
    const userId = user.id;
    const userName = getUserName();

    const { data, error } = await supabase
      .from('leaderboard')
      .select('score, signup_bonus_claimed')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      setErrors((prev) => [...prev, `Error al verificar tu cuenta: ${error.message}`]);
      return;
    }

    if (!data) {
      // New user, insert with 10 points
      const { error: insertError } = await supabase.from('leaderboard').insert({
        user_id: userId,
        name: userName,
        score: 10,
        quiz_completed: false,
        signup_bonus_claimed: true,
      });

      if (insertError) {
        setErrors((prev) => [...prev, `No pudimos guardar tu bono: ${insertError.message}`]);
        return;
      }

      setSeasonScore(10);
      setSignupBonusClaimed(true);
    } else if (!data.signup_bonus_claimed) {
      const currentScore = data.score ?? 0;
      const newScore = currentScore + 10;

      const { error: updateError } = await supabase
        .from('leaderboard')
        .update({ score: newScore, signup_bonus_claimed: true })
        .eq('user_id', userId);

      if (updateError) {
        setErrors((prev) => [...prev, `No pudimos actualizar tu bono: ${updateError.message}`]);
        return;
      }

      setSeasonScore(newScore);
      setSignupBonusClaimed(true);
    }

    setErrors((prev) => [...prev, '¡Bono de registro reclamado! Has ganado 10 puntos.']);
  };

  // Handle selecting a quiz answer
  const handleQuizAnswer = (answer: string) => {
    const newAnswers = [...quizAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setQuizAnswers(newAnswers);
  };

  // Move to the next question
  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Move to the previous question
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Handle quiz submission
  const handleQuizSubmit = async () => {
    if (!user) {
      setErrors((prev) => [...prev, 'Debes estar autenticado para enviar el quiz.']);
      return;
    }

    if (quizAnswers.some((answer) => !answer)) {
      setErrors((prev) => [...prev, 'Por favor, responde todas las preguntas antes de enviar.']);
      return;
    }

    const allCorrect = quizAnswers.every((answer, i) => answer === quizQuestions[i].correctAnswer);
    const token = await getToken({ template: 'supabase' });

    if (!token) {
      setErrors((prev) => [...prev, 'Error de autenticación. Intenta de nuevo más tarde.']);
      return;
    }

    const supabase = createAuthClient(token);
    const userId = user.id;

    if (allCorrect) {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('score, quiz_completed')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        setErrors((prev) => [...prev, `Error al obtener datos: ${error.message}`]);
        return;
      }

      if (!data) {
        const userName = getUserName();
        const { error: insertError } = await supabase.from('leaderboard').insert({
          user_id: userId,
          name: userName,
          score: 10,
          quiz_completed: true,
          signup_bonus_claimed: false,
        });

        if (insertError) {
          setErrors((prev) => [...prev, `No pudimos guardar tus puntos: ${insertError.message}`]);
          return;
        }

        setSeasonScore(10);
      } else if (!data.quiz_completed) {
        const currentScore = data.score ?? 0;
        const newScore = currentScore + 10;

        const { error: updateError } = await supabase
          .from('leaderboard')
          .update({ score: newScore, quiz_completed: true })
          .eq('user_id', userId);

        if (updateError) {
          setErrors((prev) => [...prev, `No pudimos guardar tus puntos: ${updateError.message}`]);
          return;
        }

        setSeasonScore(newScore);
      }

      setQuizCompleted(true);
      setShowQuizModal(false);
      setQuizAnswers(Array(5).fill(''));
      setCurrentQuestionIndex(0);
      setErrors((prev) => [...prev, '¡Felicidades! Has ganado 10 puntos extra.']);
    } else {
      setErrors((prev) => [...prev, 'No todas las respuestas son correctas. ¡Intenta de nuevo!']);
    }
  };

  // Fetch Data Function
  const fetchData = useCallback(async () => {
    if (!user || !isSignedIn) return;

    const startTime = performance.now();
    const fetchErrors: string[] = [];
    const minDuration = 3000;

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación.');

      const supabase = createAuthClient(token);
      const userId = user.id;
      const userName = getUserName();

      const [
        { data: leaderboardData, error: leaderboardError },
        { data: predictionsData, error: predictionsError },
        { data: scoresData, error: scoresError },
        { data: scheduleData, error: scheduleError },
      ] = await Promise.all([
        supabase.from('leaderboard').select('*').eq('user_id', userId).single(),
        supabase.from('predictions').select('*').eq('user_id', userId).order('submitted_at', { ascending: false }),
        supabase.from('prediction_scores').select('gp_name, race_date, score').eq('user_id', userId).order('race_date', { ascending: false }),
        supabase.from('gp_schedule').select('*').order('race_time', { ascending: true }),
      ]);

      if (leaderboardError && leaderboardError.code === 'PGRST116') {
        // New user, insert with 0 points initially
        const { error: insertError } = await supabase.from('leaderboard').insert({
          user_id: userId,
          name: userName,
          score: 0,
          quiz_completed: false,
          signup_bonus_claimed: false,
        });

        if (insertError) {
          fetchErrors.push(`Error al registrar usuario: ${insertError.message}`);
        } else {
          setSeasonScore(0);
          setQuizCompleted(false);
          setSignupBonusClaimed(false);
        }
      } else if (leaderboardError) {
        fetchErrors.push(`Error al cargar tu puntaje: ${leaderboardError.message}`);
      } else if (leaderboardData) {
        setSeasonScore(leaderboardData.score ?? 0);
        setQuizCompleted(leaderboardData.quiz_completed ?? false);
        setSignupBonusClaimed(leaderboardData.signup_bonus_claimed ?? false);
        if (leaderboardData.score != null) {
          const { count, error: countError } = await supabase
            .from('leaderboard')
            .select('user_id', { head: true, count: 'exact' })
            .gt('score', leaderboardData.score);
          if (!countError) {
            setMyRank((count ?? 0) + 1);
          } else {
            console.error('Error al calcular posición:', countError);
          }
        }
      }
      
      if (predictionsError) fetchErrors.push(`Error al cargar predicciones: ${predictionsError.message}`);
      setPastPredictions(predictionsData || []);

      if (scoresError) {
        console.warn('Error fetching prediction scores:', scoresError);
        setPastScores([]);
      } else {
        setPastScores(scoresData || []);
        const map = new Map<string, number>();
        scoresData?.forEach((score) => map.set(`${score.gp_name}-${score.race_date}`, score.score));
        setScoreMap(map);
      }

      if (scheduleError) fetchErrors.push(`Error al cargar calendario: ${scheduleError.message}`);
      setGpSchedule(scheduleData || []);

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

        const { data: resultsData, error: resultsError } = await supabase
          .from('race_results')
          .select('*')
          .eq('gp_name', previousGp.gp_name)
          .eq('race_date', raceDateStr)
          .maybeSingle();

        if (resultsError) fetchErrors.push(`Error al cargar resultados previos: ${resultsError.message}`);
        setPreviousResults(resultsData || null);
      } else {
        setPreviousResults(null);
      }
    } catch (err) {
      fetchErrors.push('Ocurrió un error al cargar tus datos. Por favor, intenta de nuevo.');
      console.error('Fetch error:', err);
    } finally {
      setErrors(fetchErrors);
      const elapsed = performance.now() - startTime;
      const duration = Math.max(elapsed / 1000, 3);
      setLoadingDuration(duration);
      if (elapsed < minDuration) {
        setTimeout(() => setIsDataLoaded(true), minDuration - elapsed);
      } else {
        setIsDataLoaded(true);
      }
    }
  }, [getToken, isSignedIn, user]);

  useEffect(() => {
    const timer = setTimeout(() => setShowRedirectModal(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    fetchData();
  }, [isSignedIn, user, fetchData]);

  if (!isLoaded || !isDataLoaded) {
    return <LoadingAnimation animationDuration={loadingDuration} />;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white flex items-center justify-center">
        <p className="text-xl font-exo2">Por favor, inicia sesión para ver tu panel de F1 Fantasy.</p>
      </div>
    );
  }
  //*JSX*//
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white overflow-hidden relative">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        {/* Row 1: Key Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div
            className="animate-rotate-border rounded-xl p-px"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #d4af37 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '3s',
              animationDirection: 'reverse',
            }}
          >
            <div className="relative group bg-gradient-to-br from-gray-900 to-black p-3 sm:p-4 rounded-xl shadow-lg z-10 min-h-40 flex flex-col justify-between overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-black/50 backdrop-blur-sm z-0 pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-full">
                <motion.h2
                  className="text-sm sm:text-base font-bold text-white font-exo2 leading-tight mb-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  Tu Puntaje de Temporada
                </motion.h2>
                <div className="flex flex-col items-center justify-center flex-grow gap-1">
                  {seasonScore !== null ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold text-amber-400 font-exo2">{seasonScore} puntos</span>
                      {myRank != null && (
                     <span className="text-sm text-gray-300 font-exo2">
                     Posición: #{myRank}
                     </span>
                     )}
                      {seasonScore > 1000 && <span className="text-xl sm:text-2xl">🏆</span>}
                    </>
                  ) : (
                    <span className="text-xl sm:text-2xl font-bold text-amber-400 font-exo2">Cargando...</span>
                  )}
                </div>

                <div className="flex flex-col gap-2 mt-2">
                </div>
              </div>
            </div>
          </div>

          <div
            className="animate-rotate-border rounded-xl p-px"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #d4af37 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '3s',
              animationDirection: 'reverse',
            }}
          >
            <motion.div
              className={`relative p-2 sm:p-4 pb-0 rounded-xl shadow-lg z-10 bg-gradient-to-br h-40 overflow-hidden ${
                previousResults?.gp1 && driverToTeam[previousResults.gp1]
                  ? `${teamColors[driverToTeam[previousResults.gp1]].gradientFrom} ${teamColors[driverToTeam[previousResults.gp1]].gradientTo}`
                  : 'from-gray-700 to-gray-600'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black/50 to-transparent z-0 pointer-events-none" />
              <div className="relative z-10 pr-[30%] sm:pr-[40%] flex flex-col justify-center h-full space-y-1">
                {previousResults?.gp1 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-lg sm:text-xl">🏆</span>
                      <p className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight">
                        Ganador: {previousResults.gp1}
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight">
                      {previousResults.gp_name} • {driverToTeam[previousResults.gp1]}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400 font-exo2 text-xs sm:text-sm">
                    No hay resultados previos disponibles.
                  </p>
                )}
              </div>
              {previousResults?.gp1 && (
                <Image
                  src={getDriverImage(previousResults.gp1)}
                  alt={previousResults.gp1}
                  width={156}
                  height={160}
                  className="absolute bottom-0 right-0 w-[40%] sm:w-[50%] max-w-[156px] h-full object-contain object-bottom"
                />
              )}
            </motion.div>
          </div>

          <div
            className="animate-rotate-border rounded-xl p-px"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1d4ed8 20deg, #3b82f6 30deg, #1d4ed8 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '3.5s',
            }}
          >
            <motion.div
              className={`relative p-2 sm:p-4 pb-0 rounded-xl shadow-lg z-10 bg-gradient-to-br h-40 overflow-hidden ${
                previousResults?.pole1 && driverToTeam[previousResults.pole1]
                  ? `${teamColors[driverToTeam[previousResults.pole1]].gradientFrom} ${teamColors[driverToTeam[previousResults.pole1]].gradientTo}`
                  : 'from-gray-700 to-gray-600'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black/50 to-transparent z-0 pointer-events-none" />
              <div className="relative z-10 pr-[30%] sm:pr-[40%] flex flex-col justify-center h-full space-y-1">
                {previousResults?.pole1 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 text-lg sm:text-xl">🏁</span>
                      <p className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight">
                        Pole: {previousResults.pole1}
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight">
                      {previousResults.gp_name} • {driverToTeam[previousResults.pole1]}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400 font-exo2 text-xs sm:text-sm">
                    No hay datos de pole.
                  </p>
                )}
              </div>
              {previousResults?.pole1 && (
                <Image
                  src={getDriverImage(previousResults.pole1)}
                  alt={previousResults.pole1}
                  width={156}
                  height={160}
                  className="absolute bottom-0 right-0 w-[40%] sm:w-[50%] max-w-[156px] h-full object-contain object-bottom"
                />
              )}
            </motion.div>
          </div>
        </div>

        {/* Row 2: Additional Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div
            className="animate-rotate-border rounded-xl p-px"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #86efac 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '4s',
            }}
          >
            <motion.div
              className={`relative p-2 sm:p-4 pb-0 rounded-xl shadow-lg z-10 bg-gradient-to-br h-40 overflow-hidden ${
                previousResults?.fastest_lap_driver && driverToTeam[previousResults.fastest_lap_driver]
                  ? `${teamColors[driverToTeam[previousResults.fastest_lap_driver]].gradientFrom} ${teamColors[driverToTeam[previousResults.fastest_lap_driver]].gradientTo}`
                  : 'from-gray-700 to-gray-600'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black/50 to-transparent z-0 pointer-events-none" />
              <div className="relative z-10 pr-[30%] sm:pr-[40%] flex flex-col justify-center h-full space-y-1">
                {previousResults?.fastest_lap_driver ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 text-lg sm:text-xl">⏱️</span>
                      <p className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight">
                        Vuelta Rápida: {previousResults.fastest_lap_driver}
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight">
                      {previousResults.gp_name} • {driverToTeam[previousResults.fastest_lap_driver]}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400 font-exo2 text-xs sm:text-sm">
                    No hay datos de vuelta rápida.
                  </p>
                )}
              </div>
              {previousResults?.fastest_lap_driver && (
                <Image
                  src={getDriverImage(previousResults.fastest_lap_driver)}
                  alt={previousResults.fastest_lap_driver}
                  width={156}
                  height={160}
                  className="absolute bottom-0 right-0 w-[40%] sm:w-[50%] max-w-[156px] h-full object-contain object-bottom"
                />
              )}
            </motion.div>
          </div>

          <div
            className="animate-rotate-border rounded-xl p-px"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '6s',
              animationDirection: 'reverse',
            }}
          >
            <motion.div
              className={`relative p-2 sm:p-4 pb-0 rounded-xl shadow-lg z-10 bg-gradient-to-br h-40 overflow-hidden ${
                previousResults?.driver_of_the_day && driverToTeam[previousResults.driver_of_the_day]
                  ? `${teamColors[driverToTeam[previousResults.driver_of_the_day]].gradientFrom} ${teamColors[driverToTeam[previousResults.driver_of_the_day]].gradientTo}`
                  : 'from-gray-700 to-gray-600'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black/50 to-transparent z-0 pointer-events-none" />
              <div className="relative z-10 pr-[30%] sm:pr-[40%] flex flex-col justify-center h-full space-y-1">
                {previousResults?.driver_of_the_day ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 text-lg sm:text-xl">⭐</span>
                      <p className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight">
                        Piloto del Día: {previousResults.driver_of_the_day}
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight">
                      {previousResults.gp_name} • {driverToTeam[previousResults.driver_of_the_day]}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400 font-exo2 text-xs sm:text-sm">
                    No hay datos de piloto del día.
                  </p>
                )}
              </div>
              {previousResults?.driver_of_the_day && (
                <Image
                  src={getDriverImage(previousResults.driver_of_the_day)}
                  alt={previousResults.driver_of_the_day}
                  width={156}
                  height={160}
                  className="absolute bottom-0 right-0 w-[40%] sm:w-[50%] max-w-[156px] h-full object-contain object-bottom"
                />
              )}
            </motion.div>
          </div>

          <div
            className="animate-rotate-border rounded-xl p-px"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #0d9488 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '5s',
            }}
          >
            <motion.div
              className={`p-3 sm:p-4 pb-0 rounded-xl shadow-lg relative z-10 flex flex-col items-center bg-gradient-to-br h-40 overflow-hidden ${
                previousResults?.first_team_to_pit
                  ? `${teamColors[previousResults.first_team_to_pit].gradientFrom} ${teamColors[previousResults.first_team_to_pit].gradientTo}`
                  : 'from-gray-700 to-gray-600'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-black/50 backdrop-blur-sm z-0 pointer-events-none" />
              <div className="relative z-20 w-full text-center mb-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-exo2 drop-shadow-md">
                  Primer Equipo en Pits
                </h2>
                {previousResults?.first_team_to_pit ? (
                  <p className="text-[10px] sm:text-xs text-white font-exo2 drop-shadow-md truncate">
                    {previousResults.first_team_to_pit} - {previousResults.gp_name}
                  </p>
                ) : (
                  <p className="text-gray-400 font-exo2 text-xs sm:text-sm">
                    No hay datos de primer equipo en pits.
                  </p>
                )}
              </div>
              {previousResults?.first_team_to_pit && (
                <div className="w-full h-full flex justify-center items-end relative z-10">
                  <Image
                    src={getTeamCarImage(previousResults.first_team_to_pit)}
                    alt={`${previousResults.first_team_to_pit} car`}
                    width={546}
                    height={273}
                    className="object-contain w-full h-auto car-image"
                    style={{ transform: 'translateY(-10px)' }}
                  />
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Row 3: Past Predictions */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <motion.div
            className="animate-rotate-border rounded-xl p-0.5"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '6s',
              animationDirection: 'reverse',
            }}
          >
            <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                Tus Predicciones Pasadas
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {pastPredictions.length > 0 ? (
                  pastPredictions.map((pred, index) => {
                    const raceDate = pred.submitted_at.split('T')[0];
                    const scoreKey = `${pred.gp_name}-${raceDate}`;
                    const score = scoreMap.get(scoreKey);
                    return (
                      <div
                        key={index}
                        className="bg-gray-900/80 p-4 sm:p-6 rounded-xl border border-purple-500/30 backdrop-blur-sm"
                      >
                        <div
                          className="flex justify-between items-center cursor-pointer"
                          onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                        >
                          <p className="text-lg sm:text-xl font-semibold text-purple-400 font-exo2">
                            {pred.gp_name} -{' '}
                            {new Date(pred.submitted_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                          </p>
                          <span className="text-white font-exo2 text-lg">{expandedIndex === index ? '▲' : '▼'}</span>
                        </div>
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: expandedIndex === index ? 'auto' : 0, opacity: expandedIndex === index ? 1 : 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-300 font-exo2 text-sm sm:text-base">
                            <div>
                              <p>
                                <strong>Pole:</strong> {pred.pole1 || '-'}, {pred.pole2 || '-'}, {pred.pole3 || '-'}
                              </p>
                              <p>
                                <strong>GP:</strong> {pred.gp1 || '-'}, {pred.gp2 || '-'}, {pred.gp3 || '-'}
                              </p>
                              <p>
                                <strong>Primer Equipo en Pits:</strong> {pred.first_team_to_pit || '-'}
                              </p>
                            </div>
                            <div>
                              <p>
                                <strong>Pit Stop:</strong> {pred.fastest_pit_stop_team || '-'}
                              </p>
                              <p>
                                <strong>Vuelta Rápida:</strong> {pred.fastest_lap_driver || '-'}
                              </p>
                              <p>
                                <strong>Piloto del Día:</strong> {pred.driver_of_the_day || '-'}
                              </p>
                              {score !== undefined && (
                                <p className="text-green-400 mt-2 font-exo2">Puntaje: {score} puntos</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-400 text-center font-exo2 text-lg">No tienes predicciones pasadas aún.</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quiz Modal */}
        {showQuizModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
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

              {/* Current Question Card */}
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

              {/* Navigation and Submission */}
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
                        : 'bg-amber-500 text-white'
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
                    className={`px-6 py-3 rounded-full font-exo2 font-semibold transition-all ${
                      quizAnswers[currentQuestionIndex]
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Siguiente
                  </motion.button>
                )}
              </div>

              {/* Progress Indicator */}
              <div className="mt-4 flex justify-center gap-2">
                {quizQuestions.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentQuestionIndex ? 'bg-amber-500' : 'bg-gray-500'
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Error Messages */}
      {errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-red-400 font-exo2 bg-red-900/30 p-4 rounded-xl border border-red-500/50"
        >
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </motion.div>
      )}
    </main>

    {/* === Popup interactivo + glassmorphism === */}
    <Transition appear show={showRedirectModal} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setShowRedirectModal(false)}>
        {/* Fondo */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        {/* Panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-sm rounded-xl bg-gradient-to-br from-gray-800 to-black p-6 text-center text-white shadow-xl">
              <Dialog.Title className="text-lg font-bold mb-4">🚀 ¡MMC GO te espera!</Dialog.Title>
              <p className="text-sm mb-6">Prueba un pick de demo antes de jugar:</p>

              {/* Glassmorphism Demo Card */}
              <div className="flex flex-col items-center mb-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 space-y-2">
                <Image
                  src="/images/pilots/max-verstappen.png"
                  alt="Max Verstappen"
                  width={80}
                  height={80}
                  className="rounded-full mb-1"
                />
                <h3 className="text-white font-bold">Max Verstappen</h3>
                <p className="text-gray-300">Línea: 6.5</p>

                <div className="flex w-full gap-2 mt-2">
                  <button
                    disabled={demoPick === 'mejor'}
                    onClick={() => {
                      clickSound.play();
                      setDemoPick('mejor');
                    }}
                    className={`flex-1 py-2 rounded-xl font-semibold transition ${
                      demoPick === 'mejor'
                        ? 'bg-green-500 text-white'
                        : 'bg-white/20 text-green-400 hover:bg-green-700 hover:text-white'
                    }`}
                  >
                    Mejor
                  </button>
                  <button
                    disabled={demoPick === 'peor'}
                    onClick={() => {
                      clickSound.play();
                      setDemoPick('peor');
                    }}
                    className={`flex-1 py-2 rounded-xl font-semibold transition ${
                      demoPick === 'peor'
                        ? 'bg-red-500 text-white'
                        : 'bg-white/20 text-red-400 hover:bg-red-700 hover:text-white'
                    }`}
                  >
                    Peor
                  </button>
                </div>
              </div>

              {/* Botón Confirmar */}
              <button
                disabled={!demoPick}
                onClick={() => {
                  router.push('/mmc-go');
                  setShowRedirectModal(false);
                }}
                className="w-full px-4 py-2 bg-amber-500 text-black font-semibold rounded-xl disabled:opacity-50"
              >
                Ir a MMC GO
              </button>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  </div>
);
}