'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export default function TutorialModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl p-4 max-w-md w-full relative overflow-hidden shadow-2xl"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-black/50 hover:text-black text-sm"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-center mb-3">¿Cómo se juega?</h2>

            <video
              src="/tutorial.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="rounded-lg w-full aspect-video"
            />

            <p className="text-sm text-gray-600 mt-4 text-center">
              Aprende a hacer picks, apostar con monedas y ganar Fuel Coins. 
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}