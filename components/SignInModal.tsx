// components/SignInModal.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface SignInModalProps {
  onClose: () => void;
}

export default function SignInModal({ onClose }: SignInModalProps) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);

  const handleSignIn = () => {
    router.push('/sign-in'); // Redirect to sign-in page
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300); // Match animation duration
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-[90vw] sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-4 font-exo2 text-center">
          Inicia sesión en MMC Fantasy
        </h2>
        <p className="text-gray-300 text-center mb-6 font-exo2">
          Debes iniciar sesión para enviar tus predicciones en MMC Fantasy.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={handleSignIn}
            className="px-4 py-2 bg-amber-500 text-black rounded-lg font-exo2 hover:bg-amber-400 transition text-sm sm:text-base"
          >
            Iniciar sesión
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg font-exo2 hover:bg-gray-600 transition text-sm sm:text-base"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}