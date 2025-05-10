// 📁 components/DepositModal.tsx
'use client';

import { useState } from 'react';
import {
  FaSpinner,
  FaTimes,
  FaShieldAlt,
  FaExclamationCircle,
  FaDollarSign,
  FaCcVisa,
  FaCcMastercard,
  FaLock
} from 'react-icons/fa';
import { motion } from 'framer-motion';

interface DepositModalProps {
  onClose: () => void;
  onDeposit: (amount: number) => Promise<void> | void;
}

// Respuesta esperada de /api/bold/hash
interface BoldHashResponse {
  orderId: string;
  amount: string;
  callbackUrl: string;
  integrityKey: string;
  // metadata?: any; // si lo necesitas
}

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

export default function DepositModal({ onClose, onDeposit }: DepositModalProps) {
  const [amount, setAmount] = useState(20000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MIN_DEPOSIT = 5000;
  const PRESET_AMOUNTS = [10000, 20000, 50000, 100000];

  const handleDepositClick = async () => {
    if (amount < MIN_DEPOSIT || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      // 1) Registrar y pedir firma al backend
      const resp = await fetch('/api/bold/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: `MM-DEP-${Date.now()}`, amount, currency: 'COP' })
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new Error(body?.error || 'Error generando firma en servidor');
      }

      const { orderId, amount: amtStr, callbackUrl, integrityKey } =
        (await resp.json()) as BoldHashResponse;

      if (!orderId || !amtStr || !callbackUrl || !integrityKey) {
        throw new Error('Respuesta inválida del servidor');
      }

      // 2) Abrir paso de pago
      await Promise.resolve(onDeposit(amount)); // permitimos que onDeposit también devuelva promesa

      // 3) Lanzamos Bold
      (window as any).openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
        orderId,
        amount: amtStr,
        currency: 'COP',
        description: `Recarga ${fmtCurrency(amount)}`,
        redirectionUrl: callbackUrl,           // <-- usamos el callbackUrl que vino del backend
        integritySignature: integrityKey,      // <-- firmamos con la key correcta
        customerData: {
          email: (window as any).CLERK_USER?.primaryEmailAddress?.emailAddress ?? '',
          fullName: (window as any).CLERK_USER?.fullName || 'Jugador MMC',
        },
        renderMode: 'embedded',
        onSuccess: () => {
          // Bold redirigirá y la RT actualizará el saldo
          // opcionalmente cerramos el modal
        },
        onFailed: ({ message }: { message?: string }) => {
          setError(message || 'Pago falló, intenta otra vez');
        },
        onPending: () => {
          setError('Pago pendiente de confirmación');
        },
        onClose: () => {
          setIsLoading(false);
          onClose();
        },
      });
    } catch (err: any) {
      console.error('Deposit error caught in modal:', err);
      setError(err.message || 'Ocurrió un error inesperado.');
      setIsLoading(false);
    }
  };

  const handleAmountChange = (value: number) => {
    if (isNaN(value)) value = 0;
    setAmount(value);
    if (value >= MIN_DEPOSIT) setError(null);
  };

  const handlePresetClick = (v: number) => {
    setAmount(v);
    setError(null);
  };

  const handleInputBlur = (value: number) => {
    if (value < MIN_DEPOSIT) setAmount(MIN_DEPOSIT);
    else {
      const rounded = Math.round(value / 1000) * 1000;
      setAmount(rounded);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-exo2 antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-gradient-to-br from-gray-800/90 to-gray-900/95 rounded-xl p-5 sm:p-6 w-full max-w-sm shadow-2xl border border-gray-700/60 text-white"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <FaDollarSign /> Realiza tu Depósito
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-700/50 disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <FaTimes size={18} />
          </button>
        </div>

        {/* Presets */}
        <p className="text-sm text-gray-400 mb-2 text-center">
          Selecciona un monto rápido:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {PRESET_AMOUNTS.map((v) => (
            <button
              key={v}
              onClick={() => handlePresetClick(v)}
              className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ease-in-out active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 shadow-md transform ${
                amount === v
                  ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-black focus-visible:ring-amber-400 scale-105 shadow-lg'
                  : 'bg-gray-700/80 text-gray-100 hover:bg-gray-600/80 focus-visible:ring-gray-500'
              }`}
            >
              {fmtCurrency(v)}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <label
          htmlFor="customAmount"
          className="block text-sm text-gray-300 mb-1.5 text-center"
        >
          O ingresa un monto (mín. {fmtCurrency(MIN_DEPOSIT)})
        </label>
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg select-none">
            COP
          </span>
          <input
            id="customAmount"
            type="number"
            value={
              amount === 0 && document.activeElement !== document.getElementById('customAmount')
                ? ''
                : amount
            }
            onChange={(e) => handleAmountChange(parseFloat(e.target.value))}
            onBlur={(e) => handleInputBlur(parseFloat(e.target.value))}
            min={MIN_DEPOSIT}
            step={1000}
            placeholder="0"
            className="w-full pl-14 pr-4 py-3 rounded-lg bg-gray-900/70 text-center text-xl font-semibold text-white border-2 border-gray-700 focus:border-amber-500 focus:ring-amber-500/80 outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Botón principal */}
        <button
          onClick={handleDepositClick}
          disabled={isLoading || amount < MIN_DEPOSIT}
          className={`w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black py-3 rounded-lg font-bold text-base shadow-lg transition-all duration-200 ease-in-out active:scale-95 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 focus-visible:ring-amber-400 transform ${
            isLoading || amount < MIN_DEPOSIT
              ? 'opacity-60 cursor-not-allowed'
              : 'hover:from-amber-500 hover:to-orange-600 hover:-translate-y-0.5'
          }`}
        >
          {isLoading ? (
            <FaSpinner className="animate-spin text-xl text-black" />
          ) : (
            `Recargar ${fmtCurrency(amount)}`
          )}
        </button>

        {error && (
          <p className="text-red-400 text-xs mt-3 text-center flex items-center justify-center gap-1">
            <FaExclamationCircle /> {error}
          </p>
        )}

        {/* Footer de seguridad */}
        <div className="mt-6 pt-4 border-t border-gray-700/50 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
            <FaLock className="text-green-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm">Conexión Segura</span>
            <FaShieldAlt className="text-green-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm">Datos Protegidos</span>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">
              Métodos de Pago Aceptados
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-3 sm:gap-x-4 gap-y-2">
              <FaCcVisa size={32} title="Visa" aria-label="Visa" className="text-gray-300 hover:text-white transition-colors" />
              <FaCcMastercard size={32} title="Mastercard" aria-label="Mastercard" className="text-gray-300 hover:text-white transition-colors" />
              <img src="/images/metodos/pse.png"       alt="PSE"         className="h-6 sm:h-7 max-w-[60px]" />
              <img src="/images/metodos/nequi.png"     alt="Nequi"      className="h-6 sm:h-7 max-w-[60px]" />
              <img src="/images/metodos/daviplata.png" alt="Daviplata"  className="h-6 sm:h-7 max-w-[60px]" />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-sm font-medium text-gray-300 mb-3">
              Tu Pago Seguro Con
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-3 gap-y-2">
              <img src="/images/trust/pci.png"           alt="PCI DSS" className="h-7 sm:h-8" />
              <img src="/images/trust/hackerprotected.png" alt="Hacked" className="h-7 sm:h-8" />
              <img src="/images/trust/visasecure.png"      alt="VisaSec" className="h-7 sm:h-8" />
              <img src="/images/trust/recaptcha.png"       alt="reCAPTCHA" className="h-7 sm:h-8" />
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Pagos procesados de forma segura por <strong>Bold</strong>.
          </p>
        </div>

        {/* Botón cancelar */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="block w-full mt-6 text-center text-sm py-2.5 rounded-lg border-2 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 disabled:opacity-50 transition-all duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-800"
        >
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}