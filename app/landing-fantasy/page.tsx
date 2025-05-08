// app/landing-fantasy/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { createAuthClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';

type GpSchedule = {
  gp_name: string;
  qualy_time: string;
  race_time: string;
};

type LeaderboardEntry = {
  user_id: string;
  name: string;
  score: number;
};

export default function LandingFantasy() {
  const { isSignedIn, getToken } = useAuth();
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [qualyCountdown, setQualyCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [raceCountdown, setRaceCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [gpSchedule, setGpSchedule] = useState<GpSchedule[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Determine if the device is mobile based on window width
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createAuthClient('');
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('gp_schedule')
        .select('gp_name, qualy_time, race_time')
        .order('race_time', { ascending: true });

      if (scheduleError) {
        console.error('Error fetching gp_schedule:', scheduleError);
        setError('No se pudo cargar el calendario de GPs.');
        return;
      }

      setGpSchedule(scheduleData || []);
      const now = new Date();
      let foundCurrent = false;
      for (let i = 0; i < scheduleData.length; i++) {
        const raceDate = new Date(scheduleData[i].race_time);
        if (now <= raceDate) {
          setCurrentGp(scheduleData[i]);
          foundCurrent = true;
          break;
        }
      }
      if (!foundCurrent && scheduleData.length > 0) {
        setCurrentGp(null);
      }

      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('leaderboard')
        .select('user_id, name, score')
        .order('score', { ascending: false })
        .limit(3);

      if (leaderboardError) {
        console.error('Error fetching leaderboard:', leaderboardError);
      } else {
        setLeaderboard(leaderboardData || []);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!currentGp || !gpSchedule.length) return;

    const updateCountdown = () => {
      const now = new Date();
      const qualyDate = new Date(currentGp.qualy_time);
      const raceDate = new Date(currentGp.race_time);

      const qualyDiff = qualyDate.getTime() - now.getTime();
      if (qualyDiff <= 0 && raceDate.getTime() > now.getTime()) {
        setQualyCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else if (qualyDiff > 0) {
        const days = Math.floor(qualyDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((qualyDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((qualyDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((qualyDiff % (1000 * 60)) / 1000);
        setQualyCountdown({ days, hours, minutes, seconds });
      }

      const raceDiff = raceDate.getTime() - now.getTime();
      if (raceDiff <= 0) {
        const currentIndex = gpSchedule.findIndex(gp => gp.gp_name === currentGp.gp_name);
        if (currentIndex < gpSchedule.length - 1) {
          setCurrentGp(gpSchedule[currentIndex + 1]);
        } else {
          setCurrentGp(null);
        }
        setRaceCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(raceDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((raceDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((raceDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((raceDiff % (1000 * 60)) / 1000);
        setRaceCountdown({ days, hours, minutes, seconds });
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [currentGp, gpSchedule]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white overflow-hidden">
      <Header />

      {/* Hero Section with Foreground Image */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative w-full h-screen"
      >
        <div className="relative w-full h-full">
          <Image
            src={isMobile ? '/images/fantasy-hero-mobile.png' : '/images/fantasy-hero-desktop.png'}
            alt="MMC Fantasy F1 Hero"
            fill
            className="object-cover w-full h-full object-center"
            priority
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6"
            >
              <Link href="/sign-up">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(251, 191, 36, 0.7)' }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-amber-400 text-gray-900 px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg font-exo2 hover:bg-amber-500 transition-all shadow-md"
                >
                  ¡Regístrate Ahora!
                </motion.button>
              </Link>
              {isSignedIn ? (
                <Link href="/fantasy">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(21, 94, 117, 0.7)' }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-cyan-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg font-exo2 hover:bg-cyan-700 transition-all shadow-md"
                  >
                    Jugar Ahora
                  </motion.button>
                </Link>
              ) : (
                <Link href="/sign-in">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(21, 94, 117, 0.7)' }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-cyan-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg font-exo2 hover:bg-cyan-700 transition-all shadow-md"
                  >
                    Inicia Sesión
                  </motion.button>
                </Link>
              )}
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Countdown & Circuit */}
      {currentGp && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-5xl mx-auto mb-16 px-4 sm:px-6 lg:px-8 relative"
        >
          <div className="absolute inset-0 bg-[url('/images/checkered-pattern.png')] bg-repeat opacity-10" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-6 text-center font-exo2">
              {currentGp.gp_name} - ¡El Tiempo Corre!
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gray-900/80 p-6 rounded-xl border border-amber-500/30 backdrop-blur-sm text-center"
              >
                <p className="text-amber-400 font-semibold text-lg font-exo2">Qualy</p>
                <div className="text-white font-mono text-2xl">
                  {`${qualyCountdown.days}d ${qualyCountdown.hours}h ${qualyCountdown.minutes}m ${qualyCountdown.seconds}s`}
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gray-900/80 p-6 rounded-xl border border-cyan-500/30 backdrop-blur-sm text-center"
              >
                <p className="text-cyan-400 font-semibold text-lg font-exo2">Carrera</p>
                <div className="text-white font-mono text-2xl">
                  {`${raceCountdown.days}d ${raceCountdown.hours}h ${raceCountdown.minutes}m ${raceCountdown.seconds}s`}
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gray-900/80 p-6 rounded-xl border border-purple-500/30 backdrop-blur-sm text-center"
              >
                <p className="text-purple-400 font-semibold text-lg font-exo2">Fecha</p>
                <div className="text-white font-mono text-2xl">
                  {new Date(currentGp.race_time).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                </div>
              </motion.div>
            </div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative"
            >
              <Image
                src={`/images/circuits/${currentGp.gp_name.toLowerCase().replace(/\s+/g, '-')}-circuit.png`}
                alt={`${currentGp.gp_name} Circuit`}
                width={1200}
                height={600}
                className="rounded-xl shadow-lg mx-auto border border-amber-500/30"
              />
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* Leaderboard Preview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="max-w-5xl mx-auto mb-16 px-4 sm:px-6 lg:px-8"
      >
        <h2 className="text-3xl font-bold text-white mb-8 text-center font-exo2">
          Líderes Actuales
        </h2>
        <div className="bg-gray-900/80 p-6 rounded-xl border border-amber-500/30 backdrop-blur-sm">
          {leaderboard.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {leaderboard.map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(245, 158, 11, 0.5)' }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`p-4 rounded-lg flex justify-between items-center ${
                    index === 0 ? 'bg-amber-600/30' : index === 1 ? 'bg-amber-500/30' : 'bg-amber-400/30'
                  }`}
                >
                  <span className="font-semibold text-white flex items-center">
                    {index === 0 && <span className="mr-2 text-amber-400">🥇</span>}
                    {index === 1 && <span className="mr-2 text-amber-400">🥈</span>}
                    {index === 2 && <span className="mr-2 text-amber-400">🥉</span>}
                    {entry.name}
                  </span>
                  <span className="text-amber-400 font-bold">{entry.score} pts</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center font-exo2">Aún no hay líderes. ¡Sé el primero!</p>
          )}
        </div>
      </motion.section>

      {/* Game Features */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="max-w-5xl mx-auto mb-16 px-4 sm:px-6 lg:px-8"
      >
        <h2 className="text-3xl font-bold text-white mb-8 text-center font-exo2">
          ¿Por Qué Jugar MMC Fantasy F1?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              title: 'Predicciones Detalladas',
              desc: 'Elige pole, podio, pit stop más rápido, vuelta rápida y piloto del día.',
              img: '/images/pilots/charles-leclerc.png',
            },
            {
              title: 'Compite en Tiempo Real',
              desc: 'Sigue las carreras y sube en la tabla con cada GP.',
              img: '/images/liveries/ferrari-livery.png',
            },
            {
              title: 'Premios Exclusivos',
              desc: 'Gana desde merchandise hasta experiencias VIP.',
              img: '/images/merch.png',
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(34, 211, 238, 0.5)' }}
              className="bg-gray-900/80 p-6 rounded-xl border border-amber-500/30 backdrop-blur-sm text-center"
            >
              <div className="relative w-32 h-32 mx-auto mb-4">
                <Image
                  src={feature.img}
                  alt={feature.title}
                  fill
                  className="object-contain rounded-full"
                />
              </div>
              <h3 className="text-xl font-semibold text-amber-400 font-exo2">{feature.title}</h3>
              <p className="text-gray-300 font-exo2">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Future MMC Games Teaser */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="max-w-5xl mx-auto mb-16 px-4 sm:px-6 lg:px-8"
      >
        <h2 className="text-3xl font-bold text-white mb-8 text-center font-exo2">
          Próximamente en MMC Fantasy
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {[
            {
              title: 'MotoGP Fantasy',
              desc: 'Pronostica los mejores pilotos y equipos en el mundo de MotoGP. ¡Próximamente!',
              img: '/images/motogp-teaser.png',
            },
            {
              title: 'WEC Fantasy',
              desc: 'Compite en las carreras de resistencia más emocionantes. ¡Próximamente!',
              img: '/images/wec-teaser.png',
            },
          ].map((game, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(245, 158, 11, 0.5)' }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="bg-gray-900/80 p-6 rounded-xl border border-amber-500/30 backdrop-blur-sm text-center"
            >
              <Image src={game.img} alt={game.title} width={200} height={200} className="mx-auto mb-4 rounded-lg" />
              <h3 className="text-xl font-semibold text-amber-400 font-exo2">{game.title}</h3>
              <p className="text-gray-300 font-exo2">{game.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA Footer */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="max-w-5xl mx-auto text-center py-16 px-4 sm:px-6 lg:px-8 bg-gray-800/50 rounded-xl border border-amber-500/30 backdrop-blur-sm mb-12"
      >
        <h2 className="text-4xl font-bold text-white mb-6 font-exo2">
          ¡Arranca tu Aventura en MMC Fantasy!
        </h2>
        <p className="text-xl text-gray-200 mb-8 font-exo2">
          Regístrate hoy y únete a la comunidad de fanáticos del automovilismo.
        </p>
        <Link href="/sign-up">
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(34, 211, 238, 0.7)' }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-10 py-4 rounded-full font-semibold text-xl font-exo2 hover:from-amber-600 hover:to-cyan-600 transition-all animate-pulse"
          >
            ¡Únete Ahora!
          </motion.button>
        </Link>
      </motion.section>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-400 text-center font-exo2 mb-8"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}