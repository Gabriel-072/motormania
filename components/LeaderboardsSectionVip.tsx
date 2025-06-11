'use client';

import React from 'react';
import useFantasyLeaderboardsVip from '@/hooks/useFantasyLeaderboardsVip';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrophy, FaMedal, FaFlagCheckered, FaGlobe, FaStar, FaAward } from 'react-icons/fa';

export default function LeaderboardsSectionVip() {
  const {
    globalTop10,
    lastGpTop10,
    lastGpName,
    loading,
    error,
  } = useFantasyLeaderboardsVip();

  if (loading) {
    return (
      <div className="grid gap-4 md:gap-8 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="relative overflow-hidden">
            <div className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl md:rounded-2xl p-4 md:p-8 shadow-2xl">
              <div className="animate-pulse">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-slate-600 rounded"></div>
                  <div className="w-32 md:w-48 h-5 md:h-6 bg-slate-600 rounded"></div>
                </div>
                <div className="space-y-2 md:space-y-4">
                  {[...Array(10)].map((_, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className="w-6 h-6 md:w-8 md:h-8 bg-slate-600 rounded-full"></div>
                        <div className="w-24 md:w-32 h-3 md:h-4 bg-slate-600 rounded"></div>
                      </div>
                      <div className="w-12 md:w-16 h-3 md:h-4 bg-slate-600 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-red-900/20 via-red-800/10 to-red-900/20 backdrop-blur-xl border border-red-500/30 rounded-xl md:rounded-2xl p-4 md:p-8 text-center shadow-2xl"
      >
        <div className="text-red-400 text-4xl md:text-6xl mb-2 md:mb-4">⚠️</div>
        <p className="text-red-300 text-sm md:text-lg font-medium">{error}</p>
      </motion.div>
    );
  }

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <FaTrophy className="text-yellow-400 drop-shadow-lg" />;
      case 2: return <FaMedal className="text-gray-300 drop-shadow-lg" />;
      case 3: return <FaAward className="text-amber-600 drop-shadow-lg" />;
      default: return <FaStar className="text-slate-400" />;
    }
  };

  const getRankColors = (position: number) => {
    switch (position) {
      case 1: return {
        bg: 'from-yellow-500/20 via-amber-500/10 to-yellow-600/20',
        border: 'border-yellow-400/40',
        text: 'text-yellow-300',
        glow: 'shadow-yellow-500/20'
      };
      case 2: return {
        bg: 'from-gray-400/20 via-slate-400/10 to-gray-500/20',
        border: 'border-gray-400/40',
        text: 'text-gray-300',
        glow: 'shadow-gray-500/20'
      };
      case 3: return {
        bg: 'from-amber-600/20 via-orange-600/10 to-amber-700/20',
        border: 'border-amber-600/40',
        text: 'text-amber-300',
        glow: 'shadow-amber-600/20'
      };
      default: return {
        bg: 'from-slate-700/30 via-slate-600/20 to-slate-700/30',
        border: 'border-slate-600/30',
        text: 'text-slate-300',
        glow: 'shadow-slate-600/10'
      };
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12
      }
    }
  };

  const leaderboardItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 20,
        delay: i * 0.05
      }
    })
  };

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid gap-4 md:gap-8 md:grid-cols-2"
    >
      {/* Global Leaderboard */}
      <motion.div
        variants={itemVariants}
        className="relative group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 rounded-2xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl md:rounded-2xl p-4 md:p-8 shadow-2xl hover:shadow-blue-500/10 transition-all duration-500">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 md:gap-4 mb-4 md:mb-8"
          >
            <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg md:rounded-xl shadow-lg">
              <FaGlobe className="text-white text-sm md:text-xl" />
            </div>
            <div>
              <h3 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Leaderboard Global
              </h3>
              <p className="text-slate-400 text-xs md:text-sm hidden md:block">Top 10 mejores pilotos</p>
            </div>
          </motion.div>

          <div className="space-y-2 md:space-y-3">
            <AnimatePresence>
              {globalTop10.map((user, index) => {
                const colors = getRankColors(index + 1);
                return (
                  <motion.div
                    key={user.user_id}
                    custom={index}
                    variants={leaderboardItemVariants}
                    initial="hidden"
                    animate="visible"
                    className={`group/item bg-gradient-to-r ${colors.bg} backdrop-blur-sm border ${colors.border} rounded-lg md:rounded-xl p-2 md:p-4 shadow-lg ${colors.glow} hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex items-center justify-center w-7 h-7 md:w-10 md:h-10 bg-slate-800/50 rounded-full border border-slate-600/50">
                          <span className={`text-xs md:text-sm font-bold ${colors.text}`}>
                            {index + 1}
                          </span>
                        </div>
                        <div className="text-sm md:text-lg md:block hidden">
                          {getRankIcon(index + 1)}
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover/item:text-blue-300 transition-colors text-sm md:text-base">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-400 hidden md:block">
                            {index === 0 ? 'Campeón Mundial' : `Posición ${index + 1}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm md:text-xl font-bold text-white">
                          {user.score.toLocaleString('es-CO')}
                        </p>
                        <p className="text-xs text-slate-400 hidden md:block">puntos</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Last GP Leaderboard */}
      {lastGpName && (
        <motion.div
          variants={itemVariants}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 via-red-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl md:rounded-2xl p-4 md:p-8 shadow-2xl hover:shadow-orange-500/10 transition-all duration-500">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 md:gap-4 mb-4 md:mb-8"
            >
              <div className="p-2 md:p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg md:rounded-xl shadow-lg">
                <FaFlagCheckered className="text-white text-sm md:text-xl" />
              </div>
              <div>
                <h3 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-orange-400 bg-clip-text text-transparent">
                  {lastGpName}
                </h3>
                <p className="text-slate-400 text-xs md:text-sm hidden md:block">Última carrera - Top 10</p>
              </div>
            </motion.div>

            <div className="space-y-2 md:space-y-3">
              <AnimatePresence>
                {lastGpTop10.map((user, index) => {
                  const colors = getRankColors(index + 1);
                  return (
                    <motion.div
                      key={user.user_id}
                      custom={index}
                      variants={leaderboardItemVariants}
                      initial="hidden"
                      animate="visible"
                      className={`group/item bg-gradient-to-r ${colors.bg} backdrop-blur-sm border ${colors.border} rounded-lg md:rounded-xl p-2 md:p-4 shadow-lg ${colors.glow} hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-4">
                          <div className="flex items-center justify-center w-7 h-7 md:w-10 md:h-10 bg-slate-800/50 rounded-full border border-slate-600/50">
                            <span className={`text-xs md:text-sm font-bold ${colors.text}`}>
                              {index + 1}
                            </span>
                          </div>
                          <div className="text-sm md:text-lg md:block hidden">
                            {getRankIcon(index + 1)}
                          </div>
                          <div>
                            <p className="font-semibold text-white group-hover/item:text-orange-300 transition-colors text-sm md:text-base">
                              {user.name}
                            </p>
                            <p className="text-xs text-slate-400 hidden md:block">
                              {index === 0 ? 'Ganador del GP' : `P${index + 1}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm md:text-xl font-bold text-white">
                            {user.score.toLocaleString('es-CO')}
                          </p>
                          <p className="text-xs text-slate-400 hidden md:block">puntos</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}