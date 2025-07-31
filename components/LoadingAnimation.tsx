// components/LoadingAnimation.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';

interface LoadingAnimationProps {
  text?: string;
  animationDuration?: number;
  stage?: 'auth' | 'data' | 'drivers' | 'complete';
  showSkeleton?: boolean;
}

const DriverCardSkeleton = () => (
  <div className="bg-gray-800/50 rounded-xl p-4 animate-pulse border border-gray-700/30">
    <div className="w-12 h-12 bg-gray-700 rounded-full mx-auto mb-3"></div>
    <div className="h-4 bg-gray-700 rounded w-3/4 mx-auto mb-2"></div>
    <div className="h-3 bg-gray-700 rounded w-1/2 mx-auto mb-2"></div>
    <div className="h-6 bg-gray-700 rounded w-full mx-auto"></div>
  </div>
);

const LoadingDots = () => (
  <div className="flex gap-1 justify-center mt-3">
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        className="w-2 h-2 bg-amber-500 rounded-full"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: i * 0.15,
        }}
      />
    ))}
  </div>
);

const ProgressBar = ({ progress }: { progress: number }) => (
  <div className="w-full max-w-xs bg-gray-800 rounded-full h-2 mt-4">
    <motion.div
      className="bg-gradient-to-r from-amber-500 to-cyan-500 h-2 rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    />
  </div>
);

export default function LoadingAnimation({
  text = '¡Preparando la pista...',
  animationDuration = 3,
  stage = 'auth',
  showSkeleton = false,
}: LoadingAnimationProps) {
  const [currentProgress, setCurrentProgress] = useState(0);
  const [displayText, setDisplayText] = useState(text);

  // Update progress and text based on stage
  useEffect(() => {
    const stageConfig = {
      auth: { progress: 25, text: '🔐 Verificando acceso...' },
      data: { progress: 50, text: '📡 Cargando datos en tiempo real...' },
      drivers: { progress: 75, text: '🏎️ Preparando pilotos...' },
      complete: { progress: 100, text: '✅ ¡Listo para apostar!' }
    };

    const config = stageConfig[stage];
    setCurrentProgress(config.progress);
    setDisplayText(text || config.text);
  }, [stage, text]);

  return (
    <>
      <Head>
        <style>{`
          .f1-spinner {
            background: conic-gradient(from 0deg, #f59e0b, #06b6d4, #f59e0b);
            width: 80px;
            height: 80px;
            border-radius: 50%;
            position: relative;
            animation: f1-spin 1.5s linear infinite;
            box-shadow: 
              0 0 20px rgba(245, 158, 11, 0.5),
              0 0 40px rgba(6, 182, 212, 0.3);
          }
          
          .f1-spinner::before {
            content: '';
            position: absolute;
            top: 3px;
            left: 3px;
            right: 3px;
            bottom: 3px;
            background: #111827;
            border-radius: 50%;
          }
          
          .f1-spinner::after {
            content: '🏎️';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 24px;
            z-index: 1;
          }
          
          @keyframes f1-spin {
            to { transform: rotate(360deg); }
          }
          
          .pulse-glow {
            animation: pulse-glow 2s ease-in-out infinite;
          }
          
          @keyframes pulse-glow {
            0%, 100% { 
              opacity: 1;
              text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
            }
            50% { 
              opacity: 0.8;
              text-shadow: 0 0 20px rgba(245, 158, 11, 0.8);
            }
          }
          
          .skeleton-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 1rem;
            max-width: 800px;
            width: 100%;
          }
        `}</style>
      </Head>

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] px-4">
        <AnimatePresence mode="wait">
          {!showSkeleton ? (
            <motion.div
              key="spinner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center justify-center"
            >
              {/* Enhanced F1-themed spinner */}
              <div className="f1-spinner mb-6"></div>

              {/* Dynamic text with animation */}
              <motion.p
                key={displayText}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-amber-400 text-xl font-exo2 font-semibold text-center pulse-glow"
              >
                {displayText}
              </motion.p>

              {/* Loading dots */}
              <LoadingDots />

              {/* Progress bar */}
              <ProgressBar progress={currentProgress} />

              {/* Stage indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-sm text-gray-400 text-center"
              >
                {stage === 'auth' && '🔄 Conectando con el servidor...'}
                {stage === 'data' && '📊 Sincronizando información...'}
                {stage === 'drivers' && '🎯 Cargando líneas de apuestas...'}
                {stage === 'complete' && '🚀 Iniciando experiencia MMC GO...'}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-6xl"
            >
              {/* Header skeleton */}
              <div className="text-center mb-8">
                <div className="h-8 bg-gray-700 rounded w-64 mx-auto mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-700 rounded w-96 mx-auto animate-pulse"></div>
              </div>

              {/* Driver grid skeleton */}
              <div className="skeleton-grid">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <DriverCardSkeleton />
                  </motion.div>
                ))}
              </div>

              {/* Bottom elements skeleton */}
              <div className="mt-8 flex justify-center">
                <div className="h-12 bg-gray-700 rounded-full w-48 animate-pulse"></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ambient background effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <motion.div
            className="absolute top-1/4 left-1/4 w-32 h-32 bg-amber-500/10 rounded-full blur-xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.6, 0.3, 0.6],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          />
        </div>
      </div>
    </>
  );
}