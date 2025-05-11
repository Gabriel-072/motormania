// 📁 components/DepositModal.tsx
'use client';

import React, { useState } from 'react';
import { FaSpinner, FaTimes, FaExclamationCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';

interface DepositModalProps {
  onClose: () => void;
  onDeposit: (amount: number) => Promise<void> | void;
}

export default function DepositModal({ onClose, onDeposit }: DepositModalProps) {
  const [amount, setAmount] = useState(20000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MIN_DEPOSIT = 5000;
  const PRESET_AMOUNTS = [10000, 20000, 50000];

  const handleDepositClick = async () => {
    if (amount < MIN_DEPOSIT || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await onDeposit(amount);
      // el modal se cerrará desde onClose() en la página tras el callback de Bold
    } catch (err: any) {
      console.error('Deposit error caught in modal:', err);
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (value: number) => {
    const valid = Math.max(MIN_DEPOSIT, Math.round(value / 1000) * 1000);
    setAmount(valid);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-exo2 antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 w-full max-w-xs shadow-2xl border border-gray-700 text-white"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-amber-400">Elige monto a recargar</h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-300 p-1 rounded-full hover:bg-gray-700/50 disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <FaTimes size={18} />
          </button>
        </div>

        {/* Botones Preset */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {PRESET_AMOUNTS.map((v) => (
            <button
              key={v}
              onClick={() => handleAmountChange(v)}
              className={`py-2 rounded text-sm font-medium transition-all duration-150 ease-in-out active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                amount === v
                  ? 'bg-amber-500 text-black shadow-md focus:ring-amber-400'
                  : 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500'
              }`}
            >
              ${v.toLocaleString('es-CO')}
            </button>
          ))}
        </div>

        {/* Input Personalizado */}
        <label
          htmlFor="customAmount"
          className="block text-xs text-gray-400 mb-1 text-center"
        >
          O ingresa un monto (mín. ${MIN_DEPOSIT.toLocaleString('es-CO')})
        </label>
        <input
          id="customAmount"
          type="number"
          aria-label="Monto personalizado"
          value={amount}
          onChange={(e) => handleAmountChange(Number(e.target.value))}
          min={MIN_DEPOSIT}
          step={1000}
          className="w-full mb-5 rounded bg-gray-700 p-2 text-center text-lg font-semibold text-white border border-gray-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none appearance-none"
        />

        {/* Botón Depositar */}
        <button
          onClick={handleDepositClick}
          disabled={isLoading || amount < MIN_DEPOSIT}
          className={`w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black py-2.5 rounded-lg font-bold text-base shadow-lg transition-all duration-200 ease-in-out active:scale-95 flex items-center justify-center ${
            isLoading || amount < MIN_DEPOSIT
              ? 'opacity-60 cursor-not-allowed'
              : 'hover:from-amber-600 hover:to-orange-600 hover:shadow-xl'
          }`}
        >
          {isLoading ? (
            <FaSpinner className="animate-spin text-xl text-black" />
          ) : (
            `Recargar $${amount.toLocaleString('es-CO')}`
          )}
        </button>

        {/* Mensaje de Error */}
        {error && (
          <p className="text-red-400 text-xs mt-3 text-center flex items-center justify-center gap-1">
            <FaExclamationCircle /> {error}
          </p>
        )}

        {/* Botón Cancelar */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="block w-full mt-4 text-center text-sm text-gray-400 hover:text-gray-200 disabled:opacity-50 transition-colors"
        >
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}