// ──────────────────────────────────────────────────────────────────────────────
// COMPONENT: BoldCheckoutModal.tsx — MotorManía
// Modal personalizado para abrir el Embedded Checkout de Bold
// ──────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { openBoldCheckout } from '@/lib/bold';

export interface BoldCheckoutModalProps {
  apiKey: string;
  orderId: string;
  amount: number;
  currency: 'COP' | 'USD';
  description: string;
  redirectionUrl: string;
  integritySignature: string;
  customerData?: {
    email?: string;
    fullName?: string;
    phone?: string;
    documentNumber?: string;
    documentType?: string;
  };
  onClose: () => void;
}

export default function BoldCheckoutModal({
  apiKey,
  orderId,
  amount,
  currency,
  description,
  redirectionUrl,
  integritySignature,
  customerData,
  onClose,
}: BoldCheckoutModalProps) {
  useEffect(() => {
    openBoldCheckout({
      apiKey,
      orderId,
      amount,
      currency,
      description,
      redirectionUrl,
      integritySignature,
      customerData,
    });
  }, [apiKey, orderId, amount, currency, description, redirectionUrl, integritySignature, customerData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="bg-gray-900 rounded-xl shadow-lg w-full max-w-lg p-6 relative"
      >
        <h2 className="text-xl font-semibold text-white mb-4 text-center font-exo2">
          Procesando tu pago con Bold...
        </h2>
        <p className="text-gray-400 text-center font-exo2">
          En unos segundos se abrirá la pasarela de pago. Si no aparece, revisa si fue bloqueada por el navegador.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-semibold font-exo2"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
