// /components/DepositModal.tsx (o la ruta correspondiente)
'use client';

import { useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { motion } from 'framer-motion'; // <--- CORREGIDO: Importar motion

interface DepositModalProps {
    onClose: () => void;
    onDeposit: (amount: number) => Promise<void> | void;
}

export default function DepositModal({ onClose, onDeposit }: DepositModalProps) {
  const [amount, setAmount] = useState(20000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const MIN_DEPOSIT = 5000;

  const handleDepositClick = async () => {
      if (amount < MIN_DEPOSIT || isLoading) return;

      setIsLoading(true);
      setError(null);
      try {
          await onDeposit(amount);
          // La lógica de cierre ahora está en `handleActualDeposit` en la página principal
          // si Bold se abre correctamente. No necesitamos cerrar aquí.
      } catch (err) {
          console.error("Deposit error caught in modal:", err);
          setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleAmountChange = (value: number) => {
      const validAmount = Math.max(MIN_DEPOSIT, Math.round(value / 1000) * 1000);
      setAmount(validAmount);
      setError(null);
  }

  return (
    // No necesita motion.div aquí si AnimatePresence está en el padre
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-exo2">
      {/* Aplicar motion al panel del modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 w-full max-w-xs shadow-xl border border-gray-700 text-white"
      >
        <h3 className="text-lg font-bold mb-5 text-center text-amber-400">Elige monto a recargar</h3>

        {/* Botones Preset */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[10000, 20000, 50000].map((v) => (
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
        <label htmlFor="customAmount" className="block text-xs text-gray-400 mb-1 text-center">O ingresa un monto (mín. ${MIN_DEPOSIT.toLocaleString('es-CO')})</label>
        <input
          id="customAmount"
          aria-label="Monto personalizado"
          type="number"
          className="w-full mb-5 rounded bg-gray-700 p-2 text-center text-lg font-semibold text-white border border-gray-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={amount}
          onChange={(e) => handleAmountChange(Number(e.target.value))}
          min={MIN_DEPOSIT}
          step={1000}
        />

        {/* Botón Depositar */}
        <button
          onClick={handleDepositClick}
          disabled={isLoading || amount < MIN_DEPOSIT}
          className={`w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black py-2.5 rounded-lg font-bold text-base shadow-lg transition-all duration-200 ease-in-out active:scale-95 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-amber-400 ${
              isLoading || amount < MIN_DEPOSIT
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:from-amber-600 hover:to-orange-600 hover:shadow-xl'
          }`}
        >
          {isLoading
            ? <FaSpinner className="animate-spin text-xl text-black" />
            : `Recargar $${amount.toLocaleString('es-CO')}`
          }
        </button>

        {/* Mensaje de Error */}
        {error && <p className="text-red-400 text-xs mt-3 text-center">{error}</p>}

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