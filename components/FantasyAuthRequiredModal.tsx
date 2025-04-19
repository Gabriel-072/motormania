'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Howl } from 'howler';

// SECTION: Sound Manager
const soundManager = {
  click: new Howl({ src: ['/sounds/f1-click.mp3'], volume: 0.2 }),
  openMenu: new Howl({ src: ['/sounds/f1-open-menu.wav'], volume: 0.5 }),
};

// SECTION: Animation Variants
const modalVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export default function FantasyAuthRequiredModal({ show }: { show: boolean }) {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.size > 0 ? `/jugar-y-gana?${searchParams.toString()}` : '/jugar-y-gana';
  const [isChecked, setIsChecked] = useState(true); // Pre-select checkbox

  // Play sound when modal opens
  if (show) {
    soundManager.openMenu.play();
  }

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          className="animate-rotate-border rounded-xl p-px"
          style={{
            background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #d4af37 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`,
            animationDuration: '4s',
          }}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 sm:p-8 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-md text-center font-exo2"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-amber-400 mb-3">¡Únete a la Acción!</h2>
            <p className="text-gray-300 text-sm sm:text-base mb-6">
              Inicia sesión o regístrate para disfrutar de F1 Fantasy, hacer tus predicciones y competir por increíbles premios.
            </p>

            <div className="mb-6">
              <label className="flex items-start justify-center gap-2 text-sm sm:text-base text-gray-300">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    setIsChecked(e.target.checked);
                    soundManager.click.play();
                  }}
                  className="mt-1 h-4 w-4 text-amber-500 focus:ring-amber-500 border-gray-500 rounded cursor-pointer"
                  aria-label="Aceptar política de privacidad"
                />
                <span>
                  Acepto la{' '}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                  >
                    política de privacidad
                  </a>{' '}
                  de MMC.
                </span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
                onClick={() => soundManager.click.play()}
                className={`px-4 py-2 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
                  isChecked
                    ? 'bg-gray-900 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(34,211,238,0.7)]'
                    : 'bg-gray-700 border border-gray-500/30 text-gray-400 cursor-not-allowed'
                }`}
                style={{ pointerEvents: isChecked ? 'auto' : 'none' }}
                aria-disabled={!isChecked}
              >
                Iniciar Sesión
              </Link>
              <Link
                href={`/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}
                onClick={() => soundManager.click.play()}
                className={`px-4 py-2 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
                  isChecked
                    ? 'bg-amber-500 text-black hover:bg-amber-400 hover:shadow-[0_0_10px_rgba(251,191,36,0.7)]'
                    : 'bg-gray-700 border border-gray-500/30 text-gray-400 cursor-not-allowed'
                }`}
                style={{ pointerEvents: isChecked ? 'auto' : 'none' }}
                aria-disabled={!isChecked}
              >
                Registrarse
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}