'use client';

// SECTION: Imports
import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { createAuthClient } from '@/lib/supabase';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import LoadingAnimation from '@/components/LoadingAnimation';
import Standings from '@/components/Standings';
import { Howl } from 'howler';
import { Suspense } from 'react';
import { trackFBEvent } from '@/lib/trackFBEvent';
import { DriverStanding, ConstructorStanding, RookieStanding, DestructorStanding, Team } from '@/app/types/standings';

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
interface JugarYGanaProps {
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
  { driverId: 'doohan', givenName: 'Jack', familyName: 'Doohan', permanentNumber: '7', image: '/images/pilots/jack-doohan.png' },
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

// SECTION: Driver to Team Mapping
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

// SECTION: Flag Mapping
const gpFlags: Record<string, string> = {
  'Japanese Grand Prix': '/flags/japan.gif',
  'Monaco Grand Prix': '/flags/monaco.gif',
  'British Grand Prix': '/flags/uk.gif',
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
  review: 'Revisa tus predicciones antes de enviarlas.',
};

// SECTION: Main Component
export default function JugarYGana({ triggerSignInModal }: JugarYGanaProps) {
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

  // SECTION: Hydration for Clerk
  useEffect(() => {
    if (isLoaded) {
      const timeout = setTimeout(() => {
        setHydrated(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoaded]);

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
        if (now <= raceDate && currentGpIndex === -1) {
          currentGpIndex = i;
        }
        if (raceDate < now) {
          previousGpIndex = i;
        }
      }

      if (currentGpIndex >= 0 && scheduleData) {
        setCurrentGp(scheduleData[currentGpIndex]);
        const qualyDeadline = new Date(scheduleData[currentGpIndex].qualy_time).getTime() - 5 * 60 * 1000;
        const raceDeadline = new Date(scheduleData[currentGpIndex].race_time).getTime() - 5 * 60 * 1000;
        setIsQualyAllowed(now.getTime() < qualyDeadline);
        setIsRaceAllowed(now.getTime() < raceDeadline);
      } else {
        setCurrentGp(null);
        setIsQualyAllowed(false);
        setIsRaceAllowed(false);
      }

      if (previousGpIndex >= 0 && scheduleData) {
        setPreviousGp(scheduleData[previousGpIndex]);
        const raceDateStr = scheduleData[previousGpIndex].race_time.split('T')[0];

        const { data: resultsData, error: resultsError } = await supabase
          .from('race_results')
          .select('*')
          .eq('gp_name', scheduleData[previousGpIndex].gp_name)
          .eq('race_date', raceDateStr)
          .maybeSingle();

        if (resultsError) fetchErrors.push('No se pudieron cargar los resultados previos: ' + resultsError.message);
        setPreviousResults(resultsData || null);

        if (isSignedIn && user) {
          const { data: scoreData, error: scoreError } = await supabase
            .from('prediction_scores')
            .select('score')
            .eq('user_id', user.id)
            .eq('gp_name', scheduleData[previousGpIndex].gp_name)
            .eq('race_date', raceDateStr)
            .maybeSingle();

          if (scoreError) fetchErrors.push('No se pudo cargar el puntaje anterior: ' + scoreError.message);
          setUserPreviousScore(scoreData?.score || null);
        }
      } else {
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

  useEffect(() => {
    if (!currentGp || !gpSchedule.length) return;

    const updateCountdown = () => {
      const now = new Date();
      const qualyDate = new Date(currentGp.qualy_time);
      const raceDate = new Date(currentGp.race_time);
      const qualyDeadline = qualyDate.getTime() - 5 * 60 * 1000;
      const raceDeadline = raceDate.getTime() - 5 * 60 * 1000;

      const qualyDiff = qualyDate.getTime() - now.getTime();
      setQualyCountdown(
        qualyDiff <= 0 && raceDate.getTime() > now.getTime()
          ? { days: 0, hours: 0, minutes: 0, seconds: 0 }
          : {
              days: Math.floor(qualyDiff / (1000 * 60 * 60 * 24)),
              hours: Math.floor((qualyDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
              minutes: Math.floor((qualyDiff % (1000 * 60 * 60)) / (1000 * 60)),
              seconds: Math.floor((qualyDiff % (1000 * 60)) / 1000),
            }
      );

      const raceDiff = raceDate.getTime() - now.getTime();
      if (raceDiff <= 0) {
        const currentIndex = gpSchedule.findIndex((gp) => gp.gp_name === currentGp.gp_name);
        if (currentIndex < gpSchedule.length - 1) {
          setCurrentGp(gpSchedule[currentIndex + 1]);
          setPreviousGp(gpSchedule[currentIndex]);
          setIsQualyAllowed(now.getTime() < new Date(gpSchedule[currentIndex + 1].qualy_time).getTime() - 5 * 60 * 1000);
          setIsRaceAllowed(now.getTime() < new Date(gpSchedule[currentIndex + 1].race_time).getTime() - 5 * 60 * 1000);
        } else {
          setCurrentGp(null);
          setIsQualyAllowed(false);
          setIsRaceAllowed(false);
        }
        setRaceCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setRaceCountdown({
          days: Math.floor(raceDiff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((raceDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((raceDiff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((raceDiff % (1000 * 60)) / 1000),
        });
      }

      setIsQualyAllowed(now.getTime() < qualyDeadline);
      setIsRaceAllowed(now.getTime() < raceDeadline);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [currentGp, gpSchedule]);

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
    if (activeModal || activeSelectionModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [activeModal, activeSelectionModal]);


  // SECTION: Event Handlers
  const handleSelect = (position: keyof Prediction, value: string) => {
    const qualyPreds = [predictions.pole1, predictions.pole2, predictions.pole3];
    const racePreds = [predictions.gp1, predictions.gp2, predictions.gp3];
    if (
      position.startsWith('pole') &&
      qualyPreds.includes(value) &&
      qualyPreds.indexOf(value) !== ['pole1', 'pole2', 'pole3'].indexOf(position)
    ) {
      setErrors([`Ya has seleccionado a ${value} para otra posición de QUALY.`]);
      return;
    }
    if (
      position.startsWith('gp') &&
      racePreds.includes(value) &&
      racePreds.indexOf(value) !== ['gp1', 'gp2', 'gp3'].indexOf(position)
    ) {
      setErrors([`Ya has seleccionado a ${value} para otra posición de RACE.`]);
      return;
    }
    setPredictions((prev) => ({ ...prev, [position]: value }));
    setActiveSelectionModal(null);
    soundManager.click.play();
  };

  const handleClear = (position: keyof Prediction) => {
    setPredictions((prev) => ({ ...prev, [position]: '' }));
    setActiveSelectionModal(null);
  };

  const handleSubmit = async () => {
    if (!isSignedIn) {
      console.log('Triggering sign-in modal');
      localStorage.setItem('pendingPredictions', JSON.stringify(predictions));
      if (triggerSignInModal) {
        triggerSignInModal(); // Show modal
      } else {
        // Fallback to redirect if modal trigger is unavailable
        console.log('Falling back to redirect: /sign-in?redirect_url=/jugar-y-gana');
        router.push(`/sign-in?redirect_url=${encodeURIComponent('/jugar-y-gana')}`);
      }
      return;
    }
  
    if (!currentGp) {
      setErrors(['No hay GP activo para predecir.']);
      return;
    }
  
    if (!isQualyAllowed && !isRaceAllowed) {
      setErrors(['El período de predicciones ha cerrado para este GP.']);
      return;
    }
  
    const allowedPredictions: Partial<Prediction> = {};
    if (isQualyAllowed) {
      allowedPredictions.pole1 = predictions.pole1;
      allowedPredictions.pole2 = predictions.pole2;
      allowedPredictions.pole3 = predictions.pole3;
    }
    if (isRaceAllowed) {
      allowedPredictions.gp1 = predictions.gp1;
      allowedPredictions.gp2 = predictions.gp2;
      allowedPredictions.gp3 = predictions.gp3;
      allowedPredictions.fastest_pit_stop_team = predictions.fastest_pit_stop_team;
      allowedPredictions.fastest_lap_driver = predictions.fastest_lap_driver;
      allowedPredictions.driver_of_the_day = predictions.driver_of_the_day;
      allowedPredictions.first_team_to_pit = predictions.first_team_to_pit;
      allowedPredictions.first_retirement = predictions.first_retirement;
    }
  
    if (Object.values(allowedPredictions).every((value) => !value)) {
      setErrors(['Por favor, completa al menos una predicción permitida antes de enviar.']);
      return;
    }
  
    setSubmitting(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación.');
  
      const supabase = createAuthClient(token);
      const userId = user!.id;
      const userName = user!.fullName || 'Anónimo';
      const userEmail = user!.emailAddresses[0]?.emailAddress || 'unknown@example.com';
      const today = new Date();
      const week = Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  
      const { data: existingPrediction, error: fetchError } = await supabase
        .from('predictions')
        .select('id')
        .eq('user_id', userId)
        .eq('gp_name', currentGp.gp_name)
        .gte('submitted_at', new Date(today.getFullYear(), 0, 1).toISOString())
        .lte('submitted_at', new Date(today.getFullYear(), 11, 31).toISOString())
        .maybeSingle();
  
      if (fetchError) throw new Error('Error al verificar predicción previa: ' + fetchError.message);
      if (existingPrediction) {
        setErrors([`Ya has enviado una predicción para el ${currentGp.gp_name} esta temporada.`]);
        return;
      }
  
      const { error: predError } = await supabase.from('predictions').insert({
        user_id: userId,
        gp_name: currentGp.gp_name,
        ...allowedPredictions,
        submitted_at: new Date().toISOString(),
        submission_week: week,
        submission_year: today.getFullYear(),
      });
  
      if (predError) throw new Error('Error al guardar predicción: ' + predError.message);
  
      await fetch('/api/send-prediction-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, userName, predictions: allowedPredictions, gpName: currentGp.gp_name }),
      }).catch((emailErr) => console.error('Email API error:', emailErr));
  
      // 🎯 Tracking AFTER successful prediction
      trackFBEvent('PrediccionEnviada');
      fetch('/api/fb-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'PrediccionEnviada',
          event_source_url: window.location.href,
        }),
      }).then(res => res.json())
        .then(res => console.log('📡 CAPI PrediccionEnviada sent:', res))
        .catch(err => console.error('❌ CAPI PrediccionEnviada error:', err));
  
      setSubmitted(true);
      setSubmittedPredictions(allowedPredictions as Prediction);
      setPredictions({
        pole1: '',
        pole2: '',
        pole3: '',
        gp1: '',
        gp2: '',
        gp3: '',
        fastest_pit_stop_team: '',
        fastest_lap_driver: '',
        driver_of_the_day: '',
        first_team_to_pit: '',
        first_retirement: '',
      });
      setActiveModal('share');
      soundManager.submit.play();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Error al enviar predicciones.']);
      console.error('Submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // SECTION: Modal Handlers
const openModal = (modal: string) => {
    if (!submitted) {
      soundManager.openMenu.play();
      setActiveModal(modal);
      setActiveSelectionModal(null);
      setErrors([]);
  
      // 🎯 Meta Pixel + CAPI (Lead + IntentoPrediccion)
      trackFBEvent('Lead');
      trackFBEvent('IntentoPrediccion', {
        page: 'jugar-y-gana',
      });
  
      fetch('/api/fb-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'IntentoPrediccion',
          event_source_url: window.location.href,
        }),
      }).then((res) => {
        if (!res.ok) throw new Error('CAPI response error');
        return res.json();
      }).then((res) => {
        console.log('📡 CAPI IntentoPrediccion enviado:', res);
      }).catch((err) => {
        console.error('❌ Error al enviar IntentoPrediccion (CAPI):', err);
      });
    }
  };
  
  const closeModal = () => {
    if (activeModal === 'share') {
      router.push('/f1-fantasy-panel');
    }
    setActiveModal(null);
    setActiveSelectionModal(null);
    setErrors([]);
  };
  
  const modalOrder = ['pole', 'gp', 'extras', 'micro', 'review'];
  
  const nextModal = () => {
    const currentIndex = modalOrder.indexOf(activeModal!);
    if (currentIndex < modalOrder.length - 1) {
      setActiveModal(modalOrder[currentIndex + 1]);
      setErrors([]);
    }
  };
  
  const prevModal = () => {
    const currentIndex = modalOrder.indexOf(activeModal!);
    if (currentIndex > 0) {
      setActiveModal(modalOrder[currentIndex - 1]);
      setErrors([]);
    }
  };
  
  const openSelectionModal = (position: keyof Prediction) => {
    if (!submitted && (isQualyField(position) ? isQualyAllowed : isRaceAllowed)) {
      setActiveSelectionModal({ position, isTeam: position.includes('team') });
      soundManager.menuClick.play();
    }
  };
  
  const closeSelectionModal = () => {
    setActiveSelectionModal(null);
  };

  // SECTION: Utility Functions
  const getImageSrc = (position: keyof Prediction, value: string): string => {
    if (position === 'fastest_pit_stop_team' || position === 'first_team_to_pit') {
      return teams.find((team) => team.name === value)?.logo_url || '/images/team-logos/default-team.png';
    }
    return drivers.find((driver) => `${driver.givenName} ${driver.familyName}` === value)?.image || '/images/default-driver.png';
  };

  const getDriverImage = (driverName: string): string => {
    return drivers.find((driver) => `${driver.givenName} ${driver.familyName}` === driverName)?.image || '/images/default-driver.png';
  };

  const getTeamCarImage = (teamName: string): string => {
    return `/images/cars/${teamName.toLowerCase().replace(' ', '-')}.png` || '/images/cars/default-car.png';
  };

  const isQualyField = (position: keyof Prediction) => position.startsWith('pole');

  const formatCountdown = (countdown: { days: number; hours: number; minutes: number; seconds: number }) => {
    return `${String(countdown.days).padStart(2, '0')}d ${String(countdown.hours).padStart(2, '0')}h ${String(countdown.minutes).padStart(2, '0')}m ${String(countdown.seconds).padStart(2, '0')}s`;
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
    const isAllowed = isQualyField(position) ? isQualyAllowed : isRaceAllowed;
    const closedCategoryText = isQualyField(position) ? 'QUALY CERRADA' : 'CARRERA CERRADA';
    return (
      <div className="flex flex-col space-y-2 relative">
        <label className="text-gray-300 font-exo2 text-sm sm:text-base">{label}:</label>
        <div
          className={`p-3 rounded-lg border transition-all duration-300 flex items-center justify-between bg-gray-900/50 border-gray-500/30 relative ${
            isAllowed && !submitted
              ? predictions[position]
                ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                : 'hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] cursor-pointer'
              : 'opacity-50 cursor-not-allowed'
          }`}
          onClick={() => isAllowed && !submitted && openSelectionModal(position)}
        >
          <span className="text-white font-exo2 truncate flex items-center">
            {predictions[position] && (
              <Image
                src={getImageSrc(position, predictions[position])}
                alt={predictions[position]}
                width={48}
                height={48}
                className="mr-2 object-contain sm:w-16 sm:h-16"
              />
            )}
            {predictions[position] || (position.includes('team') ? 'Seleccionar equipo' : 'Seleccionar piloto')}
          </span>
          {predictions[position] && (
            <motion.span {...fadeInUp} transition={{ duration: 0.3 }} className="text-green-400">✓</motion.span>
          )}
          {!isAllowed && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/70 rounded-lg">
              <span className="text-red-400 font-exo2 text-xs sm:text-sm font-semibold">{closedCategoryText}</span>
            </div>
          )}
        </div>
        {predictions[position] && isAllowed && !submitted && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => handleClear(position)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-400 transition"
          >
            ✕
          </motion.button>
        )}
      </div>
    );
  };

  const renderSelectionModal = () => {
    if (!activeSelectionModal) return null;
    const { position, isTeam } = activeSelectionModal;
    const items = isTeam ? teams : drivers;
    const title = isTeam ? 'Seleccionar Equipo' : 'Seleccionar Piloto';

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
        onClick={closeSelectionModal}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2">{title} para {position.replace('_', ' ').toUpperCase()}</h2>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4"
          >
            {items.map((item) => {
              const key = isTeam ? (item as Team).name : (item as Driver).driverId;
              const displayName = isTeam ? (item as Team).name : `${(item as Driver).givenName} ${(item as Driver).familyName}`;
              const imageSrc = isTeam ? (item as Team).logo_url : (item as Driver).image;
              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleSelect(position, displayName)}
                  className="p-2 sm:p-4 rounded-lg text-white font-exo2 flex flex-col items-center gap-1 sm:gap-2 hover:bg-amber-500/20 transition-all duration-200"
                >
                  <Image src={imageSrc} alt={displayName} width={60} height={60} className="object-contain sm:w-20 sm:h-20" />
                  <span className="text-xs sm:text-sm truncate">{displayName}</span>
                  {!isTeam && <span className="text-gray-400 text-xs">{(item as Driver).permanentNumber}</span>}
                </motion.button>
              );
            })}
          </motion.div>
          <button
            onClick={closeSelectionModal}
            className="mt-4 w-full px-4 py-2 bg-gray-700 text-white rounded-lg font-exo2 hover:bg-gray-600 transition text-sm sm:text-base"
          >
            Cerrar
          </button>
        </motion.div>
      </motion.div>
    );
  };

  // SECTION: Restore Predictions After Login
  useEffect(() => {
    if (isSignedIn) {
      const savedPredictions = localStorage.getItem('pendingPredictions');
      if (savedPredictions) {
        try {
          const restoredPredictions = JSON.parse(savedPredictions);
          setPredictions(restoredPredictions);
          setActiveModal('review'); // Open review modal to continue
          localStorage.removeItem('pendingPredictions'); // Clear after restoration
        } catch (error) {
          console.error('Error restoring predictions:', error);
          localStorage.removeItem('pendingPredictions'); // Clear on error
        }
      }
    }
  }, [isSignedIn]);

  // SECTION: JSX Return Statement
  if (!hydrated || !isLoaded) {
    return <LoadingAnimation text="Cargando autenticación..." animationDuration={4} />;
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white overflow-hidden relative">
      <Header />
      {!isDataLoaded ? (
        <LoadingAnimation animationDuration={loadingDuration} />
      ) : (
        <main
          key={`main-${forceRender}`}
          className="container mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16"
        >
          {/* Row 1: Key Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Column 1 - Countdown */}
            <div
              className="animate-rotate-border rounded-xl p-px"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, red 20deg, white 30deg, red 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '4s',
              }}
            >
              <div className="relative group bg-gradient-to-br from-[#1e3a8a] to-[#38bdf8] p-3 sm:p-4 rounded-xl shadow-lg z-10 min-h-40 flex flex-col justify-between overflow-hidden">
                {currentGp && gpFlags[currentGp.gp_name] && (
                  <motion.img
                    src={gpFlags[currentGp.gp_name]}
                    alt={`Bandera ondeante de ${currentGp.gp_name}`}
                    className="absolute inset-0 w-full h-full opacity-30 group-hover:opacity-100 transition-opacity duration-300 object-cover z-0"
                    whileHover={{ rotate: 2, scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-black/50 backdrop-blur-sm z-5 pointer-events-none" />
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <motion.h2
                    className="text-sm sm:text-base font-bold text-white font-exo2 leading-tight mb-2"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    {currentGp ? `Próximo GP: ${currentGp.gp_name}` : 'Próximo GP'}
                  </motion.h2>
                  <div className="flex flex-col items-center justify-center flex-grow gap-1">
                    <p className="text-xs sm:text-sm font-exo2 text-white drop-shadow-md">
                      {showQualy ? 'QUALY' : 'Carrera'}
                    </p>
                    <motion.p
                      key={showQualy ? 'qualy' : 'race'}
                      className="font-semibold text-lg sm:text-xl text-white drop-shadow-md"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                    >
                      {showQualy ? formatCountdown(qualyCountdown) : formatCountdown(raceCountdown)}
                    </motion.p>
                  </div>
                  <p className="text-white text-[10px] sm:text-xs font-exo2 leading-tight drop-shadow-md">
                    {currentGp
                      ? new Date(currentGp.race_time).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
                      : 'Pendiente'}
                  </p>
                </div>
              </div>
            </div>
            {/* Column 2 - Last Race Winner */}
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
            {/* Column 3 - Fastest Pit Stop */}
            <div
              className="animate-rotate-border rounded-xl p-px"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #0d9488 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '5s',
              }}
            >
              <motion.div
                className={`p-3 sm:p-4 pb-0 rounded-xl shadow-lg relative z-10 flex flex-col items-center bg-gradient-to-br h-40 overflow-hidden ${
                  previousResults?.fastest_pit_stop_team
                    ? `${teamColors[previousResults.fastest_pit_stop_team].gradientFrom} ${teamColors[previousResults.fastest_pit_stop_team].gradientTo}`
                    : 'from-gray-700 to-gray-600'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-black/50 backdrop-blur-sm z-0 pointer-events-none" />
                <div className="relative z-20 w-full text-center mb-2">
                  <h2 className="text-base sm:text-lg font-bold text-white font-exo2 drop-shadow-md">
                    Equipo Más Rápido
                  </h2>
                  {previousResults?.fastest_pit_stop_team ? (
                    <p className="text-[10px] sm:text-xs text-white font-exo2 drop-shadow-md truncate">
                      {previousResults.fastest_pit_stop_team} - {previousResults.gp_name}
                    </p>
                  ) : (
                    <p className="text-gray-400 font-exo2 text-xs sm:text-sm">
                      No hay resultados previos disponibles.
                    </p>
                  )}
                </div>
                {previousResults?.fastest_pit_stop_team && (
                  <div className="w-full h-full flex justify-center items-end relative z-10">
                    <Image
                      src={getTeamCarImage(previousResults.fastest_pit_stop_team)}
                      alt={`${previousResults.fastest_pit_stop_team} car`}
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

          {/* Row 2: Predictions & Standings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Predictions Card */}
            <div
              className="animate-rotate-border rounded-xl p-0.5 md:animate-rotate-border"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '6s',
                animationDirection: 'reverse',
              }}
            >
              <motion.div
                className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-auto md:h-[480px] lg:h-[540px] flex flex-col justify-between"
              >
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-2 md:mb-4 font-exo2 text-center">
                    Haz tus Predicciones
                  </h2>
                  <div className="w-full bg-gray-800 rounded-full h-2 mb-2 md:mb-4 relative overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-amber-500 to-cyan-500 h-2 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.7)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-gray-300 text-center mb-2 md:mb-4 font-exo2 text-sm sm:text-base">
                    {Math.round(progress)}% completado
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 md:gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(251,191,36,0.7)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openModal('pole')}
                    className={`w-full py-3 px-4 rounded-lg bg-gray-900 border border-amber-400/50 text-amber-400 font-exo2 text-sm sm:text-base font-semibold transition-all duration-200 ${
                      submitted
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-amber-900/20 hover:text-amber-300 hover:border-amber-300'
                    }`}
                    disabled={submitted}
                  >
                    Posiciones de Pole {isSectionComplete('pole') ? '✓' : ''}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(34,211,238,0.7)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openModal('gp')}
                    className={`w-full py-3 px-4 rounded-lg bg-gray-900 border border-cyan-400/50 text-cyan-400 font-exo2 text-sm sm:text-base font-semibold transition-all duration-200 ${
                      submitted
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300'
                    }`}
                    disabled={submitted}
                  >
                    Posiciones de GP {isSectionComplete('gp') ? '✓' : ''}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(168,85,247,0.7)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openModal('extras')}
                    className={`w-full py-3 px-4 rounded-lg bg-gray-900 border border-purple-400/50 text-purple-400 font-exo2 text-sm sm:text-base font-semibold transition-all duration-200 ${
                      submitted
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-purple-900/20 hover:text-purple-300 hover:border-purple-300'
                    }`}
                    disabled={submitted}
                  >
                    Predicciones Adicionales {isSectionComplete('extras') ? '✓' : ''}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(250,204,21,0.7)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openModal('micro')}
                    className={`w-full py-3 px-4 rounded-lg bg-gray-900 border border-yellow-400/50 text-yellow-400 font-exo2 text-sm sm:text-base font-semibold transition-all duration-200 ${
                      submitted
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-yellow-900/20 hover:text-yellow-300 hover:border-yellow-300'
                    }`}
                    disabled={submitted}
                  >
                    Micro-Predicciones {isSectionComplete('micro') ? '✓' : ''}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(20,184,166,0.7)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setScoringModalOpen(true)}
                    className="w-full py-3 px-4 rounded-lg bg-gray-900 border border-teal-400/50 text-teal-400 font-exo2 text-sm sm:text-base font-semibold transition-all duration-200 hover:bg-teal-900/20 hover:text-teal-300 hover:border-teal-300"
                  >
                    Sistema de Puntuación
                  </motion.button>
                </div>
              </motion.div>
            </div>
            {/* Driver Standings Card */}
            <div
              className="animate-rotate-border rounded-xl p-0.5 md:animate-rotate-border"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e3a8a 20deg, #38bdf8 30deg, #1e3a8a 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '5s',
              }}
            >
              <motion.div
                className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-auto md:h-[480px] lg:h-[540px] grid grid-rows-[1fr_auto]"
              >
                <div className="h-full">
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                    Clasificación Pilotos 2025
                  </h2>
                  <div className="block md:hidden">
                    {driverStandings.length > 0 ? (
                      driverStandings.slice(0, 5).map((standing) => {
                        const teamName = driverToTeam[standing.driver];
                        const team = teams.find((team) => team.name === teamName);
                        if (!team) {
                          console.warn(`Team not found for driver ${standing.driver}: ${teamName}`);
                        }
                        return (
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: standing.position * 0.1 }}
                            key={standing.position}
                            className="bg-gray-800 p-4 mb-2 rounded-lg flex items-center justify-between hover:bg-blue-800/50 transition-all duration-200"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 font-bold text-sm">{standing.position}</span>
                              <Image
                                src={team?.logo_url || '/images/team-logos/default-team.png'}
                                alt={`${teamName || 'Equipo'} logo`}
                                width={32}
                                height={32}
                                className="object-contain w-8 h-8 transition-transform duration-200 hover:scale-110"
                              />
                              <span className="text-white text-sm truncate">{standing.driver}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-300 text-sm">{standing.points} pts</span>
                              <span
                                className={`text-sm ${
                                  standing.evolution.startsWith('↑')
                                    ? 'text-green-400'
                                    : standing.evolution.startsWith('↓')
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                                }`}
                              >
                                {standing.evolution}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-gray-400 font-exo2 text-sm text-center">Cargando clasificación...</p>
                    )}
                  </div>
                  <div className="hidden md:block h-full">
                    <div className="max-h-[calc(100%-4rem)]">
                      <table className="w-full text-white font-exo2 text-xs sm:text-sm table-fixed">
                        <thead>
                          <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                            <th className="p-1 sm:p-2 text-left w-12">Pos.</th>
                            <th className="p-1 sm:p-2 text-left">Piloto</th>
                            <th className="p-1 sm:p-2 text-right w-16">Pts</th>
                            <th className="p-1 sm:p-2 text-center w-16">Evo.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {driverStandings.length > 0 ? (
                            driverStandings.slice(0, 7).map((standing) => {
                              const teamName = driverToTeam[standing.driver];
                              const team = teams.find((team) => team.name === teamName);
                              if (!team) {
                                console.warn(`Team not found for driver ${standing.driver}: ${teamName}`);
                              }
                              return (
                                <motion.tr
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.5, delay: standing.position * 0.1 }}
                                  key={standing.position}
                                  className="border-b border-amber-500/20 hover:bg-blue-800/50 hover:translate-y-[-2px] transition-all duration-200"
                                >
                                  <td className="p-1 sm:p-2 text-amber-400 font-bold">{standing.position}</td>
                                  <td className="p-1 sm:p-2 flex items-center gap-1 sm:gap-2 truncate">
                                    <Image
                                      src={team?.logo_url || '/images/team-logos/default-team.png'}
                                      alt={`${teamName || 'Equipo'} logo`}
                                      width={32}
                                      height={32}
                                      className="object-contain w-8 h-8 transition-transform duration-200 hover:scale-110"
                                    />
                                    <span className="text-white text-sm">{standing.driver}</span>
                                  </td>
                                  <td className="p-1 sm:p-2 text-right text-gray-300">{standing.points}</td>
                                  <td
                                    className={`p-1 sm:p-2 text-center ${
                                      standing.evolution.startsWith('↑')
                                        ? 'text-green-400'
                                        : standing.evolution.startsWith('↓')
                                        ? 'text-red-400'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {standing.evolution}
                                  </td>
                                </motion.tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-gray-400">
                                Cargando clasificación...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveStandingsModal('drivers')}
                  className="w-full py-2 px-4 bg-gray-900 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_2px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base font-semibold"
                  aria-label="Ver clasificación completa de pilotos"
                >
                  Clasificación Completa
                </motion.button>
              </motion.div>
            </div>
            {/* Constructor Standings Card */}
            <div
              className="animate-rotate-border rounded-xl p-0.5 md:animate-rotate-border"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #15803d 20deg, #86efac 30deg, #15803d 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '4.5s',
                animationDirection: 'reverse',
              }}
            >
              <motion.div
                className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-auto md:h-[480px] lg:h-[540px] grid grid-rows-[1fr_auto]"
              >
                <div className="h-full">
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                    Clasificación Constructores 2025
                  </h2>
                  <div className="block md:hidden">
                    {constructorStandings.length > 0 ? (
                      constructorStandings.slice(0, 5).map((standing) => {
                        const teamName = standing.constructor;
                        const team = teams.find((team) => team.name === teamName);
                        if (!team) {
                          console.warn(`Team not found for constructor: ${teamName}`);
                        }
                        return (
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: standing.position * 0.1 }}
                            key={standing.position}
                            className="bg-gray-800 p-4 mb-2 rounded-lg flex items-center justify-between hover:bg-blue-800/50 transition-all duration-200"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 font-bold text-sm">{standing.position}</span>
                              <Image
                                src={team?.logo_url || '/images/team-logos/default-team.png'}
                                alt={`${teamName} logo`}
                                width={32}
                                height={32}
                                className="object-contain w-8 h-8 transition-transform duration-200 hover:scale-110"
                              />
                              <span className="text-white text-sm truncate">{standing.constructor}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-300 text-sm">{standing.points} pts</span>
                              <span
                                className={`text-sm ${
                                  standing.evolution.startsWith('↑')
                                    ? 'text-green-400'
                                    : standing.evolution.startsWith('↓')
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                                }`}
                              >
                                {standing.evolution}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-gray-400 font-exo2 text-sm text-center">Cargando clasificación...</p>
                    )}
                  </div>
                  <div className="hidden md:block h-full">
                    <div className="max-h-[calc(100%-4rem)]">
                      <table className="w-full text-white font-exo2 text-xs sm:text-sm table-fixed">
                        <thead>
                          <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                            <th className="p-1 sm:p-2 text-left w-12">Pos.</th>
                            <th className="p-1 sm:p-2 text-left">Constructor</th>
                            <th className="p-1 sm:p-2 text-right w-16">Pts</th>
                            <th className="p-1 sm:p-2 text-center w-16">Evo.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {constructorStandings.length > 0 ? (
                            constructorStandings.slice(0, 7).map((standing) => {
                              const teamName = standing.constructor;
                              const team = teams.find((team) => team.name === teamName);
                              if (!team) {
                                console.warn(`Team not found for constructor: ${teamName}`);
                              }
                              return (
                                <motion.tr
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.5, delay: standing.position * 0.1 }}
                                  key={standing.position}
                                  className="border-b border-amber-500/20 hover:bg-blue-800/50 hover:translate-y-[-2px] transition-all duration-200"
                                >
                                  <td className="p-1 sm:p-2 text-amber-400 font-bold">{standing.position}</td>
                                  <td className="p-1 sm:p-2 flex items-center gap-1 sm:gap-2 truncate">
                                    <Image
                                      src={team?.logo_url || '/images/team-logos/default-team.png'}
                                      alt={`${teamName} logo`}
                                      width={32}
                                      height={32}
                                      className="object-contain w-8 h-8 transition-transform duration-200 hover:scale-110"
                                    />
                                    <span className="text-white text-sm">{standing.constructor}</span>
                                  </td>
                                  <td className="p-1 sm:p-2 text-right text-gray-300">{standing.points}</td>
                                  <td
                                    className={`p-1 sm:p-2 text-center ${
                                      standing.evolution.startsWith('↑')
                                        ? 'text-green-400'
                                        : standing.evolution.startsWith('↓')
                                        ? 'text-red-400'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {standing.evolution}
                                  </td>
                                </motion.tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-gray-400">
                                Cargando clasificación...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveStandingsModal('constructors')}
                  className="w-full py-2 px-4 bg-gray-900 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_2px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base font-semibold"
                  aria-label="Ver clasificación completa de constructores"
                >
                  Clasificación Completa
                </motion.button>
              </motion.div>
            </div>
          </div>

          {/* Row 3: Destructors, Rookies, Leaderboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Destructors 2025 */}
                        <div
              className="animate-rotate-border rounded-xl p-0.5 md:animate-rotate-border"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #ea580c 20deg, #facc15 30deg, #ea580c 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '3.5s',
              }}
            >
              <motion.div
                className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-auto flex flex-col"
              >
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                  Destructores 2025
                </h2>
                <div className="block md:hidden">
                  {destructorStandings.length > 0 ? (
                    destructorStandings.slice(0, 5).map((standing) => (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: standing.position * 0.1 }}
                        key={standing.position}
                        className="bg-gray-800 p-4 mb-2 rounded-lg flex items-center justify-between hover:bg-blue-800/50 transition-all duration-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold text-sm">{standing.position}</span>
                          <span className="text-white text-sm truncate">{standing.driver}</span>
                        </div>
                        <span className="text-gray-300 text-sm">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(standing.total_costs)}
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-gray-400 font-exo2 text-sm text-center">Cargando destructores...</p>
                  )}
                </div>
                <div className="hidden md:block">
                  <table className="w-full text-white font-exo2 text-xs sm:text-sm table-fixed">
                    <thead>
                      <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                        <th className="p-1 sm:p-2 text-left w-12">Pos.</th>
                        <th className="p-1 sm:p-2 text-left">Piloto</th>
                        <th className="p-1 sm:p-2 text-right w-24">Costos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {destructorStandings.length > 0 ? (
                        destructorStandings.slice(0, 5).map((standing) => (
                          <motion.tr
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: standing.position * 0.1 }}
                            key={standing.position}
                            className="border-b border-amber-500/20 hover:bg-blue-800/50 hover:translate-y-[-2px] transition-all duration-200"
                          >
                            <td className="p-1 sm:p-2 text-amber-400 font-bold">{standing.position}</td>
                            <td className="p-1 sm:p-2 text-white truncate">{standing.driver}</td>
                            <td className="p-1 sm:p-2 text-right text-gray-300">
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(standing.total_costs)}
                            </td>
                          </motion.tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-gray-400">
                            Cargando destructores...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
            {/* Rookies 2025 */}
            <div
              className="animate-rotate-border rounded-xl p-0.5 md:animate-rotate-border"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #db2777 20deg, #f9a8d4 30deg, #db2777 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '6s',
              }}
            >
              <motion.div
                className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-auto flex flex-col"
              >
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                  Rookies 2025
                </h2>
                <div className="block md:hidden">
                  {rookieStandings.length > 0 ? (
                    rookieStandings.slice(0, 5).map((standing) => (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: standing.position * 0.1 }}
                        key={standing.position}
                        className="bg-gray-800 p-4 mb-2 rounded-lg flex items-center justify-between hover:bg-blue-800/50 transition-all duration-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold text-sm">{standing.position}</span>
                          <span className="text-white text-sm truncate">{standing.driver}</span>
                        </div>
                        <span className="text-gray-300 text-sm">{standing.points} pts</span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-gray-400 font-exo2 text-sm text-center">Cargando rookies...</p>
                  )}
                </div>
                <div className="hidden md:block">
                  <table className="w-full text-white font-exo2 text-xs sm:text-sm table-fixed">
                    <thead>
                      <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                        <th className="p-1 sm:p-2 text-left w-12">Pos.</th>
                        <th className="p-1 sm:p-2 text-left">Piloto</th>
                        <th className="p-1 sm:p-2 text-right w-16">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rookieStandings.length > 0 ? (
                        rookieStandings.slice(0, 5).map((standing) => (
                          <motion.tr
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: standing.position * 0.1 }}
                            key={standing.position}
                            className="border-b border-amber-500/20 hover:bg-blue-800/50 hover:translate-y-[-2px] transition-all duration-200"
                          >
                            <td className="p-1 sm:p-2 text-amber-400 font-bold">{standing.position}</td>
                            <td className="p-1 sm:p-2 text-white truncate">{standing.driver}</td>
                            <td className="p-1 sm:p-2 text-right text-gray-300">{standing.points}</td>
                          </motion.tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-gray-400">
                            Cargando rookies...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
            {/* MotorManía Leaderboard */}
            <div
              className="animate-rotate-border rounded-xl p-0.5 md:animate-rotate-border"
              style={{
                background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #d4af37 20deg, #d1d5db 30deg, #d4af37 40deg, transparent 50deg, transparent 360deg)`,
                animationDuration: '4s',
                animationDirection: 'reverse',
              }}
            >
              <motion.div
                className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 h-auto flex flex-col"
              >
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                  MotorManía Leaderboard
                </h2>
                <div className="block md:hidden">
                  {leaderboard.length > 0 ? (
                    leaderboard.slice(0, 5).map((entry, index) => (
                      <motion.div
                        key={entry.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className={`bg-gray-800 p-4 mb-2 rounded-lg flex items-center justify-between hover:bg-blue-800/50 transition-all duration-200 ${
                          index === 0 ? 'bg-amber-600/30' : index === 1 ? 'bg-amber-500/30' : index === 2 ? 'bg-amber-400/30' : ''
                        }`}
                      >
                        <span className="font-semibold text-white flex items-center">
                          {index === 0 && <span className="mr-2 text-amber-400">🥇</span>}
                          {index === 1 && <span className="mr-2 text-amber-400">🥈</span>}
                          {index === 2 && <span className="mr-2 text-amber-400">🥉</span>}
                          {entry.name}
                        </span>
                        <span className="text-amber-400 font-bold">{entry.score || 0} pts</span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-gray-400 font-exo2 text-sm text-center">Aún no hay clasificaciones. ¡Sé el primero!</p>
                  )}
                </div>
                <div className="hidden md:block">
                  {leaderboard.length > 0 ? (
                    leaderboard.slice(0, 5).map((entry, index) => (
                      <motion.div
                        key={entry.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className={`p-3 bg-gray-800 rounded-lg flex justify-between items-center text-sm hover:bg-blue-800/50 hover:translate-y-[-2px] transition-all duration-200 mb-2 ${
                          index === 0 ? 'bg-amber-600/30' : index === 1 ? 'bg-amber-500/30' : index === 2 ? 'bg-amber-400/30' : ''
                        }`}
                      >
                        <span className="font-semibold text-white flex items-center">
                          {index === 0 && <span className="mr-2 text-amber-400">🥇</span>}
                          {index === 1 && <span className="mr-2 text-amber-400">🥈</span>}
                          {index === 2 && <span className="mr-2 text-amber-400">🥉</span>}
                          {entry.name}
                        </span>
                        <span className="text-amber-400 font-bold">{entry.score || 0} pts</span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-gray-400 font-exo2 text-sm text-center">Aún no hay clasificaciones. ¡Sé el primero!</p>
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Modals */}
          <AnimatePresence>
            {scoringModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={() => setScoringModalOpen(false)}
              >
                <motion.div
                  variants={{
                    hidden: { opacity: 0, scale: 0.95 },
                    visible: { opacity: 1, scale: 1 },
                    exit: { opacity: 0, scale: 0.95 },
                  }}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-black to-gray-900 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-lg max-h-[80vh] overflow-y-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">Sistema de Puntuación</h2>
                  <div className="text-gray-300 font-exo2 text-sm sm:text-base space-y-2">
                    <p>- <strong>Pole y GP (1º, 2º, 3º):</strong> 5 pts por acierto exacto, 2 pts si está en el top 3.</p>
                    <p>- <strong>Pit Stop Más Rápido:</strong> 3 pts por equipo correcto.</p>
                    <p>- <strong>Vuelta Más Rápida:</strong> 3 pts por piloto correcto.</p>
                    <p>- <strong>Piloto del Día:</strong> 3 pts por acierto.</p>
                    <p>- <strong>Primer Equipo en Pits:</strong> 2 pts por equipo correcto.</p>
                    <p>- <strong>Primer Retiro:</strong> 2 pts por piloto correcto.</p>
                  </div>
                  <button
                    onClick={() => setScoringModalOpen(false)}
                    className="mt-4 w-full px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-teal-400 hover:shadow-[0_0_10px_rgba(20,184,166,0.5)] transition text-sm sm:text-base"
                  >
                    Cerrar
                  </button>
                </motion.div>
              </motion.div>
            )}
            {activeModal === 'pole' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={closeModal}
              >
                <motion.div
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-black to-gray-900 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full bg-gray-800 rounded-full h-1 mb-4 relative overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-amber-500 to-cyan-500 h-1 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-gray-400 font-exo2 text-sm">
                      Paso 1 de 5: {steps[0].label}
                    </span>
                    <span className="ml-2 text-gray-400"></span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-amber-400 mb-2 font-exo2 text-center">{steps[0].label}</h2>
                  <p className="text-gray-400 text-center mb-4 font-exo2 text-sm">{instructions.pole}</p>
                  <div className="space-y-4">
                    {renderPredictionField('pole1', 'Pole Pos. 1')}
                    {renderPredictionField('pole2', 'Pole Pos. 2')}
                    {renderPredictionField('pole3', 'Pole Pos. 3')}
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between mt-4 sm:mt-6 gap-2">
                    <button
                      onClick={closeModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition text-sm sm:text-base"
                    >
                      Cerrar
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={nextModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base"
                    >
                      Siguiente
                    </motion.button>
                  </div>
                  {errors.length > 0 && (
                    <div className="text-red-400 text-center mt-4 font-exo2 space-y-2 text-sm sm:text-base">
                      {errors.map((error, idx) => (
                        <p key={idx}>{error}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
            {activeModal === 'gp' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={closeModal}
              >
                <motion.div
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-black to-gray-900 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full bg-gray-800 rounded-full h-1 mb-4 relative overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-amber-500 to-cyan-500 h-1 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-gray-400 font-exo2 text-sm">
                      Paso 2 de 5: {steps[1].label}
                    </span>
                    <span className="ml-2 text-gray-400"></span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-cyan-400 mb-2 font-exo2 text-center">{steps[1].label}</h2>
                  <p className="text-gray-400 text-center mb-4 font-exo2 text-sm">{instructions.gp}</p>
                  <div className="space-y-4">
                    {renderPredictionField('gp1', 'GP Pos. 1')}
                    {renderPredictionField('gp2', 'GP Pos. 2')}
                    {renderPredictionField('gp3', 'GP Pos. 3')}
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between mt-4 sm:mt-6 gap-2">
                    <button
                      onClick={prevModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition text-sm sm:text-base"
                    >
                      Anterior
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={nextModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base"
                    >
                      Siguiente
                    </motion.button>
                  </div>
                  {errors.length > 0 && (
                    <div className="text-red-400 text-center mt-4 font-exo2 space-y-2 text-sm sm:text-base">
                      {errors.map((error, idx) => (
                        <p key={idx}>{error}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
            {activeModal === 'extras' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={closeModal}
              >
                <motion.div
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-black to-gray-900 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full bg-gray-800 rounded-full h-1 mb-4 relative overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-amber-500 to-cyan-500 h-1 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-gray-400 font-exo2 text-sm">
                      Paso 3 de 5: {steps[2].label}
                    </span>
                    <span className="ml-2 text-gray-400"></span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-2 font-exo2 text-center">{steps[2].label}</h2>
                  <p className="text-gray-400 text-center mb-4 font-exo2 text-sm">{instructions.extras}</p>
                  <div className="space-y-4">
                    {renderPredictionField('fastest_pit_stop_team', 'Pit Stop Más Rápido')}
                    {renderPredictionField('fastest_lap_driver', 'Vuelta Más Rápida')}
                    {renderPredictionField('driver_of_the_day', 'Piloto del Día')}
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between mt-4 sm:mt-6 gap-2">
                    <button
                      onClick={prevModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition text-sm sm:text-base"
                    >
                      Anterior
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={nextModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base"
                    >
                      Siguiente
                    </motion.button>
                  </div>
                  {errors.length > 0 && (
                    <div className="text-red-400 text-center mt-4 font-exo2 space-y-2 text-sm sm:text-base">
                      {errors.map((error, idx) => (
                        <p key={idx}>{error}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
            {activeModal === 'micro' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={closeModal}
              >
                <motion.div
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-black to-gray-900 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full bg-gray-800 rounded-full h-1 mb-4 relative overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-amber-500 to-cyan-500 h-1 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-gray-400 font-exo2 text-sm">
                      Paso 4 de 5: {steps[3].label}
                    </span>
                    <span className="ml-2 text-gray-400"></span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-yellow-400 mb-2 font-exo2 text-center">{steps[3].label}</h2>
                  <p className="text-gray-400 text-center mb-4 font-exo2 text-sm">{instructions.micro}</p>
                  <div className="space-y-4">
                    {renderPredictionField('first_team_to_pit', 'Primer Equipo en Pits')}
                    {renderPredictionField('first_retirement', 'Primer Retiro')}
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between mt-4 sm:mt-6 gap-2">
                    <button
                      onClick={prevModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition text-sm sm:text-base"
                    >
                      Anterior
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={nextModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base"
                    >
                      Revisar y Enviar
                    </motion.button>
                  </div>
                  {errors.length > 0 && (
                    <div className="text-red-400 text-center mt-4 font-exo2 space-y-2 text-sm sm:text-base">
                      {errors.map((error, idx) => (
                        <p key={idx}>{error}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
            {activeModal === 'review' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={closeModal}
              >
                <motion.div
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-black to-gray-900 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full bg-gray-800 rounded-full h-1 mb-4 relative overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-amber-500 to-cyan-500 h-1 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-gray-400 font-exo2 text-sm">
                      Paso 5 de 5: {steps[4].label}
                    </span>
                    <span className="ml-2 text-gray-400"></span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-2 font-exo2 text-center">{steps[4].label}</h2>
                  <p className="text-gray-400 text-center mb-4 font-exo2 text-sm">{instructions.review}</p>
                  <div className="space-y-4 text-sm sm:text-base">
                    <motion.div
                      onClick={() => setActiveModal('pole')}
                      className="cursor-pointer hover:bg-gray-800 p-2 rounded"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-base sm:text-lg font-semibold text-amber-400 font-exo2">Posiciones de Pole</h3>
                      <p className="text-gray-300 font-exo2">1: {predictions.pole1 || 'No seleccionado'}</p>
                      <p className="text-gray-300 font-exo2">2: {predictions.pole2 || 'No seleccionado'}</p>
                      <p className="text-gray-300 font-exo2">3: {predictions.pole3 || 'No seleccionado'}</p>
                    </motion.div>
                    <motion.div
                      onClick={() => setActiveModal('gp')}
                      className="cursor-pointer hover:bg-gray-800 p-2 rounded"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-base sm:text-lg font-semibold text-cyan-400 font-exo2">Posiciones de GP</h3>
                      <p className="text-gray-300 font-exo2">1: {predictions.gp1 || 'No seleccionado'}</p>
                      <p className="text-gray-300 font-exo2">2: {predictions.gp2 || 'No seleccionado'}</p>
                      <p className="text-gray-300 font-exo2">3: {predictions.gp3 || 'No seleccionado'}</p>
                    </motion.div>
                    <motion.div
                      onClick={() => setActiveModal('extras')}
                      className="cursor-pointer hover:bg-gray-800 p-2 rounded"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-base sm:text-lg font-semibold text-purple-400 font-exo2">Predicciones Adicionales</h3>
                      <p className="text-gray-300 font-exo2">Pit Stop Más Rápido: {predictions.fastest_pit_stop_team || 'No seleccionado'}</p>
                      <p className="text-gray-300 font-exo2">Vuelta Más Rápida: {predictions.fastest_lap_driver || 'No seleccionado'}</p>
                      <p className="text-gray-300 font-exo2">Piloto del Día: {predictions.driver_of_the_day || 'No seleccionado'}</p>
                    </motion.div>
                    <motion.div
                      onClick={() => setActiveModal('micro')}
                      className="cursor-pointer hover:bg-gray-800 p-2 rounded"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-base sm:text-lg font-semibold text-yellow-400 font-exo2">Micro-Predicciones</h3>
                      <p className="text-gray-300 font-exo2">Primer Equipo en Pits: {predictions.first_team_to_pit || 'No seleccionado'}</p>
                      <p className="text-gray-300 font-exo2">Primer Retiro: {predictions.first_retirement || 'No seleccionado'}</p>
                    </motion.div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between mt-4 sm:mt-6 gap-2">
                    <button
                      onClick={prevModal}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition text-sm sm:text-base"
                    >
                      Anterior
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSubmit}
                      disabled={submitting || submitted}
                      className={`w-full sm:w-auto px-4 py-2 bg-gray-900 text-cyan-400 border border-cyan-400/50 rounded-lg font-exo2 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-all duration-300 text-sm sm:text-base ${
                        submitting || submitted ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {submitting ? 'Enviando...' : submitted ? 'Enviadas' : 'Enviar Predicciones'}
                    </motion.button>
                  </div>
                  {errors.length > 0 && (
                    <div className="text-red-400 text-center mt-4 font-exo2 space-y-2 text-sm sm:text-base">
                      {errors.map((error, idx) => (
                        <p key={idx}>{error}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
            {activeModal === 'share' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={closeModal}
              >
                <motion.div
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-black to-gray-900 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">Predicciones Enviadas</h2>
                  <div className="text-center">
                    <p className="text-gray-300 mb-4 font-exo2 text-sm sm:text-base">¡Tus predicciones han sido enviadas exitosamente!</p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="mt-4 w-full px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition text-sm sm:text-base"
                  >
                    Cerrar
                  </button>
                  {errors.length > 0 && (
                    <div className="text-red-400 text-center mt-4 font-exo2 space-y-2 text-sm sm:text-base">
                      {errors.map((error, idx) => (
                        <p key={idx}>{error}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
            {activeStandingsModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={() => setActiveStandingsModal(null)}
              >
                <motion.div
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-black to-gray-900 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={() => setActiveStandingsModal(null)}
                      className="text-gray-400 hover:text-amber-400 transition"
                    >
                      ✕
                    </button>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">
                    {activeStandingsModal === 'drivers' ? 'Clasificación Completa de Pilotos' : 'Clasificación Completa de Constructores'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-white font-exo2 text-xs sm:text-sm table-fixed">
                      <thead>
                        <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                          <th className="p-1 sm:p-2 text-left w-12">Pos.</th>
                          <th className="p-1 sm:p-2 text-left">{activeStandingsModal === 'drivers' ? 'Piloto' : 'Constructor'}</th>
                          <th className="p-1 sm:p-2 text-right w-16">Pts</th>
                          <th className="p-1 sm:p-2 text-center w-16">Evo.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeStandingsModal === 'drivers' ? driverStandings : constructorStandings).map((standing, index) => {
                          const name = 'driver' in standing ? standing.driver : standing.constructor;
                          const teamName = 'driver' in standing ? driverToTeam[name] : name;
                          const team = teams.find((team) => team.name === teamName);
                          return (
                            <motion.tr
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.5, delay: index * 0.05 }}
                              className="border-b border-amber-500/20 hover:bg-blue-800/50 transition-all duration-200"
                            >
                              <td className="p-1 sm:p-2 text-amber-400 font-bold">{standing.position}</td>
                              <td className="p-1 sm:p-2 flex items-center gap-1 sm:gap-2 truncate">
                                <Image
                                  src={team?.logo_url || '/images/team-logos/default-team.png'}
                                  alt={`${teamName || 'Equipo'} logo`}
                                  width={32}
                                  height={32}
                                  className="object-contain w-8 h-8 transition-transform duration-200 hover:scale-110"
                                />
                                <span className="text-white text-sm">{name}</span>
                              </td>
                              <td className="p-1 sm:p-2 text-right text-gray-300">{standing.points}</td>
                              <td
                                className={`p-1 sm:p-2 text-center ${
                                  standing.evolution.startsWith('↑')
                                    ? 'text-green-400'
                                    : standing.evolution.startsWith('↓')
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                                }`}
                              >
                                {standing.evolution}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => setActiveStandingsModal(null)}
                    className="mt-4 w-full px-4 py-2 bg-gray-800 text-white rounded-lg font-exo2 hover:bg-gray-700 hover:text-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition text-sm sm:text-base"
                  >
                    Cerrar
                  </button>
                </motion.div>
              </motion.div>
            )}
            {renderSelectionModal()}
          </AnimatePresence>
        </main>
      )}
    </div>
  );
}