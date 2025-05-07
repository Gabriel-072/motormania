// 📁 components/WithdrawModal.tsx
'use client';

import { useState } from 'react';
import { motion }   from 'framer-motion';
import { FaSpinner } from 'react-icons/fa';

interface Props {
  max     : number;                                            // saldo retirable
  onClose : () => void;
  onSubmit: (amount:number, method:string, account:string)=>Promise<void>;
}

/** 👇 Mantén este valor igual que el que valida tu endpoint /api/withdraw */
const MIN_WITHDRAW = 10_000;

export default function WithdrawModal({ max, onClose, onSubmit }: Props) {
  const [amount , setAmount ] = useState(MIN_WITHDRAW);
  const [method , setMethod ] = useState<'Nequi'|'Daviplata'|'Bancolombia'>('Nequi');
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [err    , setErr    ] = useState<string|null>(null);

  /* ────────── helpers ────────── */
  const fmt = (n:number)=>n.toLocaleString('es-CO');

  const handleSend = async () => {
    if (loading) return;

    /* validaciones front */
    if (amount < MIN_WITHDRAW)  return setErr(`El mínimo es $${fmt(MIN_WITHDRAW)}`);
    if (amount > max)           return setErr('Saldo insuficiente');
    if (!account.trim())        return setErr('Ingresa tu número / cuenta');

    try {
      setLoading(true); setErr(null);
      await onSubmit(amount, method, account.trim());
      onClose(); // se cierra sólo si onSubmit no lanza error
    } catch (e:any) {
      setErr(e?.message || 'Error solicitando retiro');
    } finally {
      setLoading(false);
    }
  };

  /* ────────── JSX ────────── */
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
        exit={{ scale:.9, opacity:0 }} transition={{ duration:.2 }}
        className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700/60 text-white"
      >
        <h3 className="text-lg font-bold mb-4 text-cyan-400 text-center">
          Solicitar Retiro
        </h3>

        {/* monto */}
        <label className="text-xs text-gray-400">Monto (COP)</label>
        <input
          type="number"
          min={MIN_WITHDRAW}
          step={1000}
          value={amount}
          onChange={e=>setAmount(+e.target.value)}
          className="w-full bg-gray-700/60 p-2 rounded mb-2 text-center font-semibold"
        />
        <p className="text-xs text-gray-400 mb-4">
          Disponible:&nbsp;
          <span className="text-green-400 font-semibold">${fmt(max)}</span>
        </p>

        {/* método */}
        <label className="text-xs text-gray-400">Método</label>
        <select
          value={method}
          onChange={e=>setMethod(e.target.value as any)}
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
          onChange={e=>setAccount(e.target.value)}
          className="w-full bg-gray-700/60 p-2 rounded mb-4 text-center"
          placeholder="3001234567"
        />

        {/* errores */}
        {err && <p className="text-red-400 text-xs mb-3 text-center">{err}</p>}

        {/* botón enviar */}
        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full py-2 bg-cyan-500 hover:bg-cyan-600 rounded font-bold flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {loading ? <FaSpinner className="animate-spin"/> : 'Solicitar Retiro'}
        </button>

        {/* cancelar */}
        <button
          onClick={onClose}
          disabled={loading}
          className="block w-full mt-3 text-center text-xs text-gray-400 hover:text-gray-200"
        >
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}