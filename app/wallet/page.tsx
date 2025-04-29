// 📁 /app/wallet/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { createAuthClient } from '@/lib/supabase';
import { openBoldCheckout } from '@/lib/bold';
import {
  FaCoins, FaGasPump, FaMoneyBillWave, FaCheckCircle, FaClock,
  FaExclamationCircle, FaArrowUp, FaArrowDown, FaSpinner
} from 'react-icons/fa';

/* ---------- Types ---------- */
interface WalletRow {
  balance_cop: number;
  mmc_coins: number;
  fuel_coins: number;
  withdrawable_cop: number;
}
type TxType = 'recarga' | 'apuesta' | 'ganancia' | 'reembolso' | 'retiro_pending' | 'retiro';

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  created_at: string;
}

/* ---------- Helpers ---------- */
const fmt = (n: number) => n?.toLocaleString('es-CO') ?? '0';

/* ---------- Lazy Modals ---------- */
const DepositModal   = dynamic(() => import('@/components/DepositModal'));
const WithdrawModal  = dynamic(() => import('@/components/WithdrawModal'));

/* ---------- Page ---------- */
export default function WalletPage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const [wallet, setWallet]         = useState<WalletRow | null>(null);
  const [txs, setTxs]               = useState<Transaction[]>([]);
  const [showDeposit,  setDep]      = useState(false);
  const [showWithdraw, setWithd]    = useState(false);
  const [isWalletLoading, setWL]    = useState(true);
  const [isTxLoading, setTL]        = useState(true);
  const [generalError, setErr]      = useState<string | null>(null);

  const uid = user?.id ?? null;

  /* ---------- Realtime sync ---------- */
  useEffect(() => {
    if (!isSignedIn || uid === null) { setWL(false); setTL(false); return; }

    let supabase: ReturnType<typeof createAuthClient>;
    let wCh: any, tCh: any;
    let mounted = true;

    (async () => {
      setWL(true); setTL(true); setErr(null);
      const token = await getToken({ template: 'supabase' });
      supabase = createAuthClient(token ?? null);

      /* initial wallet */
      const { data: w, error: we } = await supabase
        .from('wallet')
        .select('balance_cop, mmc_coins, fuel_coins, withdrawable_cop')
        .eq('user_id', uid)
        .maybeSingle();
      if (we) { setErr(we.message); }
      else if (mounted) setWallet(w);

      /* initial tx */
      const { data: t, error: te } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(30);
      if (te) setErr(te.message);
      else if (mounted) setTxs(t || []);

      /* realtime wallet */
      wCh = supabase.channel(`rt-wallet-${uid}`)
        .on('postgres_changes',
            { event:'*', schema:'public', table:'wallet', filter:`user_id=eq.${uid}` },
            (p) => mounted && setWallet(p.new as WalletRow))
        .subscribe();

      /* realtime tx */
      tCh = supabase.channel(`rt-tx-${uid}`)
        .on('postgres_changes',
            { event:'INSERT', schema:'public', table:'transactions', filter:`user_id=eq.${uid}` },
            (p) => mounted && setTxs(prev => [p.new as Transaction, ...prev].slice(0,30)))
        .subscribe();

      setWL(false); setTL(false);
    })();

    return () => { mounted = false; wCh?.unsubscribe(); tCh?.unsubscribe(); };
  }, [isSignedIn, uid, getToken]);

  /* ---------- Deposit ---------- */
  const startDeposit = async (amount: number) => {
    if (!uid || !user) throw new Error('No auth');
    const orderId = `MM-WAL-${uid}-${Date.now()}`;

    const r = await fetch('/api/bold/hash', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ orderId, amount, currency:'COP' })
    });
    if (!r.ok) throw new Error((await r.json()).message);

    const { hash } = await r.json();
    openBoldCheckout({
      apiKey : process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
      orderId,
      amount : String(amount),                 // Bold espera string
      currency:'COP',
      description:`Recarga de $${fmt(amount)} COP`,
      redirectionUrl:`${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/wallet`,
      integritySignature:hash,
      customerData:{ email:user.primaryEmailAddress?.emailAddress ?? '', fullName:user.fullName||'Player' }
    });
    setDep(false);
  };

  /* ---------- Withdraw ---------- */
  const MIN_WITHDRAW = 10_000;

  const submitWithdraw = async (amount: number, method: string, account: string) => {
    const res = await fetch('/api/withdraw', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ amount, method, account })
    });
    if (!res.ok) throw new Error(await res.text());
    setWithd(false);                       // se actualizará vía realtime
  };

  /* ---------- Tx icon helper ---------- */
  const txStyle = (type: TxType) => {
    switch (type) {
      case 'recarga'        : return { icon:<FaArrowUp/>,       color:'text-green-400' };
      case 'ganancia'       : return { icon:<FaCoins/>,         color:'text-amber-400' };
      case 'reembolso'      : return { icon:<FaCheckCircle/>,   color:'text-cyan-400' };
      case 'retiro_pending' : return { icon:<FaClock/>,         color:'text-yellow-400' };
      case 'retiro'         : return { icon:<FaMoneyBillWave/>, color:'text-red-400' };
      case 'apuesta'        : return { icon:<FaArrowDown/>,     color:'text-red-400' };
      default               : return { icon:<FaExclamationCircle/>, color:'text-gray-400' };
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white pb-24 font-exo2">
      <Header/>

      <main className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Balances */}
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} transition={{duration:.3}}
          className="sticky top-[100px] z-20 flex flex-wrap items-center gap-3 bg-gray-900/90 backdrop-blur border border-gray-700/40 rounded-xl px-4 py-3 mb-7 shadow-lg">
          <Balance label="COP"  value={wallet?.balance_cop ?? 0}  color="text-green-400" prefix="$" isLoading={isWalletLoading}/>
          <Balance label="MMC"  value={wallet?.mmc_coins   ?? 0}  color="text-white"           isLoading={isWalletLoading}/>
          <Balance label="Fuel" value={wallet?.fuel_coins  ?? 0}  color="text-amber-400"       isLoading={isWalletLoading}/>

          <button onClick={()=>setDep(true)}
            className="ml-auto bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-full px-4 py-1.5 text-sm shadow active:scale-95">
            Recargar
          </button>
        </motion.div>

        {/* Saldo retirable + botón de retiro */}
        {!isWalletLoading && !generalError && (
          <motion.section initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.1}}
            className="bg-gray-800/70 rounded-xl p-5 mb-6 border border-gray-700/50 shadow">
            <p className="text-sm text-gray-300">Saldo retirable</p>
            <p className="text-2xl font-bold text-cyan-400">${fmt(wallet?.withdrawable_cop ?? 0)}</p>
            { (wallet?.withdrawable_cop ?? 0) >= MIN_WITHDRAW && (
              <button onClick={()=>setWithd(true)}
                className="mt-3 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-full px-4 py-1.5 text-sm shadow active:scale-95">
                Solicitar retiro
              </button>
            )}
          </motion.section>
        )}

        {/* Transacciones */}
        <motion.section initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.2}}
          className="bg-gray-800/70 rounded-xl p-5 border border-gray-700/50 shadow">
          <h2 className="text-lg font-bold mb-4">Transacciones recientes</h2>
          {isTxLoading ? (
            <div className="flex justify-center py-6 text-gray-400"><FaSpinner className="animate-spin text-xl"/></div>
          ) : txs.length===0 ? (
            <p className="text-gray-400 text-center py-4">No hay movimientos recientes.</p>
          ) : (
            <ul className="divide-y divide-gray-700/80 -mb-3">
              <AnimatePresence initial={false}>
                {txs.map((t,i)=>{ const {icon,color}=txStyle(t.type); return(
                  <motion.li key={t.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                    exit={{opacity:0,x:-10}} transition={{delay:i*0.02}}
                    className="flex items-center justify-between py-3 text-sm hover:bg-gray-700/30 px-1 rounded">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <span className={`text-lg ${color}`}>{icon}</span>
                      <div>
                        <p className="text-white font-medium capitalize">{t.description || t.type.replace('_',' ')}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(t.created_at).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                    <span className={`font-semibold ${color}`}>{t.amount>=0?'+':'-'}${fmt(Math.abs(t.amount))}</span>
                  </motion.li>
                );})}
              </AnimatePresence>
            </ul>
          )}
        </motion.section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showDeposit  && <DepositModal  onClose={()=>setDep(false)}  onDeposit={startDeposit}/> }
        {showWithdraw && <WithdrawModal max={wallet?.withdrawable_cop ?? 0}
                                        onClose={()=>setWithd(false)}
                                        onSuccess={()=>{/* realtime actualiza */}}/>}
      </AnimatePresence>

      {/* Error global */}
      {generalError && (
        <div className="fixed bottom-4 inset-x-0 px-4">
          <div className="bg-red-900/60 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center text-sm">
            {generalError}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Balance pill ---------- */
function Balance({label,value,color,prefix='',isLoading}:{label:string,value:number,color:string,prefix?:string,isLoading?:boolean}) {
  return (
    <div className="text-center flex-1 min-w-[70px]">
      <p className="text-[11px] uppercase text-gray-400">{label}</p>
      <div className="h-7 flex justify-center items-center">
        {isLoading
          ? <FaSpinner className="animate-spin text-gray-500 text-base"/>
          : <p className={`text-lg font-bold ${color}`}>{prefix}{fmt(value)}</p>}
      </div>
    </div>
  );
}