// 📁 /components/WithdrawModal.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FaSpinner } from 'react-icons/fa';

interface Props {
  max: number;                 // saldo retirable disponible
  onClose: () => void;
  onSuccess: () => void;       // refrescar la wallet después
}

const MIN = 10_000;

export default function WithdrawModal({ max, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState(MIN);
  const [method, setMethod] = useState<'Nequi' | 'Daviplata' | 'Bancolombia'>('Nequi');
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (loading || amount < MIN || amount > max || !account) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, account }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSuccess(); onClose();
    } catch (e: any) {
      setErr(e.message || 'Error solicitando retiro');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: .2 }}
        className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700/60 text-white"
      >
        <h3 className="text-lg font-bold mb-4 text-cyan-400 text-center">Solicitar Retiro</h3>

        {/* monto */}
        <label className="text-xs text-gray-400">Monto (COP)</label>
        <input
          type="number" min={MIN} step={1000} value={amount}
          onChange={e => setAmount(+e.target.value)}
          className="w-full bg-gray-700/60 p-2 rounded mb-4 text-center"
        />
        <p className="text-xs text-gray-400 mb-3">
          Disponible: <span className="text-green-400 font-semibold">${max.toLocaleString('es-CO')}</span>
        </p>

        {/* método */}
        <label className="text-xs text-gray-400">Método</label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value as any)}
          className="w-full bg-gray-700/60 p-2 rounded mb-4"
        >
          <option>Nequi</option>
          <option>Daviplata</option>
          <option>Bancolombia</option>
        </select>

        {/* cuenta */}
        <label className="text-xs text-gray-400">Número / Cuenta</label>
        <input
          value={account}
          onChange={e => setAccount(e.target.value)}
          className="w-full bg-gray-700/60 p-2 rounded mb-4"
          placeholder="3001234567"
        />

        {err && <p className="text-red-400 text-xs mb-3 text-center">{err}</p>}

        <button
          onClick={send}
          disabled={loading || amount < MIN || amount > max || !account}
          className="w-full py-2 bg-cyan-500 hover:bg-cyan-600 rounded font-bold disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {loading ? <FaSpinner className="animate-spin"/> : 'Solicitar Retiro'}
        </button>

        <button
          onClick={onClose}
          className="block w-full mt-3 text-center text-xs text-gray-400 hover:text-gray-200"
        >
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}