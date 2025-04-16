'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function AuthRequiredModal({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white text-black rounded-xl p-6 shadow-xl w-[90%] max-w-sm text-center"
        >
          <h2 className="text-xl font-bold mb-2">Acceso restringido</h2>
          <p className="text-sm mb-4">Debes iniciar sesión o registrarte para usar MMC GO.</p>

          <div className="flex justify-center gap-4">
            <Link href="/sign-in" className="bg-black text-white px-4 py-2 rounded hover:bg-gray-900">
              Iniciar sesión
            </Link>
            <Link href="/sign-up" className="bg-amber-500 px-4 py-2 rounded hover:bg-amber-400 text-black font-bold">
              Registrarse
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}