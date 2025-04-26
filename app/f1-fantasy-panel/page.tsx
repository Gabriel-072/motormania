'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion'; // Added AnimatePresence
import { createAuthClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import LoadingAnimation from '@/components/LoadingAnimation';

// SECTION: Type Definitions (Remain Unchanged)
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
  first_retirement: string; // Note: This field exists but isn't displayed in the panel currently
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
  // first_retirement: string; // Removed as not used in display logic here
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

// SECTION: Static Data & Helpers (Remain Unchanged)
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
    'Liam Lawson': 'RB', // Assuming based on common knowledge for 2025
    'Lando Norris': 'McLaren',
    'Oscar Piastri': 'McLaren',
    'Lewis Hamilton': 'Ferrari',
    'Charles Leclerc': 'Ferrari',
    'George Russell': 'Mercedes',
    'Kimi Antonelli': 'Mercedes',
    'Fernando Alonso': 'Aston Martin',
    'Lance Stroll': 'Aston Martin',
    'Yuki Tsunoda': 'Red Bull Racing', // Assuming based on common knowledge for 2025
    'Isack Hadjar': 'RB', // Assuming based on common knowledge for 2025
    'Nico Hulkenberg': 'Sauber',
    'Gabriel Bortoleto': 'Sauber',
    'Pierre Gasly': 'Alpine',
    'Jack Doohan': 'Alpine',
    'Alex Albon': 'Williams',
    'Carlos Sainz': 'Williams',
    'Oliver Bearman': 'Haas F1 Team',
    'Esteban Ocon': 'Haas F1 Team',
};

// Image Functions
const getDriverImage = (driverName: string): string => {
  if (!driverName) return '/images/pilots/default-driver.png';
  const normalizedName = driverName.trim().replace(/\s+/g, '-').toLowerCase();
  // Basic check for known drivers might be needed if filenames aren't guaranteed
  return `/images/pilots/${normalizedName}.png`;
};

const getTeamCarImage = (teamName: string): string => {
   if (!teamName) return '/images/cars/default-car.png';
   const slug = teamName.toLowerCase().replace(/\s+/g, '-');
   // This assumes image files exist with slugs like 'red-bull-racing.png'
   return `/images/cars/${slug}.png`;
}


// SECTION: Main Component
export default function F1FantasyPanel() {
  // State Hooks (Remain Unchanged)
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [seasonScore, setSeasonScore] = useState<number | null>(null);
  const [pastPredictions, setPastPredictions] = useState<Prediction[]>([]);
  const [pastScores, setPastScores] = useState<PredictionScore[]>([]);
  const [scoreMap, setScoreMap] = useState<Map<string, number>>(new Map());
  const [previousResults, setPreviousResults] = useState<RaceResult | null>(null);
  const [gpSchedule, setGpSchedule] = useState<GpSchedule[]>([]); // Keep schedule if needed elsewhere, though not directly displayed
  const [errors, setErrors] = useState<string[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [loadingDuration, setLoadingDuration] = useState(3); // Default to 3 seconds
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [signupBonusClaimed, setSignupBonusClaimed] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<string[]>(Array(5).fill(''));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Quiz Questions (Remain Unchanged)
  const quizQuestions = [
    { question: '¿Quién ganó el campeonato de F1 en 2021?', options: ['Lewis Hamilton', 'Max Verstappen', 'Charles Leclerc'], correctAnswer: 'Max Verstappen' },
    { question: '¿Qué equipo ha ganado más títulos de constructores?', options: ['McLaren', 'Ferrari', 'Mercedes'], correctAnswer: 'Ferrari' },
    { question: '¿En qué circuito se corre el GP de Mónaco?', options: ['Monza', 'Monte Carlo', 'Silverstone'], correctAnswer: 'Monte Carlo' },
    { question: '¿Quién tiene el récord de más victorias en F1?', options: ['Michael Schumacher', 'Lewis Hamilton', 'Sebastian Vettel'], correctAnswer: 'Lewis Hamilton' },
    { question: '¿En qué año comenzó la Fórmula 1 moderna?', options: ['1950', '1960', '1970'], correctAnswer: '1950' },
  ];

  // Helper Functions (Remain Unchanged)
  const getUserName = (): string => {
    if (!user) return 'Usuario Desconocido';
    return user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Usuario Desconocido'; // Added username fallback
  };

  // Event Handlers (Remain Unchanged)
  const handleClaimSignupBonus = async () => {
    if (!user || signupBonusClaimed) return;
    setErrors([]); // Clear previous errors

    const token = await getToken({ template: 'supabase' });
    if (!token) {
      setErrors((prev) => [...prev, 'Error de autenticación. Intenta de nuevo más tarde.']);
      return;
    }
    const supabase = createAuthClient(token);
    const userId = user.id;
    const userName = getUserName();

    const { data, error } = await supabase.from('leaderboard').select('score, signup_bonus_claimed').eq('user_id', userId).maybeSingle(); // Use maybeSingle

    if (error && error.code !== 'PGRST116') { // PGRST116 = Row not found
      setErrors((prev) => [...prev, `Error al verificar tu cuenta: ${error.message}`]);
      return;
    }

    try {
        if (!data) { // New user
            const { error: insertError } = await supabase.from('leaderboard').insert({ user_id: userId, name: userName, score: 10, quiz_completed: false, signup_bonus_claimed: true });
            if (insertError) throw insertError;
            setSeasonScore(10);
            setSignupBonusClaimed(true);
            setErrors((prev) => [...prev, '¡Bono de 10 puntos reclamado!']);
        } else if (!data.signup_bonus_claimed) { // Existing user, unclaimed bonus
            const currentScore = data.score ?? 0;
            const newScore = currentScore + 10;
            const { error: updateError } = await supabase.from('leaderboard').update({ score: newScore, signup_bonus_claimed: true }).eq('user_id', userId);
            if (updateError) throw updateError;
            setSeasonScore(newScore);
            setSignupBonusClaimed(true);
            setErrors((prev) => [...prev, '¡Bono de 10 puntos reclamado!']);
        } else {
             // Already claimed, do nothing silently or show message:
             // setErrors((prev) => [...prev, 'Ya has reclamado este bono.']);
        }
    } catch (err: any) {
         setErrors((prev) => [...prev, `No pudimos actualizar tu bono: ${err.message}`]);
    }
  };

  const handleQuizAnswer = (answer: string) => {
    const newAnswers = [...quizAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setQuizAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(currentQuestionIndex - 1);
  };

  const handleQuizSubmit = async () => {
    if (!user) return;
    setErrors([]); // Clear previous errors

    if (quizAnswers.some((answer) => !answer)) {
        setErrors(['Por favor, responde todas las preguntas antes de enviar.']);
        return;
    }

    const allCorrect = quizAnswers.every((answer, i) => answer === quizQuestions[i].correctAnswer);
    const token = await getToken({ template: 'supabase' });
    if (!token) {
      setErrors(['Error de autenticación. Intenta de nuevo más tarde.']);
      return;
    }
    const supabase = createAuthClient(token);
    const userId = user.id;

    if (allCorrect) {
        const { data, error } = await supabase.from('leaderboard').select('score, quiz_completed').eq('user_id', userId).maybeSingle(); // Use maybeSingle

        if (error && error.code !== 'PGRST116') {
            setErrors([`Error al obtener datos: ${error.message}`]);
            return;
        }

        try {
            if (!data) { // Should not happen if signup bonus logic ran, but handle defensively
                 const userName = getUserName();
                 const { error: insertError } = await supabase.from('leaderboard').insert({ user_id: userId, name: userName, score: 10, quiz_completed: true, signup_bonus_claimed: false }); // Assume bonus not claimed if no record
                 if (insertError) throw insertError;
                 setSeasonScore(10);
            } else if (!data.quiz_completed) { // Existing user, quiz not completed
                const currentScore = data.score ?? 0;
                const newScore = currentScore + 10;
                const { error: updateError } = await supabase.from('leaderboard').update({ score: newScore, quiz_completed: true }).eq('user_id', userId);
                if (updateError) throw updateError;
                setSeasonScore(newScore);
            } // else: Quiz already completed, do nothing silently or show message

            setQuizCompleted(true);
            setShowQuizModal(false);
            setQuizAnswers(Array(5).fill(''));
            setCurrentQuestionIndex(0);
            setErrors(['¡Felicidades! Has ganado 10 puntos extra.']);
        } catch (err: any) {
             setErrors([`No pudimos guardar tus puntos: ${err.message}`]);
        }
    } else {
      // Keep user in modal to let them correct answers
      setErrors(['No todas las respuestas son correctas. ¡Revisa y corrige!']);
    }
  };

  // Fetch Data Function (Remain Unchanged Logic)
  const fetchData = useCallback(async () => {
    if (!user || !isSignedIn) return;
    setErrors([]); // Clear errors on fetch

    const startTime = performance.now();
    const fetchErrors: string[] = [];
    const minDuration = 2000; // Slightly shorter min duration

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
        supabase.from('leaderboard').select('*').eq('user_id', userId).maybeSingle(), // Use maybeSingle
        supabase.from('predictions').select('*').eq('user_id', userId).order('submitted_at', { ascending: false }),
        supabase.from('prediction_scores').select('gp_name, race_date, score').eq('user_id', userId).order('race_date', { ascending: false }),
        supabase.from('gp_schedule').select('*').order('race_time', { ascending: true }),
      ]);

      // Handle leaderboard data (create entry if needed)
      if (leaderboardError && leaderboardError.code === 'PGRST116') { // Row not found
        const { error: insertError } = await supabase.from('leaderboard').insert({ user_id: userId, name: userName, score: 0, quiz_completed: false, signup_bonus_claimed: false });
        if (insertError) fetchErrors.push(`Error al registrar usuario: ${insertError.message}`);
        else { setSeasonScore(0); setQuizCompleted(false); setSignupBonusClaimed(false); }
      } else if (leaderboardError) fetchErrors.push(`Error al cargar tu puntaje: ${leaderboardError.message}`);
      else if (leaderboardData) {
        setSeasonScore(leaderboardData.score ?? 0);
        setQuizCompleted(leaderboardData.quiz_completed ?? false);
        setSignupBonusClaimed(leaderboardData.signup_bonus_claimed ?? false);
      }

      // Handle predictions
      if (predictionsError) fetchErrors.push(`Error al cargar predicciones: ${predictionsError.message}`);
      setPastPredictions(predictionsData || []);

      // Handle scores
      if (scoresError) console.warn('Error fetching prediction scores:', scoresError.message); // Log warning, don't push to UI errors unless critical
      const map = new Map<string, number>();
      (scoresData || []).forEach((score) => map.set(`${score.gp_name}-${score.race_date}`, score.score));
      setScoreMap(map);
      setPastScores(scoresData || []); // Still set pastScores even if map fails

      // Handle schedule
      if (scheduleError) fetchErrors.push(`Error al cargar calendario: ${scheduleError.message}`);
      setGpSchedule(scheduleData || []);

      // Determine previous GP and fetch its results
      const now = new Date();
      let previousGpIndex = -1;
      for (let i = 0; i < (scheduleData?.length ?? 0); i++) {
        const raceDate = new Date(scheduleData![i].race_time);
        if (raceDate < now) previousGpIndex = i;
      }

      if (previousGpIndex >= 0 && scheduleData) {
        const previousGp = scheduleData[previousGpIndex];
        const raceDateStr = previousGp.race_time.split('T')[0];
        const { data: resultsData, error: resultsError } = await supabase.from('race_results').select('*').eq('gp_name', previousGp.gp_name).eq('race_date', raceDateStr).maybeSingle();
        if (resultsError) fetchErrors.push(`Error al cargar resultados previos: ${resultsError.message}`);
        setPreviousResults(resultsData || null);
      } else setPreviousResults(null);

    } catch (err: any) {
      fetchErrors.push(err.message || 'Ocurrió un error inesperado al cargar tus datos.');
      console.error('Fetch error:', err);
    } finally {
      setErrors(fetchErrors);
      const elapsed = performance.now() - startTime;
      setLoadingDuration(Math.max(minDuration, elapsed)); // Ensure min duration but allow longer
      setIsDataLoaded(true); // Set loaded regardless of errors (errors will be displayed)
    }
  }, [getToken, isSignedIn, user]); // Dependencies remain the same

  // Effect Hook (Remain Unchanged)
  useEffect(() => {
    if (isLoaded && isSignedIn && user) { // Ensure Clerk is fully loaded before fetching
        fetchData();
    } else if (isLoaded && !isSignedIn) {
        setIsDataLoaded(true); // Allow rendering the "Please sign in" message
        setLoadingDuration(0); // No need for loading animation
    }
  }, [isLoaded, isSignedIn, user, fetchData]);

  // Render Logic
  if (!isLoaded || !isDataLoaded) {
    // Use loadingDuration state for the animation
    return <LoadingAnimation text="Cargando tu panel..." animationDuration={loadingDuration / 1000} />;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white flex flex-col items-center justify-center p-8 text-center">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <h1 className="text-2xl font-bold text-amber-400 mb-4 font-exo2">Acceso Requerido</h1>
            <p className="text-lg text-gray-300 mb-6 font-exo2">Por favor, inicia sesión para ver tu panel de F1 Fantasy y seguir tu progreso.</p>
            <Link href="/sign-in" passHref legacyBehavior>
                <motion.a
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="inline-block px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-exo2 font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                    Iniciar Sesión
                </motion.a>
            </Link>
        </motion.div>
      </div>
    );
  }

  // Main Panel JSX
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-white overflow-x-hidden relative isolate">
       {/* Optional: Subtle background pattern */}
       {/* <div className="absolute inset-0 bg-[url('/path/to/subtle-pattern.svg')] opacity-[0.03] z-[-1]"></div> */}

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">

        {/* Hero Section with CTAs - Enhanced */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <div
            className="animate-rotate-border rounded-xl p-0.5 [--border-angle:180deg]"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 20deg, #a855f7cc 40deg, #c084fccc 60deg, #a855f7cc 80deg, transparent 100deg, transparent 360deg)`,
              animationDuration: '8s', // Slower rotation
              willChange: 'background',
            }}
          >
            <div className="bg-gradient-to-br from-gray-950 via-black to-gray-900 p-6 sm:p-8 rounded-xl shadow-2xl text-center relative overflow-hidden">
                {/* Added subtle glow effect */}
               <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-radial-gradient from-purple-900/20 via-transparent to-transparent animate-pulse opacity-50 z-0"></div>

                <div className='relative z-10'>
                   <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 font-exo2 drop-shadow-lg">
                        ¡Bienvenido, <span className='text-purple-400'>{getUserName()}</span>!
                    </h2>
                    <p className="text-gray-300 mb-6 font-exo2 max-w-2xl mx-auto text-base sm:text-lg">
                        Aquí puedes seguir tu progreso, ver resultados y conectar con otros fans. ¡Únete a la competencia!
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
                      <Link href="/ligas-fantasy" passHref legacyBehavior prefetch>
                        <motion.a
                          whileHover={{ scale: 1.05, y: -2, transition: { duration: 0.1 } }}
                          whileTap={{ scale: 0.95, transition: { duration: 0.05 } }}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full font-exo2 font-semibold transition-all shadow-lg hover:shadow-purple-500/30"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                          Explorar Ligas
                        </motion.a>
                      </Link>
                      <Link href="/paddock" passHref legacyBehavior prefetch>
                        <motion.a
                          whileHover={{ scale: 1.05, y: -2, transition: { duration: 0.1 } }}
                          whileTap={{ scale: 0.95, transition: { duration: 0.05 } }}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-full font-exo2 font-semibold transition-all shadow-lg hover:shadow-cyan-500/30"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1z" /></svg>
                          Ir al Paddock
                        </motion.a>
                      </Link>
                    </div>
                </div>
            </div>
          </div>
        </motion.div>

        {/* Row 1: Key Highlights - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {/* Season Score Card */}
          <div className="animate-rotate-border rounded-xl p-px [--border-angle:90deg]" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #facc15 20deg, #f59e0b 30deg, #facc15 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '4s' }}>
            <div className="relative group bg-gradient-to-br from-gray-950 via-black to-gray-900 p-4 sm:p-5 rounded-xl shadow-lg z-10 min-h-[200px] flex flex-col justify-between overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-900/10 to-black/60 backdrop-blur-sm z-0 pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col h-full">
                <motion.h3 className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight mb-2 flex items-center gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM15 2a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0V6h-1a1 1 0 110-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" /></svg>
                  Puntaje de Temporada
                </motion.h3>
                <div className="flex flex-col items-center justify-center flex-grow gap-1 my-3">
                  <AnimatePresence mode="wait">
                      <motion.span
                        key={seasonScore ?? 'loading'}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                        className="text-3xl sm:text-4xl lg:text-5xl font-bold text-amber-400 font-mono tracking-tight drop-shadow-lg" // Monospaced font for score
                      >
                        {seasonScore !== null ? seasonScore : '---'}
                      </motion.span>
                   </AnimatePresence>
                  <span className="text-sm text-gray-400 font-exo2">puntos</span>
                </div>
                {/* Bonus/Quiz Buttons Area */}
                 <div className="flex flex-col gap-2 mt-auto items-center">
                  {!signupBonusClaimed && seasonScore !== null && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleClaimSignupBonus} className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-500 text-white rounded-lg font-exo2 text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 5a3 3 0 015.242-2.121l2.472 2.472a.75.75 0 010 1.061l-2.472 2.472A3 3 0 015 9V5zm10 0a3 3 0 015.242 2.121l2.472-2.472a.75.75 0 010-1.061l-2.472-2.472A3 3 0 0115 5V9zm-5 5a3 3 0 01-5.242 2.121l-2.472-2.472a.75.75 0 010-1.061l2.472-2.472A3 3 0 019 10v4zm5 0a3 3 0 01-5.242-2.121l-2.472 2.472a.75.75 0 010 1.061l2.472 2.472A3 3 0 0111 14v-4z" clipRule="evenodd" /></svg>
                      ¡Reclama Bono (+10 pts)!
                    </motion.button>
                  )}
                  {!quizCompleted && seasonScore !== null && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowQuizModal(true)} className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-500 text-white rounded-lg font-exo2 text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.502l-1.5 2.5a1 1 0 101.734.996L10 8.303l.633 1.195a1 1 0 101.734-.996l-1.5-2.5A1 1 0 0010 7zm0 4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
                       Trivia Bonus (+10 pts)
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Last Winner Card */}
           <div className="animate-rotate-border rounded-xl p-px [--border-angle:180deg]" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #e11d48cc 20deg, #f43f5ecc 30deg, #e11d48cc 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '5s', animationDirection: 'reverse' }}>
            <motion.div className={`relative p-4 sm:p-5 rounded-xl shadow-lg z-10 bg-gradient-to-br h-full min-h-[200px] overflow-hidden flex flex-col ${previousResults?.gp1 && driverToTeam[previousResults.gp1] ? `${teamColors[driverToTeam[previousResults.gp1]].gradientFrom} ${teamColors[driverToTeam[previousResults.gp1]].gradientTo}`: 'from-gray-800 to-gray-700'}`}>
              <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/40 to-transparent z-0 pointer-events-none" />
              <div className="relative z-10 flex flex-col h-full">
                  <h3 className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight mb-2 flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.122 3.108a.75.75 0 00-1.244 0l-1.47 2.994a.75.75 0 00.562 1.102h2.94a.75.75 0 00.562-1.102l-1.47-2.994zM10 7.75a.75.75 0 01.75.75v1.748l1.47 1.47a.75.75 0 11-1.06 1.06l-1.72-1.72V8.5a.75.75 0 01-.75-.75zM10 18a8 8 0 100-16 8 8 0 000 16zm0 1a9 9 0 100-18 9 9 0 000 18z" clipRule="evenodd" /></svg>
                      Último Ganador
                  </h3>
                  <div className="flex-grow flex flex-col justify-center pr-[40%] sm:pr-[45%]">
                    {previousResults?.gp1 ? (
                      <>
                        <p className="text-lg sm:text-xl font-bold text-white font-exo2 leading-tight drop-shadow-md">
                          {previousResults.gp1}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight drop-shadow-md">
                          {driverToTeam[previousResults.gp1] || 'Equipo Desconocido'}
                        </p>
                         <p className="text-[10px] text-gray-400 font-exo2 leading-tight mt-1">{previousResults.gp_name}</p>
                      </>
                    ) : (
                       <p className="text-gray-400 font-exo2 text-sm">Esperando resultados...</p>
                    )}
                  </div>
              </div>
               {previousResults?.gp1 && (
                <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
                   <Image
                      src={getDriverImage(previousResults.gp1)}
                      alt={previousResults.gp1}
                      width={180} height={180} // Slightly larger base size
                      className="absolute bottom-0 right-[-10px] w-[55%] sm:w-[60%] max-w-[180px] h-auto object-contain object-bottom drop-shadow-xl"
                   />
                 </motion.div>
               )}
            </motion.div>
          </div>

           {/* Last Pole Card */}
          <div className="animate-rotate-border rounded-xl p-px [--border-angle:270deg]" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #2563ebcc 20deg, #3b82f6cc 30deg, #2563ebcc 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '6s' }}>
             <motion.div className={`relative p-4 sm:p-5 rounded-xl shadow-lg z-10 bg-gradient-to-br h-full min-h-[200px] overflow-hidden flex flex-col ${previousResults?.pole1 && driverToTeam[previousResults.pole1] ? `${teamColors[driverToTeam[previousResults.pole1]].gradientFrom} ${teamColors[driverToTeam[previousResults.pole1]].gradientTo}` : 'from-gray-800 to-gray-700'}`}>
                <div className="absolute inset-0 bg-gradient-to-bl from-black/70 via-black/40 to-transparent z-0 pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full">
                  <h3 className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight mb-2 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h1.642a.75.75 0 01.69.447l.447 1.118H12a3 3 0 013 3v1h1.75a.75.75 0 010 1.5H15v1a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm3-1.5a1.5 1.5 0 00-1.5 1.5v6a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V7.5a1.5 1.5 0 00-1.5-1.5H9.94a.75.75 0 01-.69-.447L8.804 4.5H6z" clipRule="evenodd" /></svg>
                       Última Pole Position
                  </h3>
                   <div className="flex-grow flex flex-col justify-center pr-[40%] sm:pr-[45%]">
                    {previousResults?.pole1 ? (
                      <>
                        <p className="text-lg sm:text-xl font-bold text-white font-exo2 leading-tight drop-shadow-md">
                          {previousResults.pole1}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight drop-shadow-md">
                          {driverToTeam[previousResults.pole1] || 'Equipo Desconocido'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-exo2 leading-tight mt-1">{previousResults.gp_name}</p>
                      </>
                    ) : (
                       <p className="text-gray-400 font-exo2 text-sm">Esperando resultados...</p>
                    )}
                  </div>
              </div>
               {previousResults?.pole1 && (
                 <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
                   <Image
                      src={getDriverImage(previousResults.pole1)}
                      alt={previousResults.pole1}
                      width={180} height={180}
                      className="absolute bottom-0 right-[-10px] w-[55%] sm:w-[60%] max-w-[180px] h-auto object-contain object-bottom drop-shadow-xl"
                   />
                 </motion.div>
               )}
            </motion.div>
          </div>
        </div>

        {/* Row 2: Additional Results - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {/* Fastest Lap Card */}
           <div className="animate-rotate-border rounded-xl p-px [--border-angle:0deg]" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22c55ecc 20deg, #86efaccc 30deg, #22c55ecc 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '7s' }}>
             <motion.div className={`relative p-4 sm:p-5 rounded-xl shadow-lg z-10 bg-gradient-to-br h-full min-h-[200px] overflow-hidden flex flex-col ${previousResults?.fastest_lap_driver && driverToTeam[previousResults.fastest_lap_driver] ? `${teamColors[driverToTeam[previousResults.fastest_lap_driver]].gradientFrom} ${teamColors[driverToTeam[previousResults.fastest_lap_driver]].gradientTo}` : 'from-gray-800 to-gray-700'}`}>
                 <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/40 to-transparent z-0 pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full">
                 <h3 className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" /></svg>
                      Vuelta Más Rápida
                  </h3>
                   <div className="flex-grow flex flex-col justify-center pr-[40%] sm:pr-[45%]">
                     {previousResults?.fastest_lap_driver ? (
                      <>
                        <p className="text-lg sm:text-xl font-bold text-white font-exo2 leading-tight drop-shadow-md">
                          {previousResults.fastest_lap_driver}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight drop-shadow-md">
                          {driverToTeam[previousResults.fastest_lap_driver] || 'Equipo Desconocido'}
                        </p>
                         <p className="text-[10px] text-gray-400 font-exo2 leading-tight mt-1">{previousResults.gp_name}</p>
                      </>
                    ) : (
                       <p className="text-gray-400 font-exo2 text-sm">Esperando resultados...</p>
                    )}
                  </div>
              </div>
               {previousResults?.fastest_lap_driver && (
                 <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.25 }}>
                    <Image
                      src={getDriverImage(previousResults.fastest_lap_driver)}
                      alt={previousResults.fastest_lap_driver}
                       width={180} height={180}
                      className="absolute bottom-0 right-[-10px] w-[55%] sm:w-[60%] max-w-[180px] h-auto object-contain object-bottom drop-shadow-xl"
                   />
                 </motion.div>
               )}
            </motion.div>
          </div>

          {/* Driver of the Day Card */}
          <div className="animate-rotate-border rounded-xl p-px [--border-angle:90deg]" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '6s', animationDirection: 'reverse' }}>
             <motion.div className={`relative p-4 sm:p-5 rounded-xl shadow-lg z-10 bg-gradient-to-br h-full min-h-[200px] overflow-hidden flex flex-col ${previousResults?.driver_of_the_day && driverToTeam[previousResults.driver_of_the_day] ? `${teamColors[driverToTeam[previousResults.driver_of_the_day]].gradientFrom} ${teamColors[driverToTeam[previousResults.driver_of_the_day]].gradientTo}` : 'from-gray-800 to-gray-700'}`}>
                <div className="absolute inset-0 bg-gradient-to-bl from-black/70 via-black/40 to-transparent z-0 pointer-events-none" />
                 <div className="relative z-10 flex flex-col h-full">
                  <h3 className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight mb-2 flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      Piloto del Día
                  </h3>
                  <div className="flex-grow flex flex-col justify-center pr-[40%] sm:pr-[45%]">
                    {previousResults?.driver_of_the_day ? (
                       <>
                        <p className="text-lg sm:text-xl font-bold text-white font-exo2 leading-tight drop-shadow-md">
                          {previousResults.driver_of_the_day}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight drop-shadow-md">
                           {driverToTeam[previousResults.driver_of_the_day] || 'Equipo Desconocido'}
                        </p>
                         <p className="text-[10px] text-gray-400 font-exo2 leading-tight mt-1">{previousResults.gp_name}</p>
                      </>
                    ) : (
                       <p className="text-gray-400 font-exo2 text-sm">Esperando resultados...</p>
                    )}
                  </div>
              </div>
               {previousResults?.driver_of_the_day && (
                 <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
                    <Image
                      src={getDriverImage(previousResults.driver_of_the_day)}
                      alt={previousResults.driver_of_the_day}
                       width={180} height={180}
                       className="absolute bottom-0 right-[-10px] w-[55%] sm:w-[60%] max-w-[180px] h-auto object-contain object-bottom drop-shadow-xl"
                   />
                 </motion.div>
               )}
            </motion.div>
          </div>

          {/* First Team to Pit Card */}
          <div className="animate-rotate-border rounded-xl p-px [--border-angle:180deg]" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #06b6d4cc 20deg, #22d3eecc 30deg, #06b6d4cc 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '5.5s' }}>
            <motion.div className={`relative p-4 sm:p-5 rounded-xl shadow-lg z-10 bg-gradient-to-br h-full min-h-[200px] overflow-hidden flex flex-col items-center justify-between ${previousResults?.first_team_to_pit ? `${teamColors[previousResults.first_team_to_pit]?.gradientFrom || 'from-gray-800'} ${teamColors[previousResults.first_team_to_pit]?.gradientTo || 'to-gray-700'}`: 'from-gray-800 to-gray-700'}`}>
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/70 z-0 pointer-events-none" />
                <div className="relative z-20 w-full text-center flex-shrink-0">
                    <h3 className="text-base sm:text-lg font-semibold text-white font-exo2 mb-1 flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.126 1.461a.75.75 0 011.748 0l5.108 10.216a.75.75 0 01-.62 1.073H4.64a.75.75 0 01-.62-1.073L9.126 1.46zm1.675 12.03a.75.75 0 01-1.602 0V8.83a.75.75 0 011.602 0v4.661zM10 15.75a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd" /></svg>
                        Primer Equipo en Pits
                    </h3>
                    {previousResults?.first_team_to_pit ? (
                        <p className="text-sm sm:text-base text-cyan-200 font-exo2 drop-shadow-md font-medium">
                        {previousResults.first_team_to_pit}
                        </p>
                    ) : (
                        <p className="text-gray-400 font-exo2 text-sm mt-1">Esperando resultados...</p>
                    )}
                </div>
               {previousResults?.first_team_to_pit && (
                    <motion.div
                       initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
                       className="w-full max-w-[300px] h-auto mt-2 relative z-10 flex-grow flex items-end justify-center" // Flex grow to push image down
                    >
                        <Image
                           src={getTeamCarImage(previousResults.first_team_to_pit)}
                           alt={`${previousResults.first_team_to_pit} car`}
                           width={546} height={273} // Aspect ratio
                           className="object-contain w-full h-auto drop-shadow-xl"
                        />
                     </motion.div>
                )}
                 {!previousResults?.first_team_to_pit && (
                    <div className="flex-grow flex items-center justify-center text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                    </div>
                 )}
            </motion.div>
          </div>
        </div>

        {/* Row 3: Past Predictions - Enhanced */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="animate-rotate-border rounded-xl p-px [--border-angle:30deg]"
             style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #be185dcc 20deg, #f9a8d4cc 30deg, #be185dcc 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '9s', // Slowest rotation
              animationDirection: 'reverse',
            }}
          >
            <div className="bg-gradient-to-br from-gray-950 via-black to-gray-950 p-5 sm:p-8 rounded-xl shadow-xl relative z-10">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 font-exo2 text-center flex items-center justify-center gap-3">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                  Historial de Predicciones
              </h2>
              <div className="space-y-4">
                {pastPredictions.length > 0 ? (
                  pastPredictions.map((pred, index) => {
                    const raceDate = pred.submitted_at.split('T')[0]; // Use submitted date part for score key
                    const scoreKey = `${pred.gp_name}-${raceDate}`;
                    const score = scoreMap.get(scoreKey);
                    const isExpanded = expandedIndex === index;

                    return (
                      <motion.div
                        key={index}
                        layout // Animate layout changes
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="bg-gradient-to-br from-gray-900/70 to-black/70 p-4 sm:p-5 rounded-lg border border-gray-700/50 backdrop-blur-sm shadow-md"
                      >
                        <motion.div
                          className="flex justify-between items-center cursor-pointer"
                          onClick={() => setExpandedIndex(isExpanded ? null : index)}
                        >
                          <div className='flex flex-col sm:flex-row sm:items-center sm:gap-3'>
                            <p className="text-base sm:text-lg font-semibold text-pink-400 font-exo2">
                              {pred.gp_name}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              Enviado: {new Date(pred.submitted_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })}
                           </p>
                          </div>
                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-400" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </motion.div>
                        </motion.div>

                         {/* Expandable Content */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                  animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }}
                                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                  transition={{ duration: 0.3, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-gray-300 font-exo2 text-sm border-t border-gray-700/50 pt-4">
                                       {/* Column 1 */}
                                        <div className='space-y-1.5'>
                                           <p><strong className='text-gray-100 font-medium w-[80px] inline-block'>Pole P1:</strong> {pred.pole1 || <span className="text-gray-500 italic">N/A</span>}</p>
                                           <p><strong className='text-gray-100 font-medium w-[80px] inline-block'>Pole P2:</strong> {pred.pole2 || <span className="text-gray-500 italic">N/A</span>}</p>
                                           <p><strong className='text-gray-100 font-medium w-[80px] inline-block'>Pole P3:</strong> {pred.pole3 || <span className="text-gray-500 italic">N/A</span>}</p>
                                           <hr className="border-gray-700 my-2 md:hidden" />
                                           <p><strong className='text-gray-100 font-medium w-[80px] inline-block'>GP P1:</strong> {pred.gp1 || <span className="text-gray-500 italic">N/A</span>}</p>
                                           <p><strong className='text-gray-100 font-medium w-[80px] inline-block'>GP P2:</strong> {pred.gp2 || <span className="text-gray-500 italic">N/A</span>}</p>
                                           <p><strong className='text-gray-100 font-medium w-[80px] inline-block'>GP P3:</strong> {pred.gp3 || <span className="text-gray-500 italic">N/A</span>}</p>
                                        </div>
                                        {/* Column 2 */}
                                         <div className='space-y-1.5'>
                                           <p><strong className='text-gray-100 font-medium w-[130px] inline-block'>Pit Stop Rápido:</strong> {pred.fastest_pit_stop_team || <span className="text-gray-500 italic">N/A</span>}</p>
                                           <p><strong className='text-gray-100 font-medium w-[130px] inline-block'>Vuelta Rápida:</strong> {pred.fastest_lap_driver || <span className="text-gray-500 italic">N/A</span>}</p>
                                           <p><strong className='text-gray-100 font-medium w-[130px] inline-block'>Piloto del Día:</strong> {pred.driver_of_the_day || <span className="text-gray-500 italic">N/A</span>}</p>
                                           <p><strong className='text-gray-100 font-medium w-[130px] inline-block'>1er Equipo Pits:</strong> {pred.first_team_to_pit || <span className="text-gray-500 italic">N/A</span>}</p>
                                           {/* Display Score if available */}
                                           {score !== undefined && (
                                             <p className="mt-3 pt-3 border-t border-gray-700/50">
                                                <strong className='text-green-400 font-bold text-base'>Puntaje Obtenido: {score} puntos</strong>
                                             </p>
                                           )}
                                            {score === undefined && (
                                                <p className="mt-3 pt-3 border-t border-gray-700/50 text-gray-500 italic">Puntaje aún no calculado.</p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                             )}
                         </AnimatePresence>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className='text-center py-10'>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}> <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                     <p className="text-gray-400 font-exo2 text-lg">No has enviado ninguna predicción todavía.</p>
                     <Link href="/jugar-y-gana" passHref legacyBehavior>
                         <motion.a whileHover={{scale: 1.05}} whileTap={{scale: 0.95}} className="mt-4 inline-block px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-500 text-white rounded-full font-exo2 font-semibold transition-all shadow-md">
                             ¡Haz tu primera predicción!
                         </motion.a>
                     </Link>
                   </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

         {/* Quiz Modal - Enhanced Styling */}
         <AnimatePresence>
            {showQuizModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowQuizModal(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                  className="bg-gradient-to-br from-gray-950 via-black to-gray-900 p-6 sm:p-8 rounded-xl border border-amber-500/50 max-w-xl w-full shadow-2xl relative"
                  onClick={(e) => e.stopPropagation()}
                >
                   {/* Close Button */}
                   <button onClick={() => setShowQuizModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-amber-400 transition-colors p-1 z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>

                  <motion.h3
                    initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.3 }}
                    className="text-xl sm:text-2xl font-bold text-amber-400 mb-2 font-exo2 text-center"
                  >
                    F1 Trivia Quiz
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.3 }}
                    className="text-gray-300 mb-6 font-exo2 text-center text-sm sm:text-base"
                  >
                    Responde 5 preguntas y gana <strong className='text-amber-300'>10 puntos extra</strong> si aciertas todas.
                  </motion.p>

                  {/* Question Card with Animation */}
                  <div className="relative min-h-[200px] sm:min-h-[220px]"> {/* Ensure space for animation */}
                      <AnimatePresence mode="wait">
                          <motion.div
                            key={currentQuestionIndex}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="bg-gray-800/70 p-4 sm:p-5 rounded-lg border border-gray-700/40 shadow-inner"
                          >
                            <p className="text-gray-100 mb-4 font-exo2 text-base sm:text-lg font-medium">
                              {currentQuestionIndex + 1}. {quizQuestions[currentQuestionIndex].question}
                            </p>
                            <div className="grid grid-cols-1 gap-2.5">
                              {quizQuestions[currentQuestionIndex].options.map((option) => (
                                <motion.button
                                  key={option}
                                  whileHover={{ scale: 1.03, backgroundColor: 'rgba(55, 65, 81, 0.9)' }} // Tailwind bg-gray-700 equivalent
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleQuizAnswer(option)}
                                  className={`w-full text-left px-4 py-2.5 rounded-md font-exo2 text-sm sm:text-base transition-all duration-200 border ${
                                    quizAnswers[currentQuestionIndex] === option
                                      ? 'bg-amber-600 border-amber-500 text-white font-semibold shadow-md'
                                      : 'bg-gray-900/80 border-gray-700 text-amber-200 hover:border-amber-500/70 hover:text-amber-100'
                                  }`}
                                >
                                  {option}
                                </motion.button>
                              ))}
                            </div>
                          </motion.div>
                     </AnimatePresence>
                   </div>

                  {/* Navigation and Submission */}
                  <div className="flex justify-between items-center mt-6">
                    <motion.button
                       whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                       onClick={handlePreviousQuestion}
                       disabled={currentQuestionIndex === 0}
                       className={`px-5 py-2.5 rounded-lg font-exo2 font-semibold transition-all text-sm sm:text-base ${
                         currentQuestionIndex === 0
                           ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                           : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                       }`}
                    >
                      Anterior
                    </motion.button>

                    {/* Progress Indicator - Enhanced */}
                     <div className="flex justify-center gap-2 sm:gap-3">
                        {quizQuestions.map((_, index) => (
                            <motion.div
                                key={index}
                                animate={{ scale: index === currentQuestionIndex ? 1.3 : 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-colors duration-300 ${
                                index === currentQuestionIndex ? 'bg-amber-500 shadow-lg shadow-amber-500/50' : (quizAnswers[index] ? 'bg-amber-700/80' : 'bg-gray-600')
                                }`}
                            />
                        ))}
                    </div>

                    {currentQuestionIndex === quizQuestions.length - 1 ? (
                      <motion.button
                         whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={handleQuizSubmit}
                        disabled={quizAnswers.some((answer) => !answer)}
                        className={`px-5 py-2.5 rounded-lg font-exo2 font-semibold transition-all text-sm sm:text-base ${
                          quizAnswers.some((answer) => !answer)
                            ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-400 shadow-md'
                        }`}
                      >
                        Enviar Quiz
                      </motion.button>
                    ) : (
                      <motion.button
                         whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={handleNextQuestion}
                        disabled={!quizAnswers[currentQuestionIndex]}
                        className={`px-5 py-2.5 rounded-lg font-exo2 font-semibold transition-all text-sm sm:text-base ${
                          quizAnswers[currentQuestionIndex]
                             ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white hover:from-amber-500 hover:to-orange-400 shadow-md'
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Siguiente
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
         </AnimatePresence>

        {/* Error Messages Display */}
        <AnimatePresence>
            {errors.length > 0 && (
              <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: 10 }}
                 className="mt-8 max-w-3xl mx-auto text-center text-red-300 font-exo2 bg-red-900/40 p-3 sm:p-4 rounded-lg border border-red-600/50 shadow-lg"
              >
                {errors.map((error, index) => (
                  <p key={index} className="text-sm sm:text-base">{error}</p>
                ))}
              </motion.div>
            )}
        </AnimatePresence>
      </main>

        {/* Optional Footer? */}
        {/* <footer className="text-center p-4 text-xs text-gray-600">
            MotorManía Fantasy Panel
        </footer> */}
    </div>
  );
}