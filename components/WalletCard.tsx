// components/WalletCard.tsx - Simplified Cash Only
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FaMoneyBillWave, FaLock } from 'react-icons/fa';

interface WalletCardProps {
  balanceCop: number;
  withdrawableCop: number;
}

export default function WalletCard({ 
  balanceCop, 
  withdrawableCop 
}: WalletCardProps) {
  
  // Format numbers
  const fmtCop = (n: number) => `$${n.toLocaleString('es-CO')}`;
  
  // Calculate locked amount
  const lockedAmount = balanceCop - withdrawableCop;

  return (
    <motion.div
      className="bg-gradient-to-br from-gray-800/90 via-black/60 to-gray-900/90 rounded-2xl shadow-2xl border border-gray-700/50 p-6 sm:p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <div className="p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
            <FaMoneyBillWave className="h-6 w-6 text-green-400" />
          </div>
          <div className="ml-4">
            <h2 className="text-2xl font-bold text-white">Mi Wallet</h2>
            <p className="text-sm text-gray-400">Balance en pesos colombianos</p>
          </div>
        </div>
        
        {/* Status indicator */}
        {lockedAmount > 0 && (
          <span
            className="inline-flex items-center bg-yellow-500/30 text-yellow-300 text-xs font-semibold px-3 py-1 rounded-full shadow-sm cursor-default hover:bg-yellow-500/40 transition-colors"
            role="status"
            aria-label={`Tienes ${fmtCop(lockedAmount)} bloqueados`}
          >
            <FaLock className="h-3 w-3 mr-1.5" />
            Fondos Bloqueados
          </span>
        )}
      </div>

      {/* Main Balance */}
      <div className="mb-8 text-center">
        <p className="text-sm text-gray-400 uppercase tracking-wider font-medium mb-2">
          Balance Total
        </p>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white">
          {fmtCop(balanceCop)}
        </h1>
        <p className="text-gray-400 text-lg mt-2">COP</p>
      </div>

      {/* Balance Breakdown */}
      <div className="space-y-4">
        
        {/* Available Balance */}
        <div className="bg-black/30 hover:bg-black/40 transition-colors p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <FaMoneyBillWave className="h-5 w-5 text-green-400 mr-2.5" />
              <h3 className="text-lg font-semibold text-green-300">Disponible para Retiro</h3>
            </div>
            <span className="text-xl font-bold text-green-300">{fmtCop(withdrawableCop)}</span>
          </div>
          <p className="text-sm text-gray-400 pl-7">
            Puedes retirar este monto a tu cuenta bancaria
          </p>
        </div>

        {/* Locked Balance (if any) */}
        {lockedAmount > 0 && (
          <div className="bg-black/30 hover:bg-black/40 transition-colors p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <FaLock className="h-5 w-5 text-yellow-400 mr-2.5" />
                <h3 className="text-lg font-semibold text-yellow-300">Fondos Bloqueados</h3>
              </div>
              <span className="text-xl font-bold text-yellow-300">{fmtCop(lockedAmount)}</span>
            </div>
            <p className="text-sm text-gray-400 pl-7">
              Fondos temporalmente bloqueados (apuestas pendientes, bonos en proceso, etc.)
            </p>
          </div>
        )}

        {/* Total Balance Summary */}
        <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-blue-300 font-medium">Balance Total en Wallet</span>
            <span className="text-blue-300 font-bold text-lg">{fmtCop(balanceCop)}</span>
          </div>
          <div className="mt-2 text-sm text-gray-400">
            Incluye fondos disponibles {lockedAmount > 0 && '+ fondos bloqueados'}
          </div>
        </div>
        
      </div>

      {/* Quick Actions */}
      <div className="mt-6 pt-6 border-t border-gray-700/50">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{fmtCop(withdrawableCop)}</div>
            <div className="text-gray-400">Para Retirar</div>
          </div>
          {lockedAmount > 0 ? (
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{fmtCop(lockedAmount)}</div>
              <div className="text-gray-400">Bloqueado</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">100%</div>
              <div className="text-gray-400">Disponible</div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}