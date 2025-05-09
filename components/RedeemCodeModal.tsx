// 📁 components/RedeemCodeModal.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FaTicketAlt, FaSpinner } from 'react-icons/fa';

interface Props {
  onClose: () => void;
}

export default function RedeemCodeModal({ onClose }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast.error('Ingresa un código');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/promocodes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al canjear');
      toast.success(data.message);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al canjear código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700/60 text-white"
      >
        <h3 className="text-lg font-bold mb-4 text-amber-400 flex items-center gap-2">
          <FaTicketAlt /> Canjear Código
        </h3>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="TU-CODIGO-AQUI"
          className="w-full bg-gray-700/60 p-2 rounded mb-4 text-center uppercase"
        />
        <button
          onClick={handleRedeem}
          disabled={loading}
          className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 rounded font-bold flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {loading ? <FaSpinner className="animate-spin" /> : 'Canjear Código'}
        </button>
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