/* ───────── components/StickyAccessCTA.tsx ───────── */
'use client';

import { useEffect, useRef, useState, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StickyAccessCTA() {
  const heroBtnRef = useRef<HTMLButtonElement | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [inPlanes, setInPlanes] = useState(false);

  /* 1️⃣ Observa si el botón del hero sale/entra del viewport */
  useEffect(() => {
    const btn = heroBtnRef.current;
    if (!btn) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(btn);
    return () => obs.disconnect();
  }, []);

  /* 2️⃣ Observa si la sección #planes está visible */
  useEffect(() => {
    const section = document.getElementById('planes');
    if (!section) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInPlanes(entry.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, []);

  /* 3️⃣ Scroll suave al ancla */
  function handleScroll(e: MouseEvent) {
    e.preventDefault();
    document
      .getElementById('planes')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const btnClasses =
    'relative inline-flex w-full items-center justify-center px-10 py-5 rounded-2xl ' +
    'bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-lg ' +
    'shadow-2xl border border-red-400/30 overflow-hidden group';

  return (
    <>
      {/* ───── BOTÓN ORIGINAL EN EL HERO ───── */}
      <motion.div
        className="w-full max-w-md mx-auto lg:mx-0"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.4 }}
      >
        <button
          ref={heroBtnRef}
          onClick={handleScroll}
          className={btnClasses}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 blur opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
          <span className="relative flex items-center gap-2">
            🚀 ACCEDER
            <svg
              className="w-5 h-5 group-hover:translate-x-1 transition-transform"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>
      </motion.div>

      {/* ───── BANNER STICKY ───── */}
      <AnimatePresence>
        {showSticky && !inPlanes && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="fixed bottom-4 left-0 right-0 z-50 px-4 sm:px-6"
          >
            <button onClick={handleScroll} className={btnClasses}>
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 blur opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2">
                🚀 ACCEDER
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}