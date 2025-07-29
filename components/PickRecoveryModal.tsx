// 📁 components/PickRecoveryModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaClock, FaRedo } from 'react-icons/fa';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { useStickyStore } from '@/stores/stickyStore';

interface RecoveryData {
  id: string;
  picks: any[];
  wager_amount: number;
  potential_win: number;
  mode: string;
  gp_name: string;
  created_at: string;
}

interface PickRecoveryModalProps {
  recoveryId: string | null;
  onClose: () => void;
  onRecover: () => void;
}

export default function PickRecoveryModal({ 
  recoveryId, 
  onClose, 
  onRecover 
}: PickRecoveryModalProps) {
  const { user } = useUser();
  const { setQualyPicks, setRacePicks } = useStickyStore();
  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (recoveryId) {
      fetchRecoveryData(recoveryId);
    }
  }, [recoveryId]);

  const fetchRecoveryData = async (id: string) => {
    try {
      const response = await fetch(`/api/picks/recover?id=${id}`);
      if (!response.ok) throw new Error('Recovery data not found');
      
      const data = await response.json();
      setRecoveryData(data);
    } catch (error) {
      toast.error('No se pudo cargar la información de recuperación');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!recoveryData) return;
    
    setRecovering(true);
    try {
      // Restore picks to sticky store
      const qualyPicks = recoveryData.picks.filter(p => p.session_type === 'qualy');
      const racePicks = recoveryData.picks.filter(p => p.session_type === 'race');
      
      setQualyPicks(qualyPicks);
      setRacePicks(racePicks);
      
      toast.success('¡Picks restaurados! Puedes continuar con el pago.');
      onRecover();
      onClose();
    } catch (error) {
      toast.error('Error restaurando los picks');
    } finally {
      setRecovering(false);
    }
  };

  const getTimeLeft = (createdAt: string) => {
    const created = new Date(createdAt);
    const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60)));
    
    if (hoursLeft > 1) return `${hoursLeft} horas`;
    if (hoursLeft === 1) return '1 hora';
    return 'Menos de 1 hora';
  };

  if (!recoveryId) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700/50 shadow-xl max-w-lg w-full"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <FaRedo className="text-green-400" />
              Recuperar Picks
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-300">Cargando información...</p>
            </div>
          ) : recoveryData ? (
            <>
              {/* Time Warning */}
              <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
                  <FaClock />
                  Tiempo restante: {getTimeLeft(recoveryData.created_at)}
                </div>
                <p className="text-amber-200 text-sm">
                  Después de este tiempo, tendrás que crear nuevos picks.
                </p>
              </div>

              {/* Recovery Summary */}
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                <h3 className="text-white font-semibold mb-3">📋 Resumen de picks:</h3>
                <div className="space-y-2 mb-4">
                  {recoveryData.picks.map((pick, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-gray-700/50 rounded p-2 text-sm"
                    >
                      <span className="text-white font-medium">{pick.driver}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        pick.betterOrWorse === 'mejor' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {pick.betterOrWorse === 'mejor' ? 'Mejor' : 'Peor'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bet Summary */}
                <div className="border-t border-gray-600 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Modo:</span>
                    <span className="text-white">
                      {recoveryData.mode === 'full' ? '🚀 Full Throttle' : '🛡️ Safety Car'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Apuesta:</span>
                    <span className="text-white">
                      ${recoveryData.wager_amount.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ganancia potencial:</span>
                    <span className="text-green-400 font-bold">
                      ${recoveryData.potential_win.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRecover}
                  disabled={recovering}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-colors disabled:opacity-50"
                >
                  {recovering ? 'Restaurando...' : 'Restaurar y Pagar'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-red-400">No se pudo cargar la información de recuperación.</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}