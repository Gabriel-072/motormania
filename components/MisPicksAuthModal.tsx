// components/MisPicksAuthModal.tsx
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaWallet, FaUserPlus, FaRocket, FaTrophy } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { trackFBEvent } from '@/lib/trackFBEvent';

interface MisPicksAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MisPicksAuthModal({ isOpen, onClose }: MisPicksAuthModalProps) {
  const router = useRouter();

  const handleMakePicks = () => {
    // Track engagement
    trackFBEvent('MisPicksRedirectToPicks', {
      params: {
        action: 'make_picks_first',
        source: 'auth_modal'
      }
    });

    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Lead', {
        content_category: 'pick_making_engagement'
      });
    }

    onClose();
    // Scroll to picks area or trigger picks flow
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleRegister = () => {
    // Track direct signup
    trackFBEvent('MisPicksRedirectToSignup', {
      params: {
        action: 'direct_signup',
        source: 'auth_modal'
      }
    });

    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'CompleteRegistration', {
        content_category: 'mis_picks_signup'
      });
    }

    const currentUrl = window.location.pathname + window.location.search;
    router.push(`/sign-up?redirect_url=${encodeURIComponent(currentUrl)}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-amber-500/30 shadow-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <FaWallet className="text-amber-400" size={24} />
                <h3 className="text-xl font-bold text-white">MIS PICKS</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="mb-6 space-y-4">
              <div className="text-center">
                <h4 className="text-lg font-semibold text-amber-400 mb-2">
                  ¡Crea una cuenta para ver tus picks!
                </h4>
                <p className="text-gray-300 text-sm leading-relaxed">
                  En "MIS PICKS" puedes ver todos tus pronósticos activos, historial de ganancias y gestionar tu saldo.
                </p>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 text-gray-300">
                  <FaTrophy className="text-yellow-400" />
                  <span>Historial de ganancias</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaWallet className="text-green-400" />
                  <span>Gestión de saldo</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaRocket className="text-blue-400" />
                  <span>Picks activos</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaTrophy className="text-purple-400" />
                  <span>Estadísticas</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Make Picks First */}
              <button
                onClick={handleMakePicks}
                className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg transition-all group font-semibold"
              >
                <FaRocket className="text-xl text-blue-100 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="text-white">Hacer Picks Gratis</div>
                  <div className="text-xs text-blue-100">Primero elige tus pronósticos</div>
                </div>
              </button>

              {/* Direct Registration */}
              <button
                onClick={handleRegister}
                className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-lg transition-all group font-semibold"
              >
                <FaUserPlus className="text-xl text-amber-100 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="text-white">Registrarse Ahora</div>
                  <div className="text-xs text-amber-100">Acceso completo al dashboard</div>
                </div>
              </button>
            </div>

            {/* Footer note */}
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <p className="text-xs text-gray-400 text-center">
                🎁 Registro gratis • Sin tarjeta de crédito requerida
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}