// /Users/imgabrieltoro/Projects/motormania/components/CoinsExplainModal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';

// Rename the Props interface
interface CoinsExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

// Rename the component export
export const CoinsExplainModal: React.FC<CoinsExplainModalProps> = ({ isOpen, onClose, title, children }) => {
  // Handle Escape key press
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            key="modal-content"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, duration: 0.2 }}
            className="relative bg-gradient-to-br from-gray-800 to-black text-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto border border-amber-500/30"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="Cerrar modal"
              className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10 p-1 rounded-full hover:bg-white/10"
            >
              <FaTimes size={20} />
            </button>
            <div className="p-6 pt-8 sm:p-8">
              {title && (
                <h2 className="text-xl sm:text-2xl font-bold mb-5 text-amber-400 text-center">
                  {title}
                </h2>
              )}
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};