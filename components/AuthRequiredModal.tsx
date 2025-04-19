'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';

export default function AuthRequiredModal({ show }: { show: boolean }) {
  const searchParams = useSearchParams();
  const [isChecked, setIsChecked] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('/mmc-go');

  // useMemo para evitar re-render innecesario
  useEffect(() => {
    if (searchParams) {
      const raw = searchParams.toString();
      setRedirectUrl(raw ? `/mmc-go?${raw}` : '/mmc-go');
    }
  }, [searchParams]);

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

          <div className="mb-4">
            <label className="flex items-center justify-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="h-4 w-4 text-amber-500 focus:ring-amber-500 border-gray-300 rounded"
              />
              <span>
                Al continuar, aceptas que tienes 18 años o más y aceptas la{' '}
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500 hover:underline font-bold"
                >
                  política de tratamiento de datos
                </a>{' '}
                de MMC.
              </span>
            </label>
          </div>

          <div className="flex justify-center gap-4">
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
              className={`px-4 py-2 rounded text-white font-bold transition-colors ${
                isChecked ? 'bg-black hover:bg-gray-900' : 'bg-gray-400 cursor-not-allowed'
              }`}
              style={{ pointerEvents: isChecked ? 'auto' : 'none' }}
            >
              Iniciar sesión
            </Link>
            <Link
              href={`/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}
              className={`px-4 py-2 rounded text-black font-bold transition-colors ${
                isChecked ? 'bg-amber-500 hover:bg-amber-400' : 'bg-gray-400 cursor-not-allowed'
              }`}
              style={{ pointerEvents: isChecked ? 'auto' : 'none' }}
            >
              Registrarse
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}