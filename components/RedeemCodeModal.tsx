// 📁 components/RedeemCodeModal.tsx
'use client';

import React, { useState } from 'react';
import { FaTimes, FaSpinner, FaTicketAlt, FaExclamationCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface RedeemCodeModalProps {
  onClose: () => void;
}

export default function RedeemCodeModal({ onClose }: RedeemCodeModalProps) {
  const [code, setCode] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Por favor ingresa un código.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/promocodes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed })
      });
      const json = await res.json();

      if (res.ok) {
        toast.success(json.message || '¡Código aplicado!');
        onClose();
      } else {
        toast.error(json.error || 'No se pudo aplicar el código.');
        setError(json.error || 'Error interno.');
      }
    } catch (e: any) {
      toast.error('Error de conexión.');
      setError(e?.message || 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-exo2 antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 w-full max-w-xs shadow-2xl border border-gray-700 text-white"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Canjear Código</h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-full hover:bg-gray-700/50 disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <FaTimes size={18} />
          </button>
        </div>

        <label htmlFor="promoCode" className="block text-sm text-gray-300 mb-2">
          Ingresa tu código promocional
        </label>
        <input
          id="promoCode"
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          disabled={isLoading}
          className="w-full mb-4 rounded bg-gray-700 p-2 text-center text-white border border-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          placeholder="Ej: MMC100"
        />

        <button
          onClick={handleRedeem}
          disabled={isLoading}
          className={`w-full py-2 rounded-lg text-white font-semibold transition ${
            isLoading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-600'
          } flex items-center justify-center gap-2`}
        >
          {isLoading
            ? <FaSpinner className="animate-spin" />
            : <> <FaTicketAlt /> <span>Canjear</span> </>
          }
        </button>

        {error && (
          <p className="text-red-400 text-sm mt-3 flex items-center gap-1">
            <FaExclamationCircle /> {error}
          </p>
        )}

        <button
          onClick={onClose}
          disabled={isLoading}
          className="block w-full mt-4 text-center text-sm text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}
