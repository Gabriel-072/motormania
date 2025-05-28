'use client';

// SECTION: Imports
import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { createAuthClient } from '@/lib/supabase';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import LoadingAnimation from '@/components/LoadingAnimation';
import Standings from '@/components/Standings'; // Assuming this component exists if needed elsewhere, but not used directly in the provided code snippet
import { Howl } from 'howler';
import { Suspense } from 'react';
import { generateEventId, trackFBEvent } from '@/lib/trackFBEvent';
import { DriverStanding, ConstructorStanding, RookieStanding, DestructorStanding, Team } from '@/app/types/standings';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/solid';

// SECTION: Type Definitions
type Prediction = {
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

type LeaderboardEntry = { user_id: string; name: string; score: number; updated_at: string };
type Driver = { driverId: string; givenName: string; familyName: string; permanentNumber: string; image: string };
type GpSchedule = { gp_name: string; qualy_time: string; race_time: string };
type RaceResult = {
  gp_name: string;
  race_date: string;
  pole1: string;
  gp1: string;
  gp2: string;
  gp3: string;
  fastest_pit_stop_team: string;
  fastest_lap_driver: string;
  driver_of_the_day: string;
  first_team_to_pit: string;
  first_retirement: string;
};

// SECTION: Props Interface
interface FantasyProps {
  triggerSignInModal?: () => void; // Optional function to trigger sign-in modal
}

// SECTION: Static Drivers
const staticDrivers: Driver[] = [
  { driverId: 'verstappen', givenName: 'Max', familyName: 'Verstappen', permanentNumber: '1', image: '/images/pilots/max-verstappen.png' },
  { driverId: 'tsunoda', givenName: 'Yuki', familyName: 'Tsunoda', permanentNumber: '22', image: '/images/pilots/yuki-tsunoda.png' },
  { driverId: 'norris', givenName: 'Lando', familyName: 'Norris', permanentNumber: '4', image: '/images/pilots/lando-norris.png' },
  { driverId: 'piastri', givenName: 'Oscar', familyName: 'Piastri', permanentNumber: '81', image: '/images/pilots/oscar-piastri.png' },
  { driverId: 'hamilton', givenName: 'Lewis', familyName: 'Hamilton', permanentNumber: '44', image: '/images/pilots/lewis-hamilton.png' },
  { driverId: 'leclerc', givenName: 'Charles', familyName: 'Leclerc', permanentNumber: '16', image: '/images/pilots/charles-leclerc.png' },
  { driverId: 'russell', givenName: 'George', familyName: 'Russell', permanentNumber: '63', image: '/images/pilots/george-russell.png' },
  { driverId: 'antonelli', givenName: 'Kimi', familyName: 'Antonelli', permanentNumber: '12', image: '/images/pilots/kimi-antonelli.png' },
  { driverId: 'alonso', givenName: 'Fernando', familyName: 'Alonso', permanentNumber: '14', image: '/images/pilots/fernando-alonso.png' },
  { driverId: 'stroll', givenName: 'Lance', familyName: 'Stroll', permanentNumber: '18', image: '/images/pilots/lance-stroll.png' },
  { driverId: 'lawson', givenName: 'Liam', familyName: 'Lawson', permanentNumber: '30', image: '/images/pilots/liam-lawson.png' },
  { driverId: 'hadjar', givenName: 'Isack', familyName: 'Hadjar', permanentNumber: '20', image: '/images/pilots/isack-hadjar.png' },
  { driverId: 'hulkenberg', givenName: 'Nico', familyName: 'Hulkenberg', permanentNumber: '27', image: '/images/pilots/nico-hulkenberg.png' },
  { driverId: 'bortoleto', givenName: 'Gabriel', familyName: 'Bortoleto', permanentNumber: '19', image: '/images/pilots/gabriel-bortoleto.png' },
  { driverId: 'gasly', givenName: 'Pierre', familyName: 'Gasly', permanentNumber: '10', image: '/images/pilots/pierre-gasly.png' },
  { driverId: 'colapinto', givenName: 'Franco', familyName: 'Colapinto', permanentNumber: '7', image: '/images/pilots/franco-colapinto.png' },
  { driverId: 'albon', givenName: 'Alex', familyName: 'Albon', permanentNumber: '23', image: '/images/pilots/alex-albon.png' },
  { driverId: 'sainz', givenName: 'Carlos', familyName: 'Sainz', permanentNumber: '55', image: '/images/pilots/carlos-sainz.png' },
  { driverId: 'bearman', givenName: 'Oliver', familyName: 'Bearman', permanentNumber: '38', image: '/images/pilots/oliver-bearman.png' },
  { driverId: 'ocon', givenName: 'Esteban', familyName: 'Ocon', permanentNumber: '31', image: '/images/pilots/esteban-ocon.png' },
];

// SECTION: Team Colors
const teamColors: Record<string, { gradientFrom: string; gradientTo: string; border: string }> = {
  'Red Bull Racing': { gradientFrom: 'from-blue-900', gradientTo: 'to-blue-700', border: 'border-blue-500/50' },
  'McLaren': { gradientFrom: 'from-orange-600', gradientTo: 'to-orange-400', border: 'border-orange-500/50' },
  'Mercedes': { gradientFrom: 'from-teal-700', gradientTo: 'to-teal-500', border: 'border-teal-500/50' },
  'Ferrari': { gradientFrom: 'from-red-800', gradientTo: 'to-red-600', border: 'border-red-500/50' },
  'Aston Martin': { gradientFrom: 'from-green-800', gradientTo: 'to-green-600', border: 'border-green-500/50' },
  'RB': { gradientFrom: 'from-blue-600', gradientTo: 'to-blue-400', border: 'border-blue-400/50' },
  'Haas F1 Team': { gradientFrom: 'from-gray-700', gradientTo: 'to-gray-500', border: 'border-gray-500/50' },
  'Alpine': { gradientFrom: 'from-blue-800', gradientTo: 'to-pink-600', border: 'border-blue-500/50' },
  'Williams': { gradientFrom: 'from-blue-500', gradientTo: 'to-blue-300', border: 'border-blue-300/50' },
  'Sauber': { gradientFrom: 'from-green-600', gradientTo: 'to-green-400', border: 'border-green-400/50' },
  'Default': { gradientFrom: 'from-gray-700', gradientTo: 'to-gray-600', border: 'border-gray-500/50' },
};

// SECTION: Driver to Team Mapping (Ensure this is accurate for 2025)
const driverToTeam: Record<string, string> = {
  'Max Verstappen': 'Red Bull',
  'Yuki Tsunoda': 'Red Bull', 
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

// SECTION: Flag Mapping
const gpFlags: Record<string, string> = {
  'Japanese Grand Prix': '/flags/japan.gif',
  'Monaco Grand Prix': '/flags/monaco.gif',
  'British Grand Prix': '/flags/uk.gif',
  'Bahrain Grand Prix': '/flags/bahrain.gif',
  'Saudi Arabian Grand Prix': '/flags/saudi.gif',
  'Australian Grand Prix': '/flags/australia.gif',
  'Chinese Grand Prix': '/flags/china.gif',
  'Miami Grand Prix': '/flags/usa.gif',
  'Emilia Romagna Grand Prix': '/flags/italy.gif',
  'Canadian Grand Prix': '/flags/canada.gif',
  'Spanish Grand Prix': '/flags/spain.gif',
  'Austrian Grand Prix': '/flags/austria.gif',
  'Hungarian Grand Prix': '/flags/hungary.gif',
  'Belgian Grand Prix': '/flags/belgium.gif',
  'Dutch Grand Prix': '/flags/netherlands.gif',
  'Italian Grand Prix': '/flags/italy.gif',
  'Azerbaijan Grand Prix': '/flags/azerbaijan.gif',
  'Singapore Grand Prix': '/flags/singapore.gif',
  'United States Grand Prix': '/flags/usa.gif',
  'Mexico City Grand Prix': '/flags/mexico.gif',
  'Brazilian Grand Prix': '/flags/brazil.gif',
  'Las Vegas Grand Prix': '/flags/usa.gif',
  'Qatar Grand Prix': '/flags/qatar.gif',
  'Abu Dhabi Grand Prix': '/flags/uae.gif',
};

// SECTION: Sound Manager
const soundManager = {
  click: new Howl({ src: ['/sounds/f1-click.mp3'], volume: 0.2 }),
  menuClick: new Howl({ src: ['/sounds/f1-menu-click.wav'], volume: 0.2 }),
  openMenu: new Howl({ src: ['/sounds/f1-open-menu.wav'], volume: 0.5 }),
  submit: new Howl({ src: ['/sounds/f1-submit.mp3'], volume: 0.3 }),
  rev: new Howl({ src: ['/sounds/f1-rev.mp3'], volume: 0.3 }),
};

// SECTION: Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

// SECTION: Steps and Instructions
const steps = [
  { name: 'pole', label: 'Posiciones de Pole' },
  { name: 'gp', label: 'Posiciones de GP' },
  { name: 'extras', label: 'Predicciones Adicionales' },
  { name: 'micro', label: 'Micro-Predicciones' },
  { name: 'review', label: 'Revisar y Enviar' },
];

const instructions = {
  pole: 'Selecciona los pilotos que crees que ocuparán las primeras tres posiciones en la qualy.',
  gp: 'Selecciona los pilotos que crees que ocuparán las primeras tres posiciones en la carrera.',
  extras: 'Haz tus predicciones adicionales como el equipo con el pit stop más rápido.',
  micro: 'Haz tus micro-predicciones como el primer equipo en hacer pits.',
  review: 'Revisa tus predicciones antes de enviarlas. Puedes hacer clic en una sección para volver a editarla.',
};

// SECTION: Main Component
export default function Fantasy({ triggerSignInModal }: FantasyProps) {
  const { isSignedIn, user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  // SECTION: State Management
  const [hydrated, setHydrated] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const [predictions, setPredictions] = useState<Prediction>({
    pole1: '', pole2: '', pole3: '',
    gp1: '', gp2: '', gp3: '',
    fastest_pit_stop_team: '', fastest_lap_driver: '', driver_of_the_day: '',
    first_team_to_pit: '', first_retirement: '',
  });
  const [submittedPredictions, setSubmittedPredictions] = useState<Prediction | null>(null);
  const [drivers] = useState<Driver[]>(staticDrivers);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([]);
  const [constructorStandings, setConstructorStandings] = useState<ConstructorStanding[]>([]);
  const [rookieStandings, setRookieStandings] = useState<RookieStanding[]>([]);
  const [destructorStandings, setDestructorStandings] = useState<DestructorStanding[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [activeSelectionModal, setActiveSelectionModal] = useState<{ position: keyof Prediction; isTeam: boolean } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [previousGp, setPreviousGp] = useState<GpSchedule | null>(null);
  const [previousResults, setPreviousResults] = useState<RaceResult | null>(null);
  const [userPreviousScore, setUserPreviousScore] = useState<number | null>(null);
  const [isQualyAllowed, setIsQualyAllowed] = useState(true);
  const [isRaceAllowed, setIsRaceAllowed] = useState(true);
  const [qualyCountdown, setQualyCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [raceCountdown, setRaceCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [gpSchedule, setGpSchedule] = useState<GpSchedule[]>([]);
  const [progress, setProgress] = useState(0);
  const [loadingDuration, setLoadingDuration] = useState(3);
  const [showQualy, setShowQualy] = useState(true);
  const hasPlayedRev = useRef(false);
  const [activeStandingsModal, setActiveStandingsModal] = useState<'drivers' | 'constructors' | null>(null);
  const [scoringModalOpen, setScoringModalOpen] = useState(false);
  // ── NUEVO: puntaje GP actual / total ──
  const [gpScore,     setGpScore]     = useState<number | null>(null);   // del último GP corrido
  const [totalScore,  setTotalScore]  = useState<number | null>(null);   // tabla LEADERBOARD
  const [totalRank,   setTotalRank]   = useState<number | null>(null);   // posición en LEADERBOARD
  // justo debajo de tus hooks existing, antes de cualquier useEffect o fetchData
  const [myScore, setMyScore] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [prevGpRank, setPrevGpRank] = useState<number | null>(null);

  // SECTION: Hydration for Clerk
  useEffect(() => {
    if (isLoaded) {
      const timeout = setTimeout(() => {
        setHydrated(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoaded]);

  //Lego promo modal
  useEffect(() => {
    // Solo una vez, 2 s después de montar
    const timer = setTimeout(() => setShowPromoModal(true), 2000);
    return () => clearTimeout(timer);
  }, []);

 // SECTION: Fetch Data Function
 const fetchData = useCallback(async () => {
    const startTime = performance.now();
    const fetchErrors: string[] = [];
    const minDuration = 3000; // Minimum 3 seconds for loading animation

    try {
      let token: string | null = null;
      if (isSignedIn) {
        token = await getToken({ template: 'supabase' });
        if (!token) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          token = await getToken({ template: 'supabase' });
          if (!token) {
            fetchErrors.push('No se pudo obtener el token de autenticación para usuario autenticado.');
          }
        }
      }
      const supabase = createAuthClient(token);

      const [
        { data: teamsData, error: teamsError },
        { data: scheduleData, error: scheduleError },
        { data: leaderboardData, error: leaderboardError },
        { data: driverData, error: driverError },
        { data: constructorData, error: constructorError },
        { data: rookieData, error: rookieError },
        { data: destructorData, error: destructorError },
      ] = await Promise.all([
        supabase.from('teams').select('name, logo_url').order('name'),
        supabase.from('gp_schedule').select('*').order('race_time', { ascending: true }),
        supabase.from('leaderboard').select('*').order('score', { ascending: false }).limit(10),
        supabase.from('driver_standings').select('position, driver, points, evolution').eq('season', 2025).order('position', { ascending: true }).limit(20),
        supabase.from('constructor_standings').select('position, constructor, points, evolution').eq('season', 2025).order('position', { ascending: true }).limit(10),
        supabase.from('rookie_standings').select('position, driver, points, evolution').eq('season', 2025).order('position', { ascending: true }).limit(10),
        supabase.from('destructor_standings').select('position, driver, team, total_costs').eq('season', 2025).order('position', { ascending: true }).limit(10),
      ]);

      if (teamsError) fetchErrors.push('Error al cargar equipos: ' + teamsError.message);
      setTeams(teamsData || []);

      if (scheduleError) fetchErrors.push('Error al cargar calendario: ' + scheduleError.message);
      setGpSchedule(scheduleData || []);

      if (leaderboardError) fetchErrors.push('Error al cargar leaderboard: ' + leaderboardError.message);
      setLeaderboard(leaderboardData || []);

// ——— TRAER MI FILA POR SEPARADO ———
let myRow: LeaderboardEntry | null = null;
if (user) {
  const { data: meData, error: meError } = await supabase
    .from('leaderboard')
    .select('user_id, name, score, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  console.log('🏷️ meData:', meData, 'meError:', meError);
  if (meError) {
    fetchErrors.push('Error al cargar tu puntaje: ' + meError.message);
  } else if (meData) {
    myRow = meData as LeaderboardEntry;
  }
}

console.log('🎯 myRow al final:', myRow);

// Actualiza estado de score/rank inmediatamente
if (myRow) {
  setTotalScore(myRow.score);
const { count, error: countErr } = await supabase
  .from('leaderboard')
  .select('user_id', { head: true, count: 'exact' })
  .gt('score', myRow.score);

if (!countErr) setTotalRank((count ?? 0) + 1);
} else {
  setTotalScore(0);
  setTotalRank(null);
}
// ——— FIN MI FILA ———

      if (driverError) fetchErrors.push('Error al cargar driver standings: ' + driverError.message);
      setDriverStandings(driverData || []);

      if (constructorError) fetchErrors.push('Error al cargar constructor standings: ' + constructorError.message);
      setConstructorStandings(constructorData || []);

      if (rookieError) fetchErrors.push('Error al cargar rookie standings: ' + rookieError.message);
      setRookieStandings(rookieData || []);

      if (destructorError) fetchErrors.push('Error al cargar destructor standings: ' + destructorError.message);
      setDestructorStandings(destructorData || []);

      const now = new Date();
      let currentGpIndex = -1;
      let previousGpIndex = -1;

      for (let i = 0; i < (scheduleData || []).length; i++) {
        const raceDate = new Date(scheduleData![i].race_time);
        // Find the first race that hasn't finished yet
        if (now <= raceDate && currentGpIndex === -1) {
            // Check if there's a previous race, and if its end time + buffer (e.g., 4 hours) has passed
            if (i > 0) {
                const prevRaceEndTime = new Date(scheduleData![i-1].race_time);
                prevRaceEndTime.setHours(prevRaceEndTime.getHours() + 4); // Add buffer time
                if (now < prevRaceEndTime) {
                    currentGpIndex = i - 1; // Still consider the previous race as "current" during the buffer
                } else {
                    currentGpIndex = i; // Move to the next GP
                }
            } else {
                 currentGpIndex = i; // First race of the season
            }
        }
        if (raceDate < now) {
          previousGpIndex = i;
        }
      }

       // If no future race found, the last race might be the current or previous one
       if (currentGpIndex === -1 && (scheduleData || []).length > 0) {
           const lastRaceIndex = scheduleData!.length - 1;
           const lastRaceEndTime = new Date(scheduleData![lastRaceIndex].race_time);
           lastRaceEndTime.setHours(lastRaceEndTime.getHours() + 4); // Add buffer
           if (now < lastRaceEndTime) {
               currentGpIndex = lastRaceIndex;
           } else {
               // Season likely over or between seasons
               previousGpIndex = lastRaceIndex;
           }
       }

      if (currentGpIndex >= 0 && scheduleData) {
        setCurrentGp(scheduleData[currentGpIndex]);
        const qualyDeadline = new Date(scheduleData[currentGpIndex].qualy_time).getTime() - 5 * 60 * 1000; // 5 mins before Qualy
        const raceDeadline = new Date(scheduleData[currentGpIndex].race_time).getTime() - 5 * 60 * 1000; // 5 mins before Race
        setIsQualyAllowed(now.getTime() < qualyDeadline);
        setIsRaceAllowed(now.getTime() < raceDeadline);
      } else {
        // Handle end of season or no schedule data
        setCurrentGp(null);
        setIsQualyAllowed(false);
        setIsRaceAllowed(false);
        if(scheduleData && scheduleData.length > 0) {
            // If season ended, set the last race as previous GP
             previousGpIndex = scheduleData.length - 1;
             setPreviousGp(scheduleData[previousGpIndex]);
        }
      }

      if (previousGpIndex >= 0 && scheduleData) {
        const prevGpToFetch = scheduleData[previousGpIndex];
        setPreviousGp(prevGpToFetch); // Set previous GP regardless of current GP status
        const raceDateStr = prevGpToFetch.race_time.split('T')[0];

        const { data: resultsData, error: resultsError } = await supabase
          .from('race_results')
          .select('*')
          .eq('gp_name', prevGpToFetch.gp_name)
          .eq('race_date', raceDateStr)
          .maybeSingle();

        if (resultsError) fetchErrors.push('No se pudieron cargar los resultados previos: ' + resultsError.message);
        setPreviousResults(resultsData || null);

        // Después de setPreviousResults(...)

if (resultsData && user) {
  const { data: gpScores, error: gpError } = await supabase
    .from('prediction_scores')
    .select('user_id, score')
    .eq('gp_name', resultsData.gp_name)
    .order('score', { ascending: false });

  if (!gpError && gpScores) {
    const idx = gpScores.findIndex(r => r.user_id === user.id);
    setPrevGpRank(idx !== -1 ? idx + 1 : null);   // ← ahora sí se guarda
  }
}

        if (isSignedIn && user) {
          const { data: scoreData, error: scoreError } = await supabase
            .from('prediction_scores')
            .select('score')
            .eq('user_id', user.id)
            .eq('gp_name', prevGpToFetch.gp_name)
            .eq('race_date', raceDateStr)
            .maybeSingle();

          if (scoreError) fetchErrors.push('No se pudo cargar el puntaje anterior: ' + scoreError.message);
          setGpScore(scoreData?.score || null);
        }
      } else if (!previousGp && !currentGp && scheduleData && scheduleData.length > 0){
        // If it's before the first race, there are no previous results for this season yet.
        setPreviousResults(null);
      }
    } catch (err) {
      fetchErrors.push(err instanceof Error ? err.message : 'Error al cargar datos iniciales.');
      console.error('Fetch error:', err);
    } finally {
      setErrors(fetchErrors);
      const elapsed = performance.now() - startTime;
      const duration = Math.max(elapsed / 1000, 3);
      setLoadingDuration(duration);
      if (elapsed < minDuration) {
        setTimeout(() => {
          setIsDataLoaded(true);
        }, minDuration - elapsed);
      } else {
        setIsDataLoaded(true);
      }
    }
  }, [getToken, isSignedIn, user]);

  // SECTION: useEffect Hooks
  useEffect(() => {
    if (!isLoaded || !hydrated) return;
    fetchData();
  }, [fetchData, isLoaded, hydrated]);

  useEffect(() => {
    if (isDataLoaded) {
      setForceRender((prev) => prev + 1);
    }
  }, [isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded && !hasPlayedRev.current) {
      soundManager.rev.play();
      hasPlayedRev.current = true;
    }
  }, [isDataLoaded]);

  // Countdown and GP Switching Logic
  useEffect(() => {
    if (!currentGp || !gpSchedule.length) return;

    const updateCountdown = () => {
      const now = new Date();
      const qualyDate = new Date(currentGp.qualy_time);
      const raceDate = new Date(currentGp.race_time);
      const qualyDeadline = qualyDate.getTime() - 5 * 60 * 1000; // 5 mins before
      const raceDeadline = raceDate.getTime() - 5 * 60 * 1000; // 5 mins before
      const raceEndTimeBuffer = raceDate.getTime() + 4 * 60 * 60 * 1000; // Race end + 4 hours buffer

      let qualyDiff = qualyDate.getTime() - now.getTime();
      let raceDiff = raceDate.getTime() - now.getTime();

      // Update Qualy Countdown
      if (qualyDiff > 0) {
        setQualyCountdown({
          days: Math.floor(qualyDiff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((qualyDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((qualyDiff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((qualyDiff % (1000 * 60)) / 1000),
        });
      } else {
         // If Qualy time passed but race hasn't started, show 0
         // Or if race has passed, show 0
        setQualyCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }

      // Update Race Countdown
      if (raceDiff > 0) {
        setRaceCountdown({
          days: Math.floor(raceDiff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((raceDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((raceDiff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((raceDiff % (1000 * 60)) / 1000),
        });
      } else {
        setRaceCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }

      // Update Prediction Allowed Status
      setIsQualyAllowed(now.getTime() < qualyDeadline);
      setIsRaceAllowed(now.getTime() < raceDeadline);

      // Check if current GP is over (past race time + buffer)
      if (now.getTime() >= raceEndTimeBuffer) {
        const currentIndex = gpSchedule.findIndex((gp) => gp.gp_name === currentGp.gp_name);
        // Check if there's a next GP in the schedule
        if (currentIndex !== -1 && currentIndex < gpSchedule.length - 1) {
          const nextGp = gpSchedule[currentIndex + 1];
          // Only switch if the next GP's race time isn't too far in the future (e.g., > 2 weeks)
          // This prevents switching immediately after a race if there's a long break.
          const nextRaceDate = new Date(nextGp.race_time);
          if (nextRaceDate.getTime() - now.getTime() < 14 * 24 * 60 * 60 * 1000) {
              console.log(`Switching GP from ${currentGp.gp_name} to ${nextGp.gp_name}`);
              setPreviousGp(currentGp); // Current becomes previous
              setCurrentGp(nextGp); // Set next GP as current
              // Refetch data might be needed here if standings/results depend on the absolutely latest info
              // fetchData(); // Consider implications of frequent refetching
          } else {
             // Long break, keep current GP displayed but disable predictions
             console.log(`Long break after ${currentGp.gp_name}, keeping display but disabling predictions.`);
             // Predictions already disabled by time checks above
          }
        } else {
          // Last race of the season is over
          console.log(`Last race ${currentGp.gp_name} finished.`);
          setPreviousGp(currentGp); // Keep the last race as previous
          setCurrentGp(null); // No current GP
          setIsQualyAllowed(false);
          setIsRaceAllowed(false);
        }
      }
    };

    updateCountdown(); // Initial call
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [currentGp, gpSchedule, fetchData]); // Added fetchData dependency cautiously

  useEffect(() => {
    setProgress((Object.values(predictions).filter(Boolean).length / 11) * 100);
  }, [predictions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowQualy((prev) => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeModal || activeSelectionModal || scoringModalOpen || activeStandingsModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto'; // Cleanup on unmount
    };
  }, [activeModal, activeSelectionModal, scoringModalOpen, activeStandingsModal]);


  // SECTION: Event Handlers
  const handleSelect = (position: keyof Prediction, value: string) => {
    const newErrors: string[] = [];
    const isQualy = position.startsWith('pole');
    const isGP = position.startsWith('gp');

    // Check for duplicates within the same category (Qualy or GP)
    if (isQualy) {
      const qualyPreds: (keyof Prediction)[] = ['pole1', 'pole2', 'pole3'];
      for (const p of qualyPreds) {
        if (p !== position && predictions[p] === value) {
          newErrors.push(`Ya has seleccionado a ${value} para otra posición de QUALY.`);
          break; // Only show one error for this duplicate
        }
      }
    } else if (isGP) {
        const racePreds: (keyof Prediction)[] = ['gp1', 'gp2', 'gp3'];
         for (const p of racePreds) {
            if (p !== position && predictions[p] === value) {
              newErrors.push(`Ya has seleccionado a ${value} para otra posición de RACE.`);
              break; // Only show one error for this duplicate
            }
         }
    }

     // Check if selecting a driver for a non-driver field or vice-versa (less critical, but good practice)
    const isTeamField = position.includes('team');
    const isDriverValue = staticDrivers.some(d => `${d.givenName} ${d.familyName}` === value);
    const isTeamValue = teams.some(t => t.name === value);

    if (isTeamField && !isTeamValue) {
        // Trying to select a driver for a team field? This shouldn't happen with current UI, but good validation.
        console.warn(`Attempted to select non-team value '${value}' for team field '${position}'`);
    } else if (!isTeamField && !isDriverValue) {
        // Trying to select a team for a driver field?
        console.warn(`Attempted to select non-driver value '${value}' for driver field '${position}'`);
    }


    if (newErrors.length > 0) {
      setErrors(newErrors);
      soundManager.click.play(); // Play sound even on error for feedback
      return;
    }

    setErrors([]); // Clear previous errors
    setPredictions((prev) => ({ ...prev, [position]: value }));
    setActiveSelectionModal(null);
    soundManager.click.play();
  };

  const handleClear = (position: keyof Prediction) => {
    setPredictions((prev) => ({ ...prev, [position]: '' }));
    // Do not close the selection modal here, let renderPredictionField handle the button visibility
    // setActiveSelectionModal(null);
    soundManager.click.play(); // Or a different sound?
  };

 // SECTION: handleSubmit
const handleSubmit = async () => {
    // 1. Check if signed in
    if (!isSignedIn) {
      console.log('Triggering sign-in modal because user is not signed in.');
      localStorage.setItem('pendingPredictions', JSON.stringify(predictions));
      if (triggerSignInModal) {
        console.log('Using triggerSignInModal function.');
        triggerSignInModal(); // Show modal passed via props
      } else {
        // Fallback to redirect if modal trigger is unavailable
        console.warn('triggerSignInModal not provided, falling back to redirect.');
        const redirectUrl = `/fantasy?modal=review`; // Try to reopen review modal after login
        router.push(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
      }
      return;
    }

    // 2. Check if there's an active GP
    if (!currentGp) {
      setErrors(['No hay un Gran Premio activo para hacer predicciones en este momento.']);
      setActiveModal('review'); // Stay on review modal to show error
      return;
    }

    // 3. Check if prediction deadlines have passed
    const now = new Date().getTime();
    const qualyDeadline = new Date(currentGp.qualy_time).getTime() - 5 * 60 * 1000;
    const raceDeadline = new Date(currentGp.race_time).getTime() - 5 * 60 * 1000;
    const canPredictQualy = now < qualyDeadline;
    const canPredictRace = now < raceDeadline;

    if (!canPredictQualy && !canPredictRace) {
      setErrors(['El período de predicciones (Qualy y Carrera) ha cerrado para este GP.']);
      setActiveModal('review');
      return;
    }

    // 4. Build the submission payload based on allowed predictions
    const submissionPayload: Partial<Prediction> = {};
    let hasMadePrediction = false;

    if (canPredictQualy) {
      if (predictions.pole1) { submissionPayload.pole1 = predictions.pole1; hasMadePrediction = true; }
      if (predictions.pole2) { submissionPayload.pole2 = predictions.pole2; hasMadePrediction = true; }
      if (predictions.pole3) { submissionPayload.pole3 = predictions.pole3; hasMadePrediction = true; }
    }

    if (canPredictRace) {
      if (predictions.gp1) { submissionPayload.gp1 = predictions.gp1; hasMadePrediction = true; }
      if (predictions.gp2) { submissionPayload.gp2 = predictions.gp2; hasMadePrediction = true; }
      if (predictions.gp3) { submissionPayload.gp3 = predictions.gp3; hasMadePrediction = true; }
      if (predictions.fastest_pit_stop_team) { submissionPayload.fastest_pit_stop_team = predictions.fastest_pit_stop_team; hasMadePrediction = true; }
      if (predictions.fastest_lap_driver) { submissionPayload.fastest_lap_driver = predictions.fastest_lap_driver; hasMadePrediction = true; }
      if (predictions.driver_of_the_day) { submissionPayload.driver_of_the_day = predictions.driver_of_the_day; hasMadePrediction = true; }
      if (predictions.first_team_to_pit) { submissionPayload.first_team_to_pit = predictions.first_team_to_pit; hasMadePrediction = true; }
      if (predictions.first_retirement) { submissionPayload.first_retirement = predictions.first_retirement; hasMadePrediction = true; }
    }

     // 5. Check if at least one valid prediction was made
     if (!hasMadePrediction) {
         let errorMessage = 'Por favor, completa al menos una predicción ';
         if (!canPredictQualy && canPredictRace) errorMessage += 'de Carrera ';
         else if (canPredictQualy && !canPredictRace) errorMessage += 'de Qualy ';
         errorMessage += 'antes de enviar.';
         setErrors([errorMessage]);
         setActiveModal('review');
         return;
     }

    setSubmitting(true);
    setErrors([]); // Clear previous errors before trying to submit

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación.');

      const supabase = createAuthClient(token);
      const userId = user!.id;
      const userName = user!.fullName || user!.username || 'Usuario Anónimo'; // Added fallback for username
      const userEmail = user!.primaryEmailAddress?.emailAddress || 'no-email@example.com'; // Use primary email

      // Ensure currentGp is not null before proceeding (already checked, but safer)
      if (!currentGp) throw new Error('Current GP is unexpectedly null.');

      // 6. Check for existing prediction for THIS GP and THIS USER in the CURRENT SEASON
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1).toISOString();
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59).toISOString();

      const { data: existingPrediction, error: fetchError } = await supabase
        .from('predictions')
        .select('id')
        .eq('user_id', userId)
        .eq('gp_name', currentGp.gp_name)
        .gte('submitted_at', startOfYear) // Check within the current year
        .lte('submitted_at', endOfYear)
        .maybeSingle();

      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        throw new Error(`Error al verificar predicción previa: ${fetchError.message}`);
      }
      if (existingPrediction) {
        setErrors([`Ya has enviado una predicción para el ${currentGp.gp_name} esta temporada (${currentYear}).`]);
        setActiveModal('review');
        setSubmitting(false); // Ensure submitting state is reset
        return;
      }

      // 7. Insert the new prediction
      const submissionTime = new Date();
      const week = Math.ceil(
        (submissionTime.getTime() - new Date(submissionTime.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
      );

      const { error: predError } = await supabase.from('predictions').insert({
        user_id: userId,
        gp_name: currentGp.gp_name,
        ...submissionPayload, // Only insert allowed predictions
        submitted_at: submissionTime.toISOString(),
        submission_week: week,
        submission_year: submissionTime.getFullYear(),
      });

      if (predError) {
         console.error("Supabase insert error:", predError);
         throw new Error(`Error al guardar la predicción: ${predError.message}`);
      }

      // 8. Send confirmation email (Optional but good UX)
      try {
          await fetch('/api/send-prediction-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail, userName, predictions: submissionPayload, gpName: currentGp.gp_name }),
          });
      } catch (emailErr) {
          console.error('Error sending confirmation email (non-critical):', emailErr);
          // Don't block submission flow for email error
      }


      // 9. Track Events (Meta Pixel + CAPI)
      const eventId = generateEventId();
      trackFBEvent('PrediccionEnviada', {
        params: { page: 'fantasy', gp_name: currentGp.gp_name },
        email: userEmail,
        event_id: eventId,
      });

      try {
        const capiResponse = await fetch('/api/fb-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_name: 'PrediccionEnviada',
            event_id: eventId,
            event_source_url: window.location.href,
            params: { page: 'fantasy', gp_name: currentGp.gp_name },
            email: userEmail,
          }),
        });
        if (!capiResponse.ok) {
          console.error('❌ Failed to send CAPI event:', await capiResponse.text());
        } else {
          console.log('✅ CAPI event PrediccionEnviada sent successfully.');
        }
      } catch (err) {
        console.error('❌ Error sending CAPI event:', err);
      }

      // 10. Update UI State on Success
      setSubmitted(true); // Mark as submitted for this session/GP
      setSubmittedPredictions(submissionPayload as Prediction); // Store what was actually submitted
      // Reset the form fields
      setPredictions({
        pole1: '', pole2: '', pole3: '',
        gp1: '', gp2: '', gp3: '',
        fastest_pit_stop_team: '', fastest_lap_driver: '', driver_of_the_day: '',
        first_team_to_pit: '', first_retirement: '',
      });
      setActiveModal('share'); // Show success/share modal
      soundManager.submit.play();
      localStorage.removeItem('pendingPredictions'); // Clear any pending state

    } catch (err) {
      console.error('Submission error:', err);
      // Ensure user sees the error on the review modal
      setErrors([err instanceof Error ? err.message : 'Ocurrió un error inesperado al enviar las predicciones. Por favor, intenta de nuevo.']);
      setActiveModal('review');
    } finally {
      setSubmitting(false); // Always reset submitting state
    }
};


  // SECTION: Modal Handlers
  const handleStickyButtonClick = () => {
    soundManager.menuClick.play(); // Or a different sound?
    // Logic: If user started, go to review. Otherwise, go to first available step.
    if (progress > 0 && progress < 100) {
        console.log("Sticky button clicked: Opening review modal (progress > 0).");
        openModal('review');
    } else if (isQualyAllowed) {
         console.log("Sticky button clicked: Opening pole modal.");
        openModal('pole');
    } else if (isRaceAllowed) {
        // If qualy is closed but race is open, start at GP step
        console.log("Sticky button clicked: Opening gp modal (qualy closed).");
        openModal('gp');
    } else {
        // This case shouldn't be reachable if button visibility logic is correct
        console.warn("Sticky button clicked but no prediction allowed.");
    }
  };

  const openModal = (modal: string) => {
    if (!submitted) { // Only allow opening if not submitted yet for the current GP
      soundManager.openMenu.play();
      setActiveModal(modal);
      setActiveSelectionModal(null); // Ensure selection modal is closed
      setErrors([]); // Clear errors when opening a modal step

      // Track attempt only if user is signed in (or track anonymously if desired)
       if (isSignedIn && user) {
           // 🎯 Meta Pixel + CAPI (Lead + IntentoPrediccion) - Trigger when interaction starts
           const eventId = generateEventId();
           const email = user.primaryEmailAddress?.emailAddress || '';

           // Track 'Lead' maybe only on first open? Or always? Depends on definition.
           // Let's assume 'Lead' tracks initial engagement with the prediction process.
           if (!Object.values(predictions).some(Boolean)) { // Track Lead if no predictions made yet
                 trackFBEvent('Lead', {
                   params: { page: 'fantasy', action: 'open_prediction_modal' },
                   email,
                   event_id: `lead_${eventId}`, // Distinguish event IDs if needed
                 });
            }


           trackFBEvent('IntentoPrediccion', {
             params: { page: 'fantasy', modal_opened: modal },
             email,
             event_id: `attempt_${eventId}`,
           });

            // Optionally send CAPI event here too, or bundle it with submission
            // Example: Send CAPI for IntentoPrediccion immediately
            /*
            fetch('/api/fb-track', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   event_name: 'IntentoPrediccion',
                   event_id: `attempt_${eventId}`,
                   event_source_url: window.location.href,
                   params: { page: 'fantasy', modal_opened: modal },
                   email,
                 }),
            }).catch(err => console.error('CAPI IntentoPrediccion error:', err));
            */
       }
    } else {
         // If already submitted, maybe show a message or prevent opening?
         // For now, just don't open the modal again. The main buttons are disabled anyway.
         console.log("Predictions already submitted for this GP.");
    }
  };

  const closeModal = () => {
        if (activeModal === 'share') {          // se ejecuta solo al cerrar el modal de éxito
          setActiveModal(null);                 // cierra el modal
          router.push('/f1-fantasy-panel');     // redirige al panel
        } else {
          setActiveModal(null);                 // cierra cualquier otro modal
        }
        setActiveSelectionModal(null);
        setErrors([]);
      };

  const modalOrder = ['pole', 'gp', 'extras', 'micro', 'review'];

  const nextModal = () => {
    const currentIndex = modalOrder.indexOf(activeModal!);
    if (currentIndex < modalOrder.length - 1) {
      setActiveModal(modalOrder[currentIndex + 1]);
      setErrors([]); // Clear errors when moving to next step
      soundManager.menuClick.play();
    }
  };

  const prevModal = () => {
    const currentIndex = modalOrder.indexOf(activeModal!);
    if (currentIndex > 0) {
      setActiveModal(modalOrder[currentIndex - 1]);
      setErrors([]); // Clear errors when moving to previous step
      soundManager.menuClick.play();
    }
  };

  const openSelectionModal = (position: keyof Prediction) => {
     // Determine if the field belongs to Qualy or Race
     const isQualy = isQualyField(position);
     const isAllowed = isQualy ? isQualyAllowed : isRaceAllowed;

     // Only open if not submitted AND predictions are allowed for this category
     if (!submitted && isAllowed) {
       setActiveSelectionModal({ position, isTeam: position.includes('team') });
       soundManager.menuClick.play();
     } else {
         // Optionally provide feedback if clicking on a disabled field
         console.log(`Selection disabled for ${position}. Submitted: ${submitted}, Allowed: ${isAllowed}`);
         if(submitted) {
            setErrors(["Ya enviaste tus predicciones para este GP."])
         } else if (!isAllowed) {
            setErrors([isQualy ? "Las predicciones de Qualy están cerradas." : "Las predicciones de Carrera están cerradas."])
         }
         // Show error inside the modal if it's already open
         if (!activeModal) setActiveModal(modalOrder.find(step => step === (isQualy ? 'pole' : isGPField(position) ? 'gp' : position.includes('fastest') || position.includes('day') ? 'extras' : 'micro')) || 'review');


     }
  };

  const closeSelectionModal = () => {
    setActiveSelectionModal(null);
    // Do not clear errors here, they might be relevant to the main modal
  };

  // SECTION: Utility Functions
  const getImageSrc = (position: keyof Prediction, value: string): string => {
    if (!value) return '/images/default-placeholder.png'; // Placeholder if no value

    if (position === 'fastest_pit_stop_team' || position === 'first_team_to_pit') {
      const team = teams.find((team) => team.name === value);
      return team?.logo_url || '/images/team-logos/default-team.png'; // Default team logo
    }
    // Assume it's a driver field otherwise
    const driver = drivers.find((driver) => `${driver.givenName} ${driver.familyName}` === value);
    return driver?.image || '/images/pilots/default-driver.png'; // Default driver image
  };

  // Get driver image by full name
  const getDriverImage = (driverName: string): string => {
     if (!driverName) return '/images/pilots/default-driver.png';
     const driver = drivers.find((driver) => `${driver.givenName} ${driver.familyName}` === driverName);
     return driver?.image || '/images/pilots/default-driver.png';
  };

  // Get team car image by team name
  const getTeamCarImage = (teamName: string): string => {
      if (!teamName) return '/images/cars/default-car.png';
      // Generate a slug from the team name (lowercase, replace spaces with hyphens)
      const slug = teamName.toLowerCase().replace(/\s+/g, '-');
      // Check if an image exists for that slug, otherwise use default
      // Note: This requires pre-naming car images 
      // consistently (e.g., red-bull-racing.png)
      // A direct lookup via team.car_image_url if available in DB would be more robust.
      // Basic check (won't work reliably server-side, better for client-side display):
      // For robustness, you might need a known list of available car images.
      // const knownCarImages = ['red-bull-racing', 'mclaren', ...];
      // if (knownCarImages.includes(slug)) { return `/images/cars/${slug}.png`; } else { return '/images/cars/default-car.png'; }
      return `/images/cars/${slug}.png`; // Assuming path structure works
  };


  const isQualyField = (position: keyof Prediction) => position.startsWith('pole');
  const isGPField = (position: keyof Prediction) => position.startsWith('gp');

  const formatCountdown = (countdown: { days: number; hours: number; minutes: number; seconds: number }) => {
    // Handle cases where countdown might be negative briefly before state update
    const d = Math.max(0, countdown.days);
    const h = Math.max(0, countdown.hours);
    const m = Math.max(0, countdown.minutes);
    const s = Math.max(0, countdown.seconds);
    return `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const isSectionComplete = (section: string): boolean => {
    switch (section) {
      case 'pole':
        return !!predictions.pole1 && !!predictions.pole2 && !!predictions.pole3;
      case 'gp':
        return !!predictions.gp1 && !!predictions.gp2 && !!predictions.gp3;
      case 'extras':
        return !!predictions.fastest_pit_stop_team && !!predictions.fastest_lap_driver && !!predictions.driver_of_the_day;
      case 'micro':
        return !!predictions.first_team_to_pit && !!predictions.first_retirement;
      default:
        return false;
    }
  };

  // SECTION: Render Functions
  const renderPredictionField = (position: keyof Prediction, label: string) => {
    const isQualy = isQualyField(position);
    const isAllowed = isQualy ? isQualyAllowed : isRaceAllowed;
    const closedCategoryText = isQualy ? 'QUALY CERRADA' : 'CARRERA CERRADA';
    const value = predictions[position];
    const isTeamField = position.includes('team');

    return (
      <div className="flex flex-col space-y-2 relative">
        <label className="text-gray-300 font-exo2 text-sm sm:text-base font-medium">{label}:</label>
        <div
          className={`relative p-3 rounded-lg border transition-all duration-300 flex items-center justify-between min-h-[60px] sm:min-h-[80px] ${
             isAllowed && !submitted
              ? `bg-gray-900/50 border-gray-500/30 ${value ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] cursor-pointer hover:border-gray-400'}`
              : 'bg-gray-800/40 border-gray-600/20 opacity-60 cursor-not-allowed' // Style for disabled/closed
          }`}
          onClick={() => openSelectionModal(position)} // Let openSelectionModal handle checks
          title={!isAllowed && !submitted ? closedCategoryText : submitted ? "Predicciones ya enviadas" : `Seleccionar ${label}`}
        >
          <span className={`flex items-center gap-3 ${value ? 'text-white' : 'text-gray-400'} font-exo2 truncate`}>
            {value ? (
               <Image
                 src={getImageSrc(position, value)}
                 alt={value}
                 width={64} // Slightly larger image
                 height={64}
                 className="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0" // Adjusted size
               />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-gray-700 rounded flex items-center justify-center">
                 <span className="text-xl text-gray-500">?</span>
              </div>
            )}
            {value || (isTeamField ? 'Seleccionar equipo...' : 'Seleccionar piloto...')}
          </span>

          {/* Clear button */}
           {value && isAllowed && !submitted && (
             <motion.button
               whileHover={{ scale: 1.2, rotate: 90 }}
               whileTap={{ scale: 0.9 }}
               onClick={(e) => {
                 e.stopPropagation(); // Prevent opening selection modal when clearing
                 handleClear(position);
               }}
               className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-amber-400 transition z-10 p-1"
               aria-label={`Limpiar selección para ${label}`}
             >
               ✕
             </motion.button>
           )}

            {/* Checkmark for selected field */}
            {value && <motion.span {...fadeInUp} transition={{ duration: 0.3 }} className="text-green-400 text-2xl absolute right-10 top-1/2 transform -translate-y-1/2 hidden sm:block">✓</motion.span> }


          {/* Overlay for closed sections */}
          {!isAllowed && !submitted && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg backdrop-blur-sm">
              <span className="text-red-400 font-exo2 text-xs sm:text-sm font-semibold uppercase tracking-wider">{closedCategoryText}</span>
            </div>
          )}
           {/* Overlay for submitted sections */}
           {submitted && (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg backdrop-blur-sm">
               <span className="text-green-400 font-exo2 text-xs sm:text-sm font-semibold uppercase tracking-wider">Enviado ✓</span>
             </div>
           )}
        </div>
      </div>
    );
  };


  const renderSelectionModal = () => {
    if (!activeSelectionModal) return null;
    const { position, isTeam } = activeSelectionModal;
    const items = isTeam ? teams : drivers;
    const title = isTeam ? 'Seleccionar Equipo' : 'Seleccionar Piloto';
    const currentSelection = predictions[position];

    // Pre-filter: remove drivers/teams already selected in the same category if applicable
    let filteredItems = [...items];
    const isQualy = position.startsWith('pole');
    const isGP = position.startsWith('gp');

    if (!isTeam) { // Only filter drivers for pole/gp duplicates
        if (isQualy) {
            const selectedQualy = [predictions.pole1, predictions.pole2, predictions.pole3].filter(Boolean);
            filteredItems = items.filter(item => !selectedQualy.includes(`${(item as Driver).givenName} ${(item as Driver).familyName}`) || `${(item as Driver).givenName} ${(item as Driver).familyName}` === currentSelection );
        } else if (isGP) {
            const selectedGP = [predictions.gp1, predictions.gp2, predictions.gp3].filter(Boolean);
            filteredItems = items.filter(item => !selectedGP.includes(`${(item as Driver).givenName} ${(item as Driver).familyName}`) || `${(item as Driver).givenName} ${(item as Driver).familyName}` === currentSelection );
        }
    }


    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[70] p-4" // Increased blur
        onClick={closeSelectionModal} // Close on overlay click
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ type: 'spring', damping: 20, stiffness: 300 }} // Spring animation
          className="bg-gradient-to-br from-gray-950 to-gray-800 p-4 sm:p-6 rounded-2xl border border-amber-500/40 shadow-2xl w-full max-w-[95vw] sm:max-w-3xl max-h-[85vh] flex flex-col" // Slightly larger max-width, more rounded
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 font-exo2 text-center">{title} <span className='text-amber-400'>para {position.replace(/_/g, ' ').replace(/\d/g, '').trim().toUpperCase()}</span></h2>

          <div className="flex-grow overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-gray-800">
             <motion.div
               // Removed initial/animate/exit here, let individual items animate
               transition={{ staggerChildren: 0.05 }} // Stagger item animation
               // UPDATED GRID: Max 4 cols on large screens
               className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
             >
               {filteredItems.map((item, index) => {
                 const key = isTeam ? (item as Team).name : (item as Driver).driverId;
                 const displayName = isTeam ? (item as Team).name : `${(item as Driver).givenName} ${(item as Driver).familyName}`;
                 const imageSrc = isTeam ? (item as Team).logo_url : (item as Driver).image;
                 const isSelected = displayName === currentSelection;

                 return (
                   <motion.button
                     key={key}
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     transition={{ duration: 0.2, delay: index * 0.02 }}
                     whileHover={{ scale: 1.05, y: -2, boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.3)" }}
                     whileTap={{ scale: 0.98 }}
                     onClick={() => handleSelect(position, displayName)}
                     className={`p-2 sm:p-3 rounded-lg text-white font-exo2 flex flex-col items-center gap-1 sm:gap-2 transition-all duration-200 relative overflow-hidden border ${
                         isSelected
                           ? 'bg-amber-600/30 border-amber-500 shadow-lg'
                           : 'bg-gray-800/60 border-gray-700 hover:bg-amber-500/20 hover:border-amber-500/50'
                     }`}
                   >
                     <Image
                        src={imageSrc || (isTeam ? '/images/team-logos/default-team.png' : '/images/pilots/default-driver.png')}
                        alt={displayName}
                        width={80} // Larger image
                        height={80}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-1"
                      />
                     <span className="text-xs sm:text-sm text-center leading-tight w-full truncate">{displayName}</span>
                     {!isTeam && <span className="text-gray-400 text-[10px] sm:text-xs">#{(item as Driver).permanentNumber}</span>}
                      {isSelected && <div className="absolute top-1 right-1 w-3 h-3 bg-green-400 rounded-full shadow-md"></div>}
                   </motion.button>
                 );
               })}
               {filteredItems.length === 0 && (
                  <p className="col-span-full text-center text-gray-400 py-10 font-exo2">Todos los pilotos de esta categoría ya han sido seleccionados.</p>
               )}
             </motion.div>
          </div>

          <button
            onClick={closeSelectionModal}
            className="mt-4 w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg font-exo2 hover:bg-gray-600 hover:text-amber-300 transition-all duration-200 text-sm sm:text-base font-semibold"
          >
            Cerrar Selección
          </button>
        </motion.div>
      </motion.div>
    );
  };


  // SECTION: Restore Predictions After Login
  useEffect(() => {
    if (isSignedIn && isLoaded && hydrated) { // Ensure Clerk is fully loaded and component hydrated
      const savedPredictions = localStorage.getItem('pendingPredictions');
      if (savedPredictions) {
        console.log("Found pending predictions in localStorage.");
        try {
          const restoredPredictions: Prediction = JSON.parse(savedPredictions);
          // Validate restored data structure? (Optional)
          if (typeof restoredPredictions === 'object' && restoredPredictions !== null) {
             setPredictions(restoredPredictions);
             // Check if redirect specified opening the modal
             const urlParams = new URLSearchParams(window.location.search);
             if (urlParams.get('modal') === 'review') {
                setActiveModal('review'); // Open review modal directly
                console.log("Restored predictions and opening review modal.");
             } else {
                 // Optionally open the first modal or review modal as default
                 setActiveModal('review');
                 console.log("Restored predictions, opening default review modal.");
             }

          } else {
             console.error('Invalid data found in pendingPredictions.');
          }
        } catch (error) {
          console.error('Error parsing or restoring predictions:', error);
        } finally {
           localStorage.removeItem('pendingPredictions'); // Clear after attempt
        }
      }
    }
  }, [isSignedIn, isLoaded, hydrated]); // Depend on Clerk state and hydration


  // SECTION: JSX Return Statement
  if (!hydrated || !isLoaded) {
    return <LoadingAnimation text="Cargando autenticación..." animationDuration={4} />;
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white overflow-x-hidden relative"> {/* Prevent horizontal scroll */}
      <Header />
      {!isDataLoaded ? (
        <LoadingAnimation animationDuration={loadingDuration} />
      ) : (
        <main
          key={`main-${forceRender}`} // Re-render key
          className="container mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-16" 
        >
          {/* Row 1: Key Highlights */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
   
{/* ─── Barra de Puntaje + Botón & Info de Ranking (F1 World-Class UI) ─── */}
<div className="col-span-1 md:col-span-3">

  {/* === Barra principal === */}
  <div className="bg-gradient-to-br from-neutral-800 via-neutral-900 to-black rounded-xl shadow-2xl
                 border border-neutral-700/60 hover:border-sky-500/70 transition-all duration-300
                 overflow-hidden group relative">

    {/* brillo animado opcional */}
    <div className="absolute -inset-px rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300
                    bg-gradient-to-r from-sky-700 via-sky-500 to-sky-700 blur-lg
                    animate-pulse-slow-läufig"
         style={{ animationDuration: '4s' }} />

    {/* bisel interno */}
    <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 pointer-events-none z-10" />

    {/* contenido */}
    {/* MODIFICADO: Layout responsive para el contenido principal de la barra */}
    <div className="relative z-20 px-4 py-4 sm:px-7 sm:py-5 
                   flex flex-col items-stretch gap-y-4 
                   sm:flex-row sm:items-center sm:justify-between sm:gap-x-6">

      {/* —— Totales —— */}
      {/* MODIFICADO: Layout responsive para el bloque de "Totales" */}
      <div className="grid grid-cols-2 gap-x-4 w-full sm:flex sm:gap-x-8 sm:w-auto">

        {/* Acumulado de temporada */}
        <div className="flex flex-col items-center text-center"> {/* Añadido text-center para mejor manejo de texto */}
          <p className="text-xs text-gray-400 uppercase tracking-wide font-exo2">Temporada</p>

          <div className="flex items-baseline gap-x-1 mt-0.5"> {/* Añadido mt-0.5 */}
            <span className="text-2xl font-bold text-amber-400 font-exo2">{totalScore ?? '0'}</span>
            <span className="text-xs text-gray-300 font-exo2">pts</span>
          </div>

          {totalRank != null && (
            <p className="text-xs text-gray-500 mt-1 font-exo2">#{totalRank} global</p>
          )}
        </div>

        {/* Puntaje del GP anterior */}
        <div className="flex flex-col items-center text-center"> {/* Añadido text-center */}
          <p className="text-xs text-gray-400 uppercase tracking-wide font-exo2">Último GP</p>

          <div className="flex items-baseline gap-x-1 mt-0.5"> {/* Añadido mt-0.5 */}
            <span className="text-xl font-bold text-emerald-300 font-exo2">
              {gpScore ?? '-'}
            </span>
            <span className="text-xs text-gray-300 font-exo2">pts</span>
          </div>

          {prevGpRank != null && previousResults?.gp_name && (
            // MODIFICADO: min-w-0 para ayudar con el word-break en flex/grid children si es necesario
            <p className="text-xs text-gray-500 mt-1 font-exo2 min-w-0"> 
              P{prevGpRank}&nbsp;en&nbsp;
              <span className="font-medium text-neutral-200 break-words">{previousResults.gp_name}</span> {/* break-words para mejor manejo de nombres largos */}
            </p>
          )}
        </div>
      </div>

      {/* —— Botón Panel —— */}
      {/* El botón se apilará automáticamente en móviles debido a flex-col en el padre.
         En pantallas sm y mayores, volverá a estar al lado. */}
      <Link href="/f1-fantasy-panel" passHref>
        <button
          className="bg-gradient-to-r from-sky-600 to-sky-500 text-white font-exo2 font-bold text-sm {/* MOD: text-sm base, sm:text-sm se mantiene */}
                     w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-md shadow-lg hover:from-sky-500 hover:to-sky-400 
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400
                     active:scale-95 transition-all duration-150 ease-in-out
                     flex items-center justify-center sm:justify-start gap-x-2 border border-sky-700 hover:border-sky-500"> {/* MOD: justify-center en mobile */}

          <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-0.5 group-hover:scale-110
                         transition-transform duration-150 text-sky-200"
               xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd"
                  d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm10.293 9.293a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 13.414V17a1 1 0 11-2 0v-3.586l-1.293 1.293a1 1 0 01-1.414-1.414l3-3z"
                  clipRule="evenodd" />
          </svg>
          Panel
        </button>
      </Link>
    </div>
  </div>

  {/* ——— Mensaje resumen ——— */}
  {(totalRank != null || prevGpRank != null) && (
    // MODIFICADO: Padding ajustado para móvil
    <div className="px-4 pt-3 pb-3 sm:px-5 sm:pt-2.5 sm:pb-1">
      <p className="text-xs sm:text-sm text-neutral-400 font-exo2 tracking-wide leading-relaxed text-center sm:text-left"> {/* MOD: text-center en mobile */}
        {totalRank != null && (
          <>Actualmente ocupas la posición&nbsp;
            <span className="font-semibold text-sky-300">{totalRank}</span>&nbsp;global</>
        )}
        {prevGpRank != null && previousResults?.gp_name && (
          <>
            {totalRank != null ? ', y fuiste' : 'Fuiste'}&nbsp; {/* Lógica de texto ajustada */}
            <span className="font-semibold text-sky-300">{prevGpRank}</span>&nbsp;
            en el&nbsp;
            <span className="font-medium text-neutral-200">{previousResults.gp_name}</span>
          </>
        )}
        .
      </p>
    </div>
  )}
</div>
           {/* Countdown - PROPOSAL 2 */}
            {/* Outer animated border div REMOVED */}
            <div className="relative group bg-gradient-to-b from-blue-800 to-sky-600 p-4 rounded-xl shadow-lg z-10 min-h-40 flex flex-col justify-between overflow-hidden shadow-blue-500/20">
                {/* Background Flag - More subtle */}
                {currentGp && gpFlags[currentGp.gp_name] && (
                  <img // Using standard img tag, motion not strictly needed if animation is simple
                    src={gpFlags[currentGp.gp_name]}
                    alt="" // Decorative, alt text handled by main content
                    aria-hidden="true"
                    // VERY SUBTLE OPACITY, no extra effects on hover
                    className="absolute inset-0 w-full h-full opacity-[0.07] transition-opacity duration-300 object-cover z-0"
                  />
                )}
                {/* Inner Shadow & Subtle Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-5 pointer-events-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] rounded-xl" />

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full">
                  {/* Top Section: GP Name */}
                  <div className="flex items-center gap-2 mb-2">
                      {/* Calendar Icon */}
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white/80 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                     </svg>
                     <h2 className="text-sm sm:text-base font-semibold text-white font-exo2 leading-tight drop-shadow-lg truncate">
                        {currentGp ? currentGp.gp_name : 'Temporada Finalizada'}
                     </h2>
                  </div>

                  {/* Middle Section: Countdown */}
                   <div className="flex flex-col items-center justify-center flex-grow my-1 sm:my-2">
                     {currentGp ? (
                        <>
                            {/* Qualy/Race Label */}
                            <p className="text-[10px] sm:text-xs font-exo2 text-white/70 drop-shadow-md uppercase tracking-wider mb-1">
                                {showQualy ? 'Tiempo para Qualy' : 'Tiempo para Carrera'}
                            </p>
                            {/* Unified Countdown - Bold Mono Numbers */}
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={showQualy ? 'qualy' : 'race'} // Key change triggers animation
                                    className="font-mono text-xl sm:text-2xl lg:text-3xl text-white font-bold tracking-tight drop-shadow-lg" // MONO FONT, LARGE, BOLD
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.3, ease: 'circOut' }}
                                >
                                    {/* Use original formatCountdown, maybe style labels slightly lighter? */}
                                    {/* We style the whole block here, relying on font choice for clarity */}
                                    {formatCountdown(showQualy ? qualyCountdown : raceCountdown)}
                                </motion.p>
                            </AnimatePresence>
                        </>
                     ) : (
                       // Message when no current GP
                       <div className="flex flex-col items-center justify-center flex-grow">
                          <p className="font-semibold text-lg sm:text-xl text-gray-300 drop-shadow-md font-exo2">¡Nos vemos pronto!</p>
                       </div>
                     )}
                   </div>

                  {/* Bottom Section: Date */}
                  <div className="mt-auto flex items-center gap-1 justify-end pt-1">
                     {/* Clock Icon */}
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/70" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
                     </svg>
                     <p className="text-white/80 text-[10px] sm:text-[11px] font-exo2 leading-tight drop-shadow-md">
                        {currentGp
                        ? `Carrera: ${new Date(currentGp.race_time).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })}`
                        : 'Consulta Resultados'}
                     </p>
                  </div>
                </div>
            </div>
            {/* Column 2 - Last Race Winner */}
            <div
              className="animate-rotate-border rounded-xl p-px"
               style={{
                 //@ts-ignore
                 '--border-angle': '90deg', // Different start angle
                 background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #d4af37 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`,
                 animation: `rotate-border 3s linear infinite reverse`, // Faster, reversed
               }}
            >
              <motion.div
                className={`relative p-3 sm:p-4 pb-0 rounded-xl shadow-lg z-10 bg-gradient-to-br h-40 overflow-hidden ${
                  previousResults?.gp1 && driverToTeam[previousResults.gp1] && teamColors[driverToTeam[previousResults.gp1]]
                    ? `${teamColors[driverToTeam[previousResults.gp1]].gradientFrom} ${teamColors[driverToTeam[previousResults.gp1]].gradientTo}`
                    : 'from-gray-700 to-gray-600'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-bl from-black/70 via-black/40 to-transparent z-0 pointer-events-none" /> {/* Adjusted gradient */}
                <div className="relative z-10 pr-[35%] sm:pr-[40%] flex flex-col justify-center h-full space-y-1">
                  {previousResults?.gp1 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-lg sm:text-xl drop-shadow-md">🏆</span>
                        <p className="text-base sm:text-lg font-semibold text-white font-exo2 leading-tight drop-shadow-md">
                           Ganador: {previousResults.gp1.split(' ')[1]} {/* Show only last name */}
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-200 font-exo2 leading-tight drop-shadow-md"> {/* Lighter text */}
                         {previousResults.gp_name}
                      </p>
                       <p className="text-[10px] sm:text-xs text-gray-300 font-exo2 leading-tight drop-shadow-md"> {/* Lighter text */}
                          {driverToTeam[previousResults.gp1] || 'Equipo Desconocido'}
                       </p>
                    </>
                  ) : (
                     <div className="flex items-center gap-2">
                         <span className="text-gray-400 text-lg sm:text-xl">🏁</span>
                         <p className="text-gray-300 font-exo2 text-xs sm:text-sm">
                           Esperando resultados previos...
                         </p>
                     </div>
                  )}
                </div>
                {previousResults?.gp1 && (
              // --- OPTIMIZATION: Attempt 3 ---
              // Container is full height again. Make it WIDER to allow object-contain to scale taller.
              // Adjust 'right' positioning and potentially add negative margin if needed to manage layout.
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                // Wider percentage, larger max-width, h-full is back. Adjusted 'right' slightly.
                className="absolute bottom-0 right-[-5px] w-[70%] sm:w-[75%] max-w-[200px] h-full"
                // --- END OPTIMIZATION ---
              >
                <Image
                  src={getDriverImage(previousResults.gp1)}
                  alt={previousResults.gp1}
                  // --- OPTIMIZATION ---
                  fill // Use fill again
                  // Update sizes based on new container width
                  sizes="(max-width: 640px) 70vw, (max-width: 840px) 75vw, 200px"
                  // Back to object-contain to prevent cropping
                  className="object-contain object-bottom drop-shadow-xl"
                  // --- END OPTIMIZATION ---
                />
              </motion.div>

                )}
              </motion.div>
            </div>
            {/* Column 3 - Fastest Pit Stop - OPTIMIZED Edge-to-Edge Image */}
            <div
              className="animate-rotate-border rounded-xl p-px"
              style={{
                //@ts-ignore
                '--border-angle': '180deg',
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #0d9488 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)`,
                animation: `rotate-border 5s linear infinite`,
              }}
            >
              {/* Card Container: REMOVED padding (p-*, pb-0), ADDED overflow-hidden */}
              <motion.div
                className={`rounded-xl shadow-lg relative z-10 flex flex-col items-center bg-gradient-to-br h-40 overflow-hidden ${
                  previousResults?.fastest_pit_stop_team && teamColors[previousResults.fastest_pit_stop_team]
                    ? `${teamColors[previousResults.fastest_pit_stop_team].gradientFrom} ${teamColors[previousResults.fastest_pit_stop_team].gradientTo}`
                    : 'from-gray-700 to-gray-600'
                }`}
              >
                 {/* Overlay - covers everything including padding area now */}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none rounded-xl" />
                {/* Text content container: ADDED padding (px-*, pt-*), sits above image */}
                <div className="relative z-20 w-full text-center flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-1">
                  <h2 className="text-base sm:text-lg font-bold text-white font-exo2 drop-shadow-md flex items-center justify-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-300" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
                      </svg>
                      Pit Stop Más Rápido
                  </h2>
                  {previousResults?.fastest_pit_stop_team ? (
                    <p className="text-[10px] sm:text-xs text-white/90 font-exo2 drop-shadow-md truncate">
                      {previousResults.fastest_pit_stop_team} - {previousResults.gp_name}
                    </p>
                  ) : (
                    <p className="text-gray-300 font-exo2 text-xs sm:text-sm mt-2">
                      Esperando resultados...
                    </p>
                  )}
                </div>
                {/* Image container: Takes remaining space, positioned below text implicitly */}
                {previousResults?.fastest_pit_stop_team && (
                   <motion.div
                       initial={{ y: 30, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       transition={{ duration: 0.5, delay: 0.3 }}
                       // Use absolute positioning to place it correctly behind overlay/text but filling card area
                       className="absolute inset-0 w-full h-full z-0" // Positioned behind text (z-0), covers card area
                   >
                    <Image
                       src={getTeamCarImage(previousResults.fastest_pit_stop_team)}
                       alt={`${previousResults.fastest_pit_stop_team} car`}
                       fill // Use fill to cover the container
                       // --- OPTIMIZATION ---
                       // object-cover fills container, object-center aligns
                       className="object-cover object-center" // Removed drop-shadow as it might look odd at edges
                       // --- END OPTIMIZATION ---
                       // Removed width/height/sizes as 'fill' handles it
                     />
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Row 2: Predictions & Standings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Predictions Card */}
            <div
              className="md:col-span-1 animate-rotate-border rounded-xl p-px" // Span 1 column on medium+
              style={{
                 //@ts-ignore
                 '--border-angle': '270deg', // Different start angle
                 background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)`,
                 animation: `rotate-border 6s linear infinite reverse`, // Slowest, reversed
              }}
            >
              <motion.div
                 className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-full flex flex-col justify-between" // Use full height
              >
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-3 font-exo2 text-center">
                    🏁 Haz tus Predicciones 🏁
                  </h2>
                   <p className="text-center text-xs text-gray-400 mb-3 font-exo2">
                      {currentGp ? `Para el ${currentGp.gp_name}` : "La temporada ha terminado"}
                   </p>
                  <div className="w-full bg-gray-800 rounded-full h-2.5 mb-2 relative overflow-hidden border border-gray-700"> {/* Slightly thicker bar */}
                    <motion.div
                      className="bg-gradient-to-r from-amber-500 to-cyan-500 h-full rounded-full shadow-[0_0_8px_rgba(34,211,238,0.7)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-gray-300 text-center mb-4 font-exo2 text-sm font-medium">
                    {Math.round(progress)}% completado
                  </p>
                </div>
                 {/* Buttons Section */}
                 <div className="grid grid-cols-1 gap-3 mt-auto"> {/* mt-auto pushes buttons down */}
                     {steps.slice(0, -1).map((step, index) => { // Exclude 'review' step
                         const colors = [
                             { border: 'border-amber-400/60', text: 'text-amber-400', shadow: 'hover:shadow-[0_0_12px_rgba(251,191,36,0.6)]', bg: 'hover:bg-amber-500/10' }, // pole
                             { border: 'border-cyan-400/60', text: 'text-cyan-400', shadow: 'hover:shadow-[0_0_12px_rgba(34,211,238,0.6)]', bg: 'hover:bg-cyan-500/10' },   // gp
                             { border: 'border-purple-400/60', text: 'text-purple-400', shadow: 'hover:shadow-[0_0_12px_rgba(168,85,247,0.6)]', bg: 'hover:bg-purple-500/10' }, // extras
                             { border: 'border-yellow-400/60', text: 'text-yellow-400', shadow: 'hover:shadow-[0_0_12px_rgba(250,204,21,0.6)]', bg: 'hover:bg-yellow-500/10' }, // micro
                         ];
                         const color = colors[index % colors.length];
                         const isComplete = isSectionComplete(step.name);
                         const isStepAllowed = step.name.startsWith('pole') ? isQualyAllowed : isRaceAllowed;

                         return (
                              <motion.button
                                key={step.name}
                                whileHover={{ scale: 1.03, y: -1 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => openModal(step.name)}
                                className={`w-full py-3 px-4 rounded-lg bg-gray-900/80 border ${color.border} ${color.text} ${color.bg} ${color.shadow} font-exo2 text-sm sm:text-base font-semibold transition-all duration-200 flex justify-between items-center ${
                                  (submitted || !isStepAllowed) ? 'opacity-50 cursor-not-allowed grayscale-[50%]' : '' // Grayscale if disabled
                                }`}
                                disabled={submitted || !isStepAllowed}
                                title={(submitted || !isStepAllowed) ? (submitted ? "Predicciones ya enviadas" : (step.name.startsWith('pole') ? "Qualy cerrada" : "Carrera cerrada")) : `Ir a ${step.label}`}
                              >
                                <span>{step.label}</span>
                                {isComplete && !submitted && isStepAllowed && <span className="text-green-400">✓</span>}
                                {!isStepAllowed && !submitted && <span className="text-red-500 text-xs">Cerrado</span>}
                              </motion.button>
                         )
                     })}
                     {/* Review Button */}
                     <motion.button
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => openModal('review')}
                         className={`w-full py-3 px-4 rounded-lg bg-gradient-to-r from-amber-600 to-cyan-600 border border-gray-500 text-white font-exo2 text-sm sm:text-base font-semibold transition-all duration-200 hover:from-amber-500 hover:to-cyan-500 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] ${
                             submitted ? 'opacity-50 cursor-not-allowed grayscale-[50%]' : ''
                         }`}
                        disabled={submitted}
                      >
                        Revisar y Enviar {progress === 100 && !submitted ? '🚀' : ''}
                      </motion.button>
                    {/* Scoring System Button */}
                    <motion.button
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setScoringModalOpen(true)}
                        className="w-full py-2.5 px-4 rounded-lg bg-gray-800/70 border border-teal-400/50 text-teal-400 font-exo2 text-xs sm:text-sm font-semibold transition-all duration-200 hover:bg-teal-900/40 hover:text-teal-300 hover:border-teal-300 hover:shadow-[0_0_10px_rgba(20,184,166,0.5)]"
                     >
                        Sistema de Puntuación
                    </motion.button>
                </div>
              </motion.div>
            </div>

            {/* Driver Standings Card - REMOVED FIXED HEIGHT & INTERNAL SCROLL */}
            <div
              className="md:col-span-1 animate-rotate-border rounded-xl p-px"
              style={{
                 //@ts-ignore
                 '--border-angle': '0deg',
                 background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e3a8a 20deg, #38bdf8 30deg, #1e3a8a 40deg, transparent 50deg, transparent 360deg)`,
                 animation: `rotate-border 5s linear infinite`,
              }}
            >
              <motion.div
                 className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-full flex flex-col" // Use h-full and flex-col
              >
                 <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                  Clasificación Pilotos 2025
                </h2>
                {/* REMOVED internal scroll container */}
                <div className="flex-grow space-y-2 mb-4"> {/* List items directly here */}
                     {driverStandings.length > 0 ? (
                       driverStandings.slice(0, 8).map((standing, index) => { // Show top 8 initially
                         const teamName = driverToTeam[standing.driver];
                         const team = teams.find((t) => t.name === teamName);
                         return (
                           <motion.div
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ duration: 0.4, delay: index * 0.05 }}
                             key={standing.position}
                             className="bg-gray-800/70 p-2 rounded-lg flex items-center justify-between hover:bg-blue-800/50 transition-all duration-200 shadow-sm"
                           >
                             <div className="flex items-center gap-2 flex-1 min-w-0">
                               <span className="text-amber-400 font-bold text-sm w-6 text-center flex-shrink-0">{standing.position}</span>
                               <Image
                                 src={team?.logo_url || '/images/team-logos/default-team.png'}
                                 alt={`${teamName || 'Equipo'} logo`}
                                 width={24}
                                 height={24}
                                 className="object-contain w-6 h-6 flex-shrink-0"
                               />
                               <span className="text-white text-xs sm:text-sm truncate">{standing.driver}</span>
                             </div>
                             <div className="flex items-center gap-2 flex-shrink-0">
                               <span className="text-gray-300 text-xs sm:text-sm font-medium w-12 text-right">{standing.points} pts</span>
                               <span
                                 className={`text-xs sm:text-sm w-8 text-center font-semibold ${
                                   standing.evolution.startsWith('↑') ? 'text-green-400' :
                                   standing.evolution.startsWith('↓') ? 'text-red-400' : 'text-gray-400'
                                 }`}
                               >
                                 {standing.evolution === '=' ? '–' : standing.evolution}
                               </span>
                             </div>
                           </motion.div>
                         );
                       })
                     ) : (
                       <p className="text-gray-400 font-exo2 text-sm text-center py-10">Cargando clasificación...</p>
                     )}
                 </div>
                 {/* REMOVED fade effect div */}
                 <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveStandingsModal('drivers')}
                    className="w-full mt-auto py-2 px-4 bg-gray-800/80 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/40 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_2px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base font-semibold"
                    aria-label="Ver clasificación completa de pilotos"
                  >
                   Ver Clasificación Completa
                 </motion.button>
              </motion.div>
            </div>

            {/* Constructor Standings Card - REMOVED FIXED HEIGHT & INTERNAL SCROLL */}
             <div
               className="md:col-span-1 animate-rotate-border rounded-xl p-px"
               style={{
                 //@ts-ignore
                 '--border-angle': '90deg',
                 background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #15803d 20deg, #86efac 30deg, #15803d 40deg, transparent 50deg, transparent 360deg)`,
                 animation: `rotate-border 4.5s linear infinite reverse`,
               }}
             >
               <motion.div
                 className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-full flex flex-col" // Use h-full and flex-col
               >
                 <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                   Clasificación Constructores 2025
                 </h2>
                  {/* REMOVED internal scroll container */}
                  <div className="flex-grow space-y-2 mb-4"> {/* List items directly here */}
                      {constructorStandings.length > 0 ? (
                        constructorStandings.slice(0, 8).map((standing, index) => { // Show top 7 initially
                          const team = teams.find((t) => t.name === standing.constructor);
                          return (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.4, delay: index * 0.05 }}
                              key={standing.position}
                              className="bg-gray-800/70 p-2 rounded-lg flex items-center justify-between hover:bg-green-800/40 transition-all duration-200 shadow-sm" // Greenish hover
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-amber-400 font-bold text-sm w-6 text-center flex-shrink-0">{standing.position}</span>
                                <Image
                                  src={team?.logo_url || '/images/team-logos/default-team.png'}
                                  alt={`${standing.constructor} logo`}
                                  width={24}
                                  height={24}
                                  className="object-contain w-6 h-6 flex-shrink-0"
                                />
                                <span className="text-white text-xs sm:text-sm truncate">{standing.constructor}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-gray-300 text-xs sm:text-sm font-medium w-12 text-right">{standing.points} pts</span>
                                <span
                                  className={`text-xs sm:text-sm w-8 text-center font-semibold ${
                                    standing.evolution.startsWith('↑') ? 'text-green-400' :
                                    standing.evolution.startsWith('↓') ? 'text-red-400' : 'text-gray-400'
                                  }`}
                                >
                                  {standing.evolution === '=' ? '–' : standing.evolution}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })
                      ) : (
                        <p className="text-gray-400 font-exo2 text-sm text-center py-10">Cargando clasificación...</p>
                      )}
                    </div>
                 {/* REMOVED fade effect div */}
                 <motion.button
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   onClick={() => setActiveStandingsModal('constructors')}
                   className="w-full mt-auto py-2 px-4 bg-gray-800/80 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/40 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_2px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base font-semibold"
                   aria-label="Ver clasificación completa de constructores"
                 >
                   Ver Clasificación Completa
                 </motion.button>
               </motion.div>
             </div>
          </div>

          {/* Row 3: Destructors, Rookies, Leaderboard */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Destructors 2025 */}
             <div
               className="animate-rotate-border rounded-xl p-px"
               style={{
                 //@ts-ignore
                 '--border-angle': '180deg',
                 background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #ea580c 20deg, #facc15 30deg, #ea580c 40deg, transparent 50deg, transparent 360deg)`,
                 animation: `rotate-border 3.5s linear infinite`,
               }}
             >
               <motion.div
                 className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-full flex flex-col"
               >
                 <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center flex items-center justify-center gap-2">
                   <span className='text-orange-400'>💥</span> Destructores 2025 <span className='text-orange-400'>💥</span>
                 </h2>
                 <div className="flex-grow space-y-2 overflow-y-auto max-h-60 scrollbar-thin scrollbar-thumb-orange-600 scrollbar-track-gray-800 pr-2">
                   {destructorStandings.length > 0 ? (
                     destructorStandings.slice(0, 5).map((standing, index) => ( // Show top 5
                       <motion.div
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ duration: 0.4, delay: index * 0.05 }}
                         key={standing.position}
                         className="bg-gray-800/70 p-2 rounded-lg flex items-center justify-between hover:bg-orange-800/40 transition-all duration-200 shadow-sm"
                       >
                         <div className="flex items-center gap-2 flex-1 min-w-0">
                           <span className="text-amber-400 font-bold text-sm w-6 text-center flex-shrink-0">{standing.position}</span>
                           <span className="text-white text-xs sm:text-sm truncate">{standing.driver}</span>
                            <span className="text-gray-400 text-[10px] truncate hidden sm:inline">({standing.team})</span>
                         </div>
                         <span className="text-orange-300 text-xs sm:text-sm font-medium flex-shrink-0">
                           {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(standing.total_costs)}
                         </span>
                       </motion.div>
                     ))
                   ) : (
                     <p className="text-gray-400 font-exo2 text-sm text-center py-10">Cargando costos...</p>
                   )}
                 </div>
                 {/* Optional: Add a button to see full list if needed */}
               </motion.div>
             </div>
             {/* Rookies 2025 */}
             <div
               className="animate-rotate-border rounded-xl p-px"
                style={{
                 //@ts-ignore
                 '--border-angle': '270deg',
                 background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #db2777 20deg, #f9a8d4 30deg, #db2777 40deg, transparent 50deg, transparent 360deg)`,
                 animation: `rotate-border 6s linear infinite`,
               }}
             >
               <motion.div
                 className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-full flex flex-col"
               >
                 <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center flex items-center justify-center gap-2">
                  <span className='text-pink-400'>⭐</span> Rookies 2025 <span className='text-pink-400'>⭐</span>
                 </h2>
                  <div className="flex-grow space-y-2 overflow-y-auto max-h-60 scrollbar-thin scrollbar-thumb-pink-600 scrollbar-track-gray-800 pr-2">
                   {rookieStandings.length > 0 ? (
                     rookieStandings.slice(0, 5).map((standing, index) => { // Show all rookies found
                          const teamName = driverToTeam[standing.driver];
                          const team = teams.find((t) => t.name === teamName);
                          return (
                           <motion.div
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ duration: 0.4, delay: index * 0.05 }}
                             key={standing.position}
                             className="bg-gray-800/70 p-2 rounded-lg flex items-center justify-between hover:bg-pink-800/40 transition-all duration-200 shadow-sm"
                           >
                             <div className="flex items-center gap-2 flex-1 min-w-0">
                               <span className="text-amber-400 font-bold text-sm w-6 text-center flex-shrink-0">{standing.position}</span>
                                {team && <Image
                                  src={team.logo_url}
                                  alt={`${teamName || 'Equipo'} logo`}
                                  width={20}
                                  height={20}
                                  className="object-contain w-5 h-5 flex-shrink-0"
                                />}
                               <span className="text-white text-xs sm:text-sm truncate">{standing.driver}</span>
                             </div>
                             <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-pink-300 text-xs sm:text-sm font-medium w-12 text-right">{standing.points} pts</span>
                                <span
                                  className={`text-xs sm:text-sm w-8 text-center font-semibold ${
                                    standing.evolution.startsWith('↑') ? 'text-green-400' :
                                    standing.evolution.startsWith('↓') ? 'text-red-400' : 'text-gray-400'
                                  }`}
                                >
                                  {standing.evolution === '=' ? '–' : standing.evolution}
                                </span>
                              </div>
                           </motion.div>
                         );
                     })
                   ) : (
                     <p className="text-gray-400 font-exo2 text-sm text-center py-10">Cargando rookies...</p>
                   )}
                 </div>
                  {/* Optional: Add a button to see full list if needed */}
               </motion.div>
             </div>
             {/* MotorManía Leaderboard */}
             <div
               className="animate-rotate-border rounded-xl p-px"
                style={{
                  //@ts-ignore
                 '--border-angle': '0deg',
                 background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #d4af37 20deg, #d1d5db 30deg, #d4af37 40deg, transparent 50deg, transparent 360deg)`,
                 animation: `rotate-border 4s linear infinite reverse`,
               }}
             >
               <motion.div
                 className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-full flex flex-col"
               >
                 <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center flex items-center justify-center gap-2">
                   <span className='text-yellow-400'>🏆</span> MotorManía Leaderboard <span className='text-yellow-400'>🏆</span>
                 </h2>
                  <div className="flex-grow space-y-2 overflow-y-auto max-h-60 scrollbar-thin scrollbar-thumb-yellow-600 scrollbar-track-gray-800 pr-2">
                   {leaderboard.length > 0 ? (
                     leaderboard.slice(0, 5).map((entry, index) => ( // Show top 5
                       <motion.div
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ duration: 0.4, delay: index * 0.05 }}
                         key={entry.user_id + index} // Use index in key if user_id might not be unique in edge cases
                         className={`p-2 rounded-lg flex items-center justify-between transition-all duration-200 shadow-sm ${
                           index === 0 ? 'bg-yellow-600/40 border border-yellow-500' :
                           index === 1 ? 'bg-gray-500/40 border border-gray-400' :
                           index === 2 ? 'bg-yellow-800/40 border border-yellow-700' :
                           'bg-gray-800/70 border border-transparent hover:bg-blue-800/40'
                         }`}
                       >
                         <div className="flex items-center gap-2 flex-1 min-w-0">
                           <span className={`font-bold text-sm w-8 text-center flex-shrink-0 ${ // Wider space for emoji
                               index === 0 ? 'text-yellow-300' : index === 1 ? 'text-gray-200' : index === 2 ? 'text-yellow-600' : 'text-amber-400'
                           }`}>
                             {index + 1}{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '.'}
                           </span>
                           <span className={`text-xs sm:text-sm truncate ${index < 3 ? 'text-white font-semibold' : 'text-white'}`}>{entry.name}</span>
                         </div>
                         <span className={`text-xs sm:text-sm font-medium flex-shrink-0 ${index < 3 ? 'text-white font-semibold' : 'text-amber-400'}`}>
                           {entry.score || 0} pts
                         </span>
                       </motion.div>
                     ))
                   ) : (
                     <p className="text-gray-400 font-exo2 text-sm text-center py-10">Aún no hay clasificaciones. ¡Sé el primero!</p>
                   )}
                 </div>
                 {/* Optional: Add a button to see full leaderboard */}
               </motion.div>
             </div>
           </div>
           
             {/* --- Leveled-Up Lego MODAL --- */}
<Transition appear show={showPromoModal} as={Fragment}>
  <Dialog as="div" className="relative z-50 font-exo2" onClose={() => setShowPromoModal(false)}>
    {/* Backdrop - slightly darker, more blur */}
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md" />
    </Transition.Child>

    {/* Modal Panel Container */}
    <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-300" // Original good, could try spring-like if desired, e.g., transition-[transform,opacity]
        enterFrom="opacity-0 scale-90" // Start slightly smaller for a more dynamic pop
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl {/* More rounded */}
                               bg-gradient-to-br from-slate-800 via-slate-900 to-black {/* Richer dark gradient */}
                               p-6 sm:p-8 {/* Generous padding */}
                               text-center text-white shadow-2xl {/* Stronger shadow */}
                               ring-1 ring-white/10 {/* Subtle border highlight */}
                              ">
          {/* Optional: Close Button for accessibility and common UX pattern */}
          <button
            type="button"
            onClick={() => setShowPromoModal(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors duration-150
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-full p-1"
            aria-label="Cerrar modal"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>

          <Dialog.Title className="text-xl sm:text-2xl font-bold text-slate-100 mb-3">
            🚀 ¡Envía tus predicciones!
          </Dialog.Title>

          {/* Using Dialog.Description for semantic correctness */}
          <Dialog.Description className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
            Regístrate y participa por un <span className="text-amber-400 font-semibold">Lego McLaren P1</span>.
          </Dialog.Description>

          <div className="w-full flex justify-center mb-8"> {/* More margin below image */}
            <Image
              src="/lego-mclaren.png" // Ensure this path is correct
              alt="Lego McLaren P1"
              width={250} // Slightly larger image
              height={140} // Adjust height proportionally
              className="rounded-lg shadow-xl object-contain" // shadow-xl for image too
            />
          </div>

          <button
            onClick={() => {
              // Potentially add analytics tracking here for "understood" click
              setShowPromoModal(false);
            }}
            className="w-full px-5 py-3 bg-amber-500 text-slate-900 font-bold {/* Changed to bold */}
                       text-base rounded-lg {/* Slightly less rounded than panel for hierarchy */}
                       hover:bg-amber-400 hover:shadow-md {/* Brighter hover, subtle shadow pop */}
                       active:bg-amber-600 active:scale-[0.98] {/* Darker active, slight shrink */}
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                       focus-visible:ring-amber-300 focus-visible:ring-offset-slate-900
                       transition-all duration-150 ease-in-out transform
                       will-change-transform, background-color, box-shadow {/* Performance hint */}
                      "
          >
            ¡Entendido!
          </button>
        </Dialog.Panel>
      </Transition.Child>
    </div>
  </Dialog>
</Transition>

{/* --- STICKY PREDICT BUTTON (MOBILE ONLY) --- */}
<AnimatePresence>
  {currentGp && (isQualyAllowed || isRaceAllowed) && !submitted && (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      // Enhanced container:
      // - Added paddingBottom to account for iOS home bar (safe-area-inset-bottom)
      // - Increased z-index slightly just in case, though 40 is usually enough
      className="fixed bottom-0 inset-x-0 z-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden"
    >
      <button
        onClick={handleStickyButtonClick}
        aria-label={progress > 0 ? 'Continuar predicción' : 'Iniciar predicción'}
        className="w-full flex justify-center items-center gap-x-2.5 py-3.5 px-6 {/* Adjusted padding for better balance */}
                   bg-gradient-to-r from-amber-500 via-orange-500 to-red-500
                   text-white font-exo2 font-bold text-base rounded-xl {/* Maintained original font & rounding */}
                   shadow-lg hover:shadow-xl {/* Softer initial shadow, more pronounced on hover */}
                   focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70 {/* Softer, more modern focus ring */}
                   focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 {/* Kept original offset for dark context */}
                   transition-all duration-300 ease-in-out {/* Smoother, slightly longer transition */}
                   hover:-translate-y-0.5 {/* Subtle lift on hover */}
                   active:scale-95 active:brightness-95 {/* Keep existing scale, slightly dim on active */}
                   will-change-transform, shadow {/* Hint browser for smoother animations */}
                  "
      >
        {/* Icono rayo - slightly larger and better vertical alignment if needed, though items-center helps */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-[22px] w-[22px]" fill="currentColor" viewBox="0 0 20 20"> {/* Slightly increased size */}
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
        <span className="leading-tight">{progress > 0 ? 'Continuar' : '¡Predecir!'}</span> {/* Ensure text aligns well */}
      </button>
    </motion.div>
  )}
</AnimatePresence>
{/* --- END STICKY PREDICT BUTTON --- */}

            {/* Modals */}
            <AnimatePresence>
                {/* Scoring System Modal */}
              {scoringModalOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4" // z-index below selection modal
                  onClick={() => setScoringModalOpen(false)}
                >
                  <motion.div
                    variants={modalVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                     transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className="bg-gradient-to-br from-black via-gray-900 to-black p-6 sm:p-8 rounded-xl border border-teal-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-lg max-h-[80vh] overflow-y-auto relative flex flex-col" // flex-col added
                    onClick={(e) => e.stopPropagation()}
                  >
                     <button
                       onClick={() => setScoringModalOpen(false)}
                       className="absolute top-3 right-3 text-gray-400 hover:text-amber-400 transition p-1 z-10"
                       aria-label="Cerrar"
                      >
                       ✕
                     </button>
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-5 font-exo2 text-center">Sistema de Puntuación</h2>
                    <div className="text-gray-300 font-exo2 text-sm sm:text-base space-y-3 flex-grow overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-teal-600 scrollbar-track-gray-800"> {/* List styling */}
                         <p><strong className='text-amber-400'>Pole / GP (Exacto):</strong> <span className='text-white'>5 pts</span> por acertar la posición exacta (1º, 2º o 3º).</p>
                         <p><strong className='text-amber-400'>Pole / GP (Top 3):</strong> <span className='text-white'>2 pts</span> si el piloto está en el Top 3 pero no en la posición exacta.</p>
                         <p><strong className='text-cyan-400'>Pit Stop Más Rápido:</strong> <span className='text-white'>3 pts</span> por acertar el equipo.</p>
                         <p><strong className='text-purple-400'>Vuelta Más Rápida:</strong> <span className='text-white'>3 pts</span> por acertar el piloto.</p>
                         <p><strong className='text-purple-400'>Piloto del Día:</strong> <span className='text-white'>3 pts</span> por acertar el piloto.</p>
                         <p><strong className='text-yellow-400'>Primer Equipo en Pits:</strong> <span className='text-white'>2 pts</span> por acertar el equipo.</p>
                         <p><strong className='text-yellow-400'>Primer Retiro:</strong> <span className='text-white'>2 pts</span> por acertar el piloto.</p>
                         <p className='text-xs text-gray-500 italic mt-4'>Nota: Los puntos por 'Top 3' no se suman a los puntos por 'Posición Exacta'. Máximo 5 puntos por piloto/posición.</p>
                    </div>
                    <button
                      onClick={() => setScoringModalOpen(false)}
                      className="mt-6 w-full px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-teal-300 hover:shadow-[0_0_10px_rgba(20,184,166,0.5)] transition-all duration-200 text-sm sm:text-base font-semibold"
                    >
                      Entendido
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {/* Prediction Step Modals */}
              {steps.map((step, index) => activeModal === step.name && (
                   <motion.div
                       key={step.name}
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       transition={{ duration: 0.3 }}
                       className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                       onClick={closeModal} // Assumes closeModal is defined
                   >
                       <motion.div
                           variants={modalVariants}
                           initial="hidden"
                           animate="visible"
                           exit="exit"
                           transition={{ type: 'spring', damping: 18, stiffness: 250 }}
                           className="bg-gradient-to-br from-black to-gray-900 p-6 sm:p-8 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[90vh] flex flex-col" // Increased max-height, flex-col
                           onClick={(e) => e.stopPropagation()}
                       >
                           {/* Header */}
                           <div className='mb-4'>
                               {/* Progress Bar */}
                               <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 relative overflow-hidden">
                                   <motion.div
                                       className="bg-gradient-to-r from-amber-500 to-cyan-500 h-full rounded-full"
                                       initial={{ width: 0 }}
                                       animate={{ width: `${progress}%` }} // Assumes progress state is available
                                       transition={{ duration: 0.5, ease: "easeOut" }}
                                   />
                               </div>
                                {/* Step Indicator */}
                                <p className="text-center text-xs font-medium text-gray-500 font-exo2 mb-2 uppercase tracking-wider">
                                   Paso {index + 1} / {steps.length}
                                </p>
                                {/* Title */}
                               <h2 className={`text-lg sm:text-xl font-bold mb-2 font-exo2 text-center ${
                                   step.name === 'pole' ? 'text-amber-400' :
                                   step.name === 'gp' ? 'text-cyan-400' :
                                   step.name === 'extras' ? 'text-purple-400' :
                                   step.name === 'micro' ? 'text-yellow-400' :
                                   'text-white' // Review title color
                               }`}>
                                   {step.label}
                                </h2>
                                {/* Instructions */}
                               <p className="text-gray-400 text-center mb-5 font-exo2 text-sm">{instructions[step.name as keyof typeof instructions]}</p>
                           </div>

                           {/* Content Area */}
                           <div className="flex-grow overflow-y-auto pr-3 space-y-4 scrollbar-thin scrollbar-thumb-amber-600/70 scrollbar-track-gray-800">
                              {step.name === 'pole' && (
                                  <>
                                      {renderPredictionField('pole1', 'Pole Pos. 1')}
                                      {renderPredictionField('pole2', 'Pole Pos. 2')}
                                      {renderPredictionField('pole3', 'Pole Pos. 3')}
                                  </>
                              )}
                               {step.name === 'gp' && (
                                  <>
                                      {renderPredictionField('gp1', 'GP Pos. 1')}
                                      {renderPredictionField('gp2', 'GP Pos. 2')}
                                      {renderPredictionField('gp3', 'GP Pos. 3')}
                                  </>
                               )}
                              {step.name === 'extras' && (
                                  <>
                                      {renderPredictionField('fastest_pit_stop_team', 'Equipo - Pit Stop Más Rápido')}
                                      {renderPredictionField('fastest_lap_driver', 'Piloto - Vuelta Más Rápida')}
                                      {renderPredictionField('driver_of_the_day', 'Piloto del Día')}
                                  </>
                              )}
                              {step.name === 'micro' && (
                                  <>
                                      {renderPredictionField('first_team_to_pit', 'Primer Equipo en Pits')}
                                      {renderPredictionField('first_retirement', 'Primer Retiro (Piloto)')}
                                  </>
                              )}
                              {step.name === 'review' && (
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                       {/* Pole Section */}
                                       <motion.div onClick={() => setActiveModal('pole')} className="cursor-pointer bg-gray-800/50 p-4 rounded-lg hover:bg-gray-700/60 transition duration-200 space-y-1 border border-transparent hover:border-amber-500/50" whileHover={{ y: -2 }}>
                                           <h3 className="text-base sm:text-lg font-semibold text-amber-400 font-exo2 mb-2">Posiciones de Pole</h3>
                                           <p className="text-gray-300 font-exo2 text-sm"><span className="font-medium text-gray-100 w-6 inline-block">1:</span> {predictions.pole1 || <span className="text-gray-500 italic">Vacío</span>}</p>
                                           <p className="text-gray-300 font-exo2 text-sm"><span className="font-medium text-gray-100 w-6 inline-block">2:</span> {predictions.pole2 || <span className="text-gray-500 italic">Vacío</span>}</p>
                                           <p className="text-gray-300 font-exo2 text-sm"><span className="font-medium text-gray-100 w-6 inline-block">3:</span> {predictions.pole3 || <span className="text-gray-500 italic">Vacío</span>}</p>
                                       </motion.div>
                                        {/* GP Section */}
                                       <motion.div onClick={() => setActiveModal('gp')} className="cursor-pointer bg-gray-800/50 p-4 rounded-lg hover:bg-gray-700/60 transition duration-200 space-y-1 border border-transparent hover:border-cyan-500/50" whileHover={{ y: -2 }}>
                                           <h3 className="text-base sm:text-lg font-semibold text-cyan-400 font-exo2 mb-2">Posiciones de GP</h3>
                                           <p className="text-gray-300 font-exo2 text-sm"><span className="font-medium text-gray-100 w-6 inline-block">1:</span> {predictions.gp1 || <span className="text-gray-500 italic">Vacío</span>}</p>
                                           <p className="text-gray-300 font-exo2 text-sm"><span className="font-medium text-gray-100 w-6 inline-block">2:</span> {predictions.gp2 || <span className="text-gray-500 italic">Vacío</span>}</p>
                                           <p className="text-gray-300 font-exo2 text-sm"><span className="font-medium text-gray-100 w-6 inline-block">3:</span> {predictions.gp3 || <span className="text-gray-500 italic">Vacío</span>}</p>
                                       </motion.div>
                                        {/* Extras Section */}
                                       <motion.div onClick={() => setActiveModal('extras')} className="cursor-pointer bg-gray-800/50 p-4 rounded-lg hover:bg-gray-700/60 transition duration-200 space-y-2 border border-transparent hover:border-purple-500/50" whileHover={{ y: -2 }}>
                                           <h3 className="text-base sm:text-lg font-semibold text-purple-400 font-exo2 mb-2">Predicciones Adicionales</h3>
                                           <p className="text-gray-300 font-exo2 text-sm"><strong className="text-gray-100 font-medium">Pit Stop + Rápido:</strong> {predictions.fastest_pit_stop_team || <span className="text-gray-500 italic">Vacío</span>}</p>
                                           <p className="text-gray-300 font-exo2 text-sm"><strong className="text-gray-100 font-medium">Vuelta + Rápida:</strong> {predictions.fastest_lap_driver || <span className="text-gray-500 italic">Vacío</span>}</p>
                                           <p className="text-gray-300 font-exo2 text-sm"><strong className="text-gray-100 font-medium">Piloto del Día:</strong> {predictions.driver_of_the_day || <span className="text-gray-500 italic">Vacío</span>}</p>
                                       </motion.div>
                                        {/* Micro Section */}
                                        <motion.div onClick={() => setActiveModal('micro')} className="cursor-pointer bg-gray-800/50 p-4 rounded-lg hover:bg-gray-700/60 transition duration-200 space-y-2 border border-transparent hover:border-yellow-500/50" whileHover={{ y: -2 }}>
                                           <h3 className="text-base sm:text-lg font-semibold text-yellow-400 font-exo2 mb-2">Micro-Predicciones</h3>
                                           <p className="text-gray-300 font-exo2 text-sm"><strong className="text-gray-100 font-medium">1er Equipo en Pits:</strong> {predictions.first_team_to_pit || <span className="text-gray-500 italic">Vacío</span>}</p>
                                           <p className="text-gray-300 font-exo2 text-sm"><strong className="text-gray-100 font-medium">1er Retiro:</strong> {predictions.first_retirement || <span className="text-gray-500 italic">Vacío</span>}</p>
                                       </motion.div>
                                   </div>
                              )}
                           </div>

                           {/* Footer Buttons & Errors */}
                           <div className="mt-auto pt-4"> {/* Pushes footer down, adds padding top */}
                               {/* Error Display */}
                               {errors.length > 0 && ( // Assumes errors state is available
                                   <div className="my-4 bg-red-900/30 border border-red-500/50 text-red-300 p-3 rounded-md text-center font-exo2 text-sm space-y-1">
                                       {errors.map((error, idx) => (
                                           <p key={idx}><span className="font-semibold mr-1">[!]:</span>{error}</p>
                                       ))}
                                   </div>
                               )}

                               {/* Navigation Buttons */}
                               <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                                   {/* Back/Close Button */}
                                   <button
                                       onClick={index === 0 ? closeModal : prevModal} // Assumes prevModal defined
                                       className="w-full sm:w-auto px-5 py-2.5 bg-gray-700/80 text-white rounded-lg font-exo2 hover:bg-gray-600/80 hover:text-amber-300 border border-transparent hover:border-amber-500/50 hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition-all duration-300 text-sm sm:text-base font-semibold"
                                   >
                                       {index === 0 ? 'Cerrar' : 'Anterior'}
                                   </button>

                                   {/* Next/Submit Button */}
                                   {index < steps.length - 1 ? (
                                       <motion.button
                                           whileHover={{ scale: 1.05 }}
                                           whileTap={{ scale: 0.95 }}
                                           onClick={nextModal} // Assumes nextModal defined
                                           className="w-full sm:w-auto px-5 py-2.5 bg-gray-800 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/30 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base font-semibold"
                                       >
                                           Siguiente
                                       </motion.button>
                                   ) : (
                                       <motion.button
                                           whileHover={{ scale: 1.05 }}
                                           whileTap={{ scale: 0.95 }}
                                           onClick={handleSubmit} // Assumes handleSubmit defined
                                           disabled={submitting || submitted} // Assumes submitting/submitted state available
                                           className={`w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-green-600 to-cyan-600 text-white border border-cyan-400/50 rounded-lg font-exo2 hover:from-green-500 hover:to-cyan-500 hover:shadow-[0_0_15px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base font-semibold relative overflow-hidden ${
                                               submitting || submitted ? 'opacity-60 cursor-not-allowed grayscale' : ''
                                           }`}
                                       >
                                            {submitting && (
                                                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                                                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                   </svg>
                                               </span>
                                            )}
                                           <span className={submitting ? 'opacity-0' : ''}>
                                               {submitting ? 'Enviando...' : submitted ? 'Enviadas ✓' : 'Enviar Predicciones'}
                                            </span>
                                       </motion.button>
                                   )}
                               </div>
                           </div>
                       </motion.div>
                   </motion.div>
               ))}


              {/* Share/Success Modal */}
              {activeModal === 'share' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={closeModal} // Close on overlay click
                >
                  <motion.div
                    variants={modalVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                     transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className="bg-gradient-to-br from-green-900 via-gray-900 to-black p-6 sm:p-8 rounded-xl border border-green-500/40 shadow-xl w-full max-w-[90vw] sm:max-w-md relative text-center" // Success theme
                    onClick={(e) => e.stopPropagation()}
                  >
                     <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                        className="mx-auto mb-4 w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-400"
                     >
                        <span className="text-4xl text-green-400">✓</span>
                     </motion.div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 font-exo2">¡Predicciones Enviadas!</h2>
                    <p className="text-gray-300 mb-6 font-exo2 text-sm sm:text-base">
                      Tus predicciones para el {submittedPredictions && currentGp?.gp_name ? currentGp.gp_name : 'GP'} han sido registradas. ¡Mucha suerte!
                      </p>
                    {/* Optional: Add Share Buttons or Link to Dashboard */}
                    {/* <div className="flex justify-center space-x-4 mb-6"> ... share buttons ... </div> */}
                    <button
                      onClick={closeModal} // Closes modal, doesn't navigate away
                      className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-green-300 hover:shadow-[0_0_10px_rgba(74,222,128,0.5)] transition-all duration-200 text-sm sm:text-base font-semibold"
                    >
                      Cerrar
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {/* Full Standings Modal */}
              {activeStandingsModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4" // z-index below selection
                  onClick={() => setActiveStandingsModal(null)}
                >
                  <motion.div
                    variants={modalVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ type: 'spring', damping: 18, stiffness: 250 }}
                     className="bg-gradient-to-br from-black via-gray-900 to-black p-5 sm:p-6 rounded-xl border border-blue-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[85vh] relative flex flex-col" // Adjusted size
                    onClick={(e) => e.stopPropagation()}
                  >
                     <button
                        onClick={() => setActiveStandingsModal(null)}
                        className="absolute top-3 right-3 text-gray-400 hover:text-amber-400 transition p-1 z-10"
                        aria-label="Cerrar"
                       >
                        ✕
                     </button>
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                      {activeStandingsModal === 'drivers' ? 'Clasificación Completa de Pilotos 2025' : 'Clasificación Completa de Constructores 2025'}
                    </h2>
                    <div className="flex-grow overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-gray-800">
                      <table className="w-full text-white font-exo2 text-xs sm:text-sm table-fixed">
                         <thead className="sticky top-0 bg-gray-900 z-10 shadow-sm"> {/* Sticky header */}
                           <tr>
                             <th className="p-2 text-left w-12 sm:w-16 text-amber-400">Pos.</th>
                             <th className="p-2 text-left">{activeStandingsModal === 'drivers' ? 'Piloto' : 'Constructor'}</th>
                             <th className="p-2 text-right w-16 sm:w-20">Pts</th>
                             <th className="p-2 text-center w-12 sm:w-16">Evo.</th>
                           </tr>
                         </thead>
                         <tbody>
                           {(activeStandingsModal === 'drivers' ? driverStandings : constructorStandings).map((standing, index) => { // Assumes driverStandings/constructorStandings available
                             const name = 'driver' in standing ? standing.driver : standing.constructor;
                             const teamName = 'driver' in standing ? driverToTeam[name] : name; // Assumes driverToTeam available
                             const team = teams.find((team) => team.name === teamName); // Assumes teams available
                             return (
                               <motion.tr
                                 key={index}
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 transition={{ duration: 0.3, delay: index * 0.03 }}
                                 className="border-b border-blue-500/20 hover:bg-blue-800/40 transition-colors duration-150"
                               >
                                 <td className="p-2 text-amber-400 font-bold">{standing.position}</td>
                                 <td className="p-2 flex items-center gap-2 truncate">
                                   <Image
                                     src={team?.logo_url || '/images/team-logos/default-team.png'}
                                     alt={`${teamName || 'Equipo'} logo`}
                                     width={24} // Slightly smaller in full list
                                     height={24}
                                     className="object-contain w-6 h-6 flex-shrink-0"
                                   />
                                   <span className="text-white text-sm truncate">{name}</span>
                                 </td>
                                 <td className="p-2 text-right text-gray-300 font-medium">{standing.points}</td>
                                 <td
                                   className={`p-2 text-center font-semibold ${
                                     standing.evolution.startsWith('↑') ? 'text-green-400' :
                                     standing.evolution.startsWith('↓') ? 'text-red-400' : 'text-gray-400'
                                   }`}
                                 >
                                  {standing.evolution === '=' ? '–' : standing.evolution}
                                 </td>
                               </motion.tr>
                             );
                           })}
                         </tbody>
                      </table>
                      {(activeStandingsModal === 'drivers' ? driverStandings.length === 0 : constructorStandings.length === 0) && (
                           <p className="text-center text-gray-500 py-8 font-exo2">No hay datos de clasificación disponibles.</p>
                       )}
                    </div>
                    <button
                      onClick={() => setActiveStandingsModal(null)}
                      className="mt-4 w-full flex-shrink-0 px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-blue-300 hover:shadow-[0_0_10px_rgba(96,165,250,0.5)] transition-all duration-200 text-sm sm:text-base font-semibold"
                    >
                      Cerrar
                    </button>
                  </motion.div>
                </motion.div>
              )}

             {/* Driver/Team Selection Modal */}
             {renderSelectionModal()}
             </AnimatePresence>
        </main>
      )}
    </div>
  );
}