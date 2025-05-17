// 📁 components/MMCGoSubHeader.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaWallet, FaQuestionCircle } from 'react-icons/fa';

type Props = {
  /** Callback que abre el tutorial; pásalo desde tu componente padre */
  onOpenTutorial: () => void;
};

export default function MMCGoSubHeader({ onOpenTutorial }: Props) {
  const router = useRouter();

  return (
    <AnimatePresence>
      <motion.div
        key="subHeader"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-4
                   bg-gradient-to-br from-gray-950 via-black to-gray-800
                   border-b border-amber-600/25 px-4 py-2 text-xs sm:text-sm font-exo2"
      >
        {/* Botón RECARGA YA */}
        <button
          onClick={() => router.push('/wallet')}
          className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 font-bold
                     text-black hover:bg-amber-400 hover:scale-105 active:scale-95
                     transition shadow-xl"
        >
          <FaWallet className="h-4 w-4" />
          RECARGA&nbsp;YA
        </button>

        {/* Botón ¿CÓMO JUGAR? */}
        <button
          onClick={onOpenTutorial}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500
                     px-4 py-2 font-bold text-black hover:scale-105 active:scale-95
                     transition shadow-xl"
        >
          <FaQuestionCircle className="h-4 w-4" />
          ¿CÓMO&nbsp;JUGAR?
        </button>
      </motion.div>
    </AnimatePresence>
  );
}