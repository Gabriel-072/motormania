// 📁 components/DepositModal.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaSpinner,
  FaTimes,
  FaExclamationCircle,
  FaDollarSign,
  FaLock,
  FaShieldAlt,
  FaCcVisa,
  FaCcMastercard
} from 'react-icons/fa';

interface DepositModalProps {
  onClose: () => void;
  onDeposit: (amount: number) => Promise<void>;
}

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  });

export default function DepositModal({ onClose, onDeposit }: DepositModalProps) {
  const [amount, setAmount] = useState(20000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MIN = 5000;
  const PRESETS = [10000, 20000, 50000, 100000];

  const submit = async () => {
    if (amount < MIN || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await onDeposit(amount);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900 rounded-xl p-6 w-full max-w-sm text-white"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FaDollarSign/> Depósito
          </h3>
          <button onClick={onClose} disabled={isLoading}>
            <FaTimes/>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-2 text-center">Montos rápidos</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map(v => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className={`py-2 rounded ${amount === v ? 'bg-amber-500 text-black' : 'bg-gray-700 text-white'}`}
              >
                {fmtCurrency(v)}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">Otro monto (mín. {fmtCurrency(MIN)})</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(+e.target.value)}
            onBlur={() => amount < MIN && setAmount(MIN)}
            min={MIN}
            className="w-full p-2 rounded bg-gray-800 text-center"
          />
        </div>

        <button
          onClick={submit}
          disabled={isLoading || amount < MIN}
          className={`w-full py-2 rounded font-bold ${isLoading || amount < MIN
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-amber-500 text-black hover:bg-amber-600'}`}
        >
          {isLoading ? <FaSpinner className="animate-spin"/> : `Recargar ${fmtCurrency(amount)}`}
        </button>

        {error && (
          <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
            <FaExclamationCircle/> {error}
          </p>
        )}

        <div className="mt-6 text-center text-gray-400 text-xs space-y-1">
          <div className="flex justify-center gap-2 items-center">
            <FaLock/> <span>Conexión Segura</span> <FaShieldAlt/> <span>Datos Protegidos</span>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <FaCcVisa/> <FaCcMastercard/>
          </div>
          <p>Pagos procesados por <strong>Bold</strong></p>
        </div>
      </motion.div>
    </div>
  );
}