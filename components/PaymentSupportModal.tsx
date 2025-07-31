// components/PaymentSupportModal.tsx
'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaEnvelope, FaTelegram, FaExclamationTriangle } from 'react-icons/fa';

interface PaymentSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage?: string;
}

const SUPPORT_SHOWN_KEY = 'mmc_support_modal_shown';

export function PaymentSupportModal({ isOpen, onClose, errorMessage }: PaymentSupportModalProps) {
  
  // Check if support has been shown this session
  const shouldShow = () => {
    if (typeof window === 'undefined') return false;
    const hasBeenShown = sessionStorage.getItem(SUPPORT_SHOWN_KEY);
    return !hasBeenShown;
  };

  // Mark support as shown and close
  const handleClose = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SUPPORT_SHOWN_KEY, 'true');
    }
    onClose();
  };

  // Don't show if already shown this session
  if (!shouldShow() && isOpen) {
    onClose();
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-red-700/50 shadow-xl"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <FaExclamationTriangle className="text-red-400" size={20} />
                <h3 className="text-xl font-bold text-white">¿Problemas con el pago?</h3>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white p-1"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {/* Error message if provided */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                <p className="text-red-300 text-sm">{errorMessage}</p>
              </div>
            )}

            {/* Content */}
            <div className="mb-6">
              <p className="text-gray-300 mb-4">
                No te preocupes, estamos aquí para ayudarte. Contáctanos y resolveremos tu problema de inmediato.
              </p>
            </div>

            {/* Contact Options */}
            <div className="space-y-3">
              {/* Email Support */}
              <a
                href="mailto:soporte@motormania.app?subject=Problema%20con%20pago%20MMC%20GO"
                className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg transition-all group"
              >
                <FaEnvelope className="text-2xl text-blue-100 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="font-semibold text-white">Email Soporte</div>
                  <div className="text-sm text-blue-100">soporte@motormania.app</div>
                </div>
              </a>

              {/* Telegram Support */}
              <a
                href="https://t.me/+573009290499"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-lg transition-all group"
              >
                <FaTelegram className="text-2xl text-cyan-100 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="font-semibold text-white">Telegram</div>
                  <div className="text-sm text-cyan-100">+57 300 929 0499</div>
                </div>
              </a>
            </div>

            {/* Additional info */}
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <p className="text-xs text-gray-400 text-center">
                📞 Horario de atención: Lunes a Viernes 9AM - 6PM COT
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="w-full mt-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cerrar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}