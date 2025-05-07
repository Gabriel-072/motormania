'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  FaTimes, FaTrashAlt, FaCheck, FaExclamationTriangle,
  FaDollarSign, FaSpinner
} from 'react-icons/fa';
import { useUser, useAuth } from '@clerk/nextjs';
import { useStickyStore } from '@/stores/stickyStore';
import { openBoldCheckout } from '@/lib/bold';
import { toast } from 'sonner';
import { createAuthClient } from '@/lib/supabase';          // 👈 NUEVO
import { PickSelection } from '@/app/types/picks';

/* ────────── payout tables ────────── */
const payoutCombos: Record<number, number> = { 2:3,3:6,4:10,5:20,6:35,7:60,8:100 };
const safetyPayouts: Record<number, number[]> = {
  3:[2,1],4:[5,1.5],5:[10,1.5,1],6:[20,1.5,0.4],7:[30,2.5,1],8:[50,5,1.5]
};

interface FullModalProps { isOpen: boolean; onClose: () => void; }
type RegisterPickApiResponse = {
  orderId: string; amount: string; callbackUrl: string; integrityKey: string;
};

const FullModal: React.FC<FullModalProps> = ({ isOpen, onClose }) => {

  /* ────────── stores & auth ────────── */
  const { picks, setQualyPicks, setRacePicks } = useStickyStore();
  const { user } = useUser();
  const { getToken } = useAuth();

  /* ────────── local state ────────── */
  const [amount, setAmount]             = useState(20000);
  const [mode, setMode]                 = useState<'full'|'safety'>('full');
  const [error, setError]               = useState<string|null>(null);
  const [isValid, setIsValid]           = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /* ────────── picks merged ────────── */
  const combinedPicks: PickSelection[] = [
    ...(picks.qualy ?? []),
    ...(picks.race  ?? [])
  ];
  const totalPicks = combinedPicks.length;

  /* ────────── validation ────────── */
  useEffect(() => {
    let msg: string | null = null;
    if (totalPicks < 2) msg = 'Elige al menos 2 picks';
    else if (totalPicks > 8) msg = 'Máximo 8 picks por jugada';
    else if (combinedPicks.some(p => !p.betterOrWorse))
      msg = 'Completa todos tus picks (Mejor/Peor)';
    else if (amount < 10000) msg = 'Monto mínimo $10.000 COP';
    else if (mode==='safety' && totalPicks < 3) msg = 'Safety requiere mínimo 3 picks';
    setError(msg);
    setIsValid(!msg);
  }, [combinedPicks,totalPicks,amount,mode]);

  /* ────────── helpers edición ────────── */
  const updatePick = useCallback((idx:number, better:boolean)=>{
    const flag = better ? 'mejor':'peor';
    if (idx < picks.qualy.length) {
      setQualyPicks(picks.qualy.map((p,i)=>i===idx?{...p,betterOrWorse:flag}:p));
    } else {
      const rel = idx - picks.qualy.length;
      setRacePicks(picks.race.map((p,i)=>i===rel?{...p,betterOrWorse:flag}:p));
    }
  },[picks,setQualyPicks,setRacePicks]);

  const removePick = useCallback((idx:number)=>{
    if (idx < picks.qualy.length) setQualyPicks(picks.qualy.filter((_,i)=>i!==idx));
    else {
      const rel = idx - picks.qualy.length;
      setRacePicks(picks.race.filter((_,i)=>i!==rel));
    }
  },[picks,setQualyPicks,setRacePicks]);

  /* ────────── pago Bold (sin cambios salvo  consume_locked_mmc) ────────── */
  const handleBoldPayment = async () => {
    if (!user?.id || isProcessing || !isValid) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) { toast.error('Tu cuenta no tiene email'); return; }

    setIsProcessing(true); setError(null);

    try {
      /* 1. registrar pending TX */
      const res = await fetch('/api/transactions/register-pick-transaction',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          picks: combinedPicks, mode, amount,
          gpName  : combinedPicks[0]?.gp_name ?? 'GP',
          fullName: user.fullName, email
        })
      });
      if (!res.ok) {
        const { error:e } = await res.json().catch(()=>({}));
        throw new Error(e ?? 'Error registrando jugada.');
      }
      const { orderId, amount:amtStr, callbackUrl, integrityKey }
        = (await res.json()) as RegisterPickApiResponse;

      /* 2. abrir Bold */
      openBoldCheckout({
        apiKey            : process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
        orderId, amount   : amtStr, currency:'COP',
        description       : `MMC GO (${totalPicks} picks) - ${mode==='full'?'Full':'Safety'}`,
        redirectionUrl    : callbackUrl,
        integritySignature: integrityKey,
        customerData      : JSON.stringify({ email, fullName: user.fullName ?? 'Jugador MMC' }),
        renderMode:'embedded',
        onSuccess: async () => {
          toast.success('Pago recibido, procesando…');

          /* 2.b  Descuenta MMC bloqueados del wagering */
          try {
            const token = await getToken({ template:'supabase' });
            if (token) {
              const supabase = createAuthClient(token);
              const { error } = await supabase.rpc('consume_locked_mmc',{
                p_user_id : user.id,
                p_bet_mmc : Math.round(amount/1000)
              });
              if (error) console.warn('consume_locked_mmc error', error.message);
            }
          } catch (err) { console.warn('consume_locked_mmc failed', err); }

          /* 3. limpia store y cierra modal */
          setQualyPicks([]); setRacePicks([]);
          setIsProcessing(false); onClose();
        },
        onFailed : ({ message }:{message?:string}) => {
          toast.error(`Pago falló: ${message ?? ''}`); setIsProcessing(false);
        },
        onClose  : () => setIsProcessing(false),
        onPending: () => { toast.info('Pago pendiente'); setIsProcessing(false); }
      });
    } catch (err:any) {
      toast.error(err.message ?? 'Error iniciando pago'); setIsProcessing(false);
    }
  };

  // ────────── JSX (idéntico al anterior, etiquetas completas) ──────────
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="flex min-h-full items-end sm:items-center justify-center p-4 text-center w-full">
            <motion.div
              className="w-full sm:max-w-2xl bg-gradient-to-b from-gray-900 to-[#0a1922] rounded-t-2xl sm:rounded-xl p-5 sm:p-6 border-t sm:border border-gray-700/50 shadow-2xl flex flex-col max-h-[90vh]"
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            >
              {/* --- header --- */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-700/50">
                <h2 className="text-xl sm:text-2xl font-bold text-amber-400">
                  Revisa tus Picks
                </h2>
                <button onClick={onClose} aria-label="Cerrar"
                        className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/60">
                  <FaTimes size={20}/>
                </button>
              </div>

              {/* --- listado picks --- */}
              <div className="space-y-3 overflow-y-auto flex-grow pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
                {combinedPicks.length ? combinedPicks.map((pick, idx) => (
                  <motion.div
                    key={`${pick.driver}-${idx}`}
                    layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: .15 } }}
                    className="flex items-center gap-3 bg-gray-800/70 rounded-lg p-3 border border-gray-700/60 hover:border-cyan-600/70"
                  >
                    <Image
                      src={`/images/pilots/${pick.driver.toLowerCase().replace(/ /g, '-')}.png`}
                      alt={pick.driver}
                      width={48} height={48} unoptimized
                      className="rounded-full w-10 h-10 sm:w-12 sm:h-12 object-cover border-2 border-gray-600"
                      onError={e => { (e.currentTarget as HTMLImageElement).src = '/images/pilots/default-pilot.png'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm sm:text-base truncate">
                        {pick.driver}
                      </p>
                      <p className="text-gray-400 text-xs truncate">{pick.team}</p>
                      <p className="text-cyan-400 text-xs">
                        Línea ({pick.session_type === 'qualy' ? 'Q' : 'R'}):{' '}
                        <span className="font-semibold">{pick.line.toFixed(1)}</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 items-end ml-2">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updatePick(idx, true)}
                          className={`text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1
                            ${pick.betterOrWorse === 'mejor'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-600 hover:bg-green-700 text-gray-200'}`}
                        >
                          <FaCheck size={10}/> Mejor
                        </button>
                        <button
                          onClick={() => updatePick(idx, false)}
                          className={`text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1
                            ${pick.betterOrWorse === 'peor'
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-600 hover:bg-red-700 text-gray-200'}`}
                        >
                          <FaTimes size={10}/> Peor
                        </button>
                      </div>
                      <button onClick={() => removePick(idx)}
                              className="text-gray-500 hover:text-red-500 text-[11px] flex items-center gap-1">
                        <FaTrashAlt className="w-2.5 h-2.5"/> Eliminar
                      </button>
                    </div>
                  </motion.div>
                )) : (
                  <p className="text-center text-gray-400 py-6">
                    No has seleccionado picks.
                  </p>
                )}
              </div>

              {/* --- controles inferiores (monto, modo, confirmar) --- */}
              <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
                {/* monto */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                  <input
                    type="number"
                    value={amount || ''}
                    onChange={e=>setAmount(Math.max(0, parseInt(e.target.value)||0))}
                    min={2000} step={1000}
                    placeholder="Monto (min $10.000)"
                    className="w-full py-2.5 px-4 pl-7 rounded-lg bg-gray-700/60 border border-gray-600/80 text-white font-semibold text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* quick add */}
                <div className="flex flex-wrap justify-center gap-2">
                  {[10000,20000,50000,100000].map(v=>(
                    <button key={v} onClick={()=>setAmount(a=>a+v)}
                      className="px-3 py-1 rounded-full text-xs bg-gray-600/80 text-gray-200 hover:bg-gray-500">
                      +${v.toLocaleString('es-CO')}
                    </button>
                  ))}
                  <button onClick={()=>setAmount(10000)}
                    className="px-3 py-1 rounded-full text-xs bg-red-800/70 text-gray-200 hover:bg-red-700">
                    Limpiar
                  </button>
                </div>

                {/* modo */}
                <div className="flex justify-center bg-gray-800/80 rounded-lg p-1">
                  <button onClick={()=>setMode('full')}
                          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold
                            ${mode==='full' ? 'bg-amber-500 text-black' : 'text-gray-300 hover:bg-gray-700/50'}`}>
                    🚀 Full Throttle
                  </button>
                  <button onClick={()=>setMode('safety')} disabled={totalPicks<3}
                          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold
                            ${mode==='safety' ? 'bg-amber-500 text-black' : 'text-gray-300 hover:bg-gray-700/50'}
                            ${totalPicks<3 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    🛡️ Safety Car
                  </button>
                </div>

                {/* payout info */}
                <div className="bg-gray-800/70 p-3 rounded-lg text-sm text-gray-200 space-y-1 border border-gray-700/60">
                  {mode==='full' ? (
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-xs">{totalPicks} Aciertos</span>
                      <span>
                        <span className="text-cyan-400 font-bold">{payoutCombos[totalPicks]||0}x</span>
                        <span className="text-gray-400 text-xs"> → </span>
                        <span className="text-green-400 font-bold">
                          ${(amount*(payoutCombos[totalPicks]||0)).toLocaleString('es-CO')}
                        </span>
                      </span>
                    </div>
                  ) : (
                    (safetyPayouts[totalPicks]||[]).map((m,i)=>(
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-400 text-xs">{totalPicks-i} Aciertos</span>
                        <span>
                          <span className="text-cyan-400 font-bold">{m}x</span>
                          <span className="text-gray-400 text-xs"> → </span>
                          <span className="text-white font-semibold">
                            ${(m*amount).toLocaleString('es-CO')}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-center text-red-400 text-sm flex items-center justify-center gap-1"
                    >
                      <FaExclamationTriangle/> {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* confirmar */}
                <button
                  onClick={handleBoldPayment}
                  disabled={!isValid || isProcessing}
                  className={`w-full py-3 rounded-lg font-bold text-lg flex justify-center gap-2
                    ${isProcessing
                      ? 'bg-yellow-600 text-white cursor-wait'
                      : isValid
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                        : 'bg-gray-600/80 text-gray-400/80 cursor-not-allowed'}`}
                >
                  {isProcessing
                    ? (<><FaSpinner className="animate-spin"/> Procesando…</>)
                    : (<><FaDollarSign/> Confirmar y Pagar ${amount.toLocaleString('es-CO')}</>)}
                </button>
              </div>{/* Fin controles */}
            </motion.div>{/* Fin panel */}
          </div>{/* Fin contenedor */}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullModal;