// 📁 app/wallet/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { createAuthClient } from '@/lib/supabase';
import { openBoldCheckout } from '@/lib/bold';
import { toast } from 'sonner';

import {
  FaArrowUp,
  FaArrowDown,
  FaSpinner,
  FaCoins,
  FaMoneyBillWave,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaTicketAlt,
  FaFileInvoiceDollar
} from 'react-icons/fa';
import WalletCard from '@/components/WalletCard';
import RedeemCodeModal from '@/components/RedeemCodeModal';
import ActionButton from '@/components/ActionButton';
import PlayThroughProgress from '@/components/PlayThroughProgress';

/* Lazy modals */
const DepositModal = dynamic(() => import('@/components/DepositModal'));
const WithdrawModal = dynamic(() => import('@/components/WithdrawModal'));

/* Types --------------------------------------------------------- */
interface WalletRow {
  balance_cop: number;
  withdrawable_cop: number;
  mmc_coins: number;
  locked_mmc: number;
  fuel_coins: number;
  locked_fuel: number;
}
interface PromoProgress { remaining: number; total: number; }
type TxType = 'recarga'|'apuesta'|'ganancia'|'reembolso'|'retiro_pending'|'retiro';
interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  created_at: string;
}
const fmt = (n: number) => n.toLocaleString('es-CO');

export default function WalletPage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const uid = user?.id;

  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [promo, setPromo] = useState<PromoProgress | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [showDep, setDep] = useState(false);
  const [showWith, setWith] = useState(false);
  const [showRedeem, setRedeem] = useState(false);
  const [loadingW, setLW] = useState(true);
  const [loadingT, setLT] = useState(true);

  /* Realtime & initial fetch */
  useEffect(() => {
    if (!isSignedIn || !uid) return;
    let supabase: ReturnType<typeof createAuthClient>, chW: any, chT: any;

    (async () => {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      supabase = createAuthClient(token);

      setLW(true);
      setLT(true);

      /* Wallet */
      const { data: w } = await supabase
        .from('wallet')
        .select('balance_cop,withdrawable_cop,mmc_coins,locked_mmc,fuel_coins,locked_fuel')
        .eq('user_id', uid)
        .single();
      setWallet(w || null);
      setLW(false);

      /* Promo progress */
      const { data: pr } = await supabase
        .from('promotions_user')
        .select('wager_remaining_mmc, locked_amount_mmc')
        .eq('user_id', uid)
        .eq('status', 'active')
        .maybeSingle();
      if (pr) setPromo({ remaining: pr.wager_remaining_mmc, total: pr.locked_amount_mmc * 2 });

      /* Transactions */
      const { data: ts } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(30);
      setTxs(ts || []);
      setLT(false);

      /* Realtime wallet */
      chW = supabase
        .channel(`wallet-page-rt-wallet-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wallet', filter: `user_id=eq.${uid}` },
          payload => setWallet(payload.new as WalletRow)
        )
        .subscribe();

      /* Realtime transactions */
      chT = supabase
        .channel(`wallet-page-rt-tx-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${uid}` },
          payload => setTxs(prev => [payload.new as Transaction, ...prev].slice(0, 30))
        )
        .subscribe();
    })();

    return () => {
      chW?.unsubscribe();
      chT?.unsubscribe();
    };
  }, [isSignedIn, uid, getToken]);

  /* Deposit handler – usa SIEMPRE los valores que regresa el API */
const onDeposit = async (amount: number) => {
  if (!uid || !user) return;

  try {
    /* 1. Pide la firma al backend (solo envía el monto) */
    const res = await fetch('/api/bold/hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency: 'COP' })
    });

    if (!res.ok) throw new Error('Error generando firma');

    /* 2. El backend devuelve todo lo necesario */
    const {
      orderId,          // ← el que usó para firmar
      amount: amtStr,   // string
      callbackUrl,      // URL a la que debe redirigir Bold
      integrityKey      // firma SHA-256
    }: {
      orderId: string;
      amount: string;
      callbackUrl: string;
      integrityKey: string;
    } = await res.json();

    /* 3. Lanza Bold con ESOS datos */
    openBoldCheckout({
      apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
      orderId,                     // usa el del backend
      amount: amtStr,              // idem
      currency: 'COP',
      description: `Recarga ${amtStr} COP`,
      redirectionUrl: callbackUrl, // idem
      integritySignature: integrityKey,
      customerData: JSON.stringify({
        email: user.primaryEmailAddress?.emailAddress ?? '',
        fullName: user.fullName || 'Jugador MMC',
      }),
      renderMode: 'embedded',

      onSuccess: () => toast.success('✅ Recarga recibida, se reflejará pronto'),
      onFailed: (err: { message?: string }) =>
        toast.error(`Algo salió mal: ${err.message ?? 'Intenta de nuevo.'}`),
      onPending: () => toast.info('Pago pendiente de confirmación.'),
      onClose: () => setDep(false),
    });
  } catch (e: any) {
    console.error(e);
    toast.error('Algo salió mal al conectar con Bold. Por favor, inténtalo más tarde.');
  }
};

  /* Withdraw handler */
  const MIN_WITHDRAWAL = 10_000;
  const onWithdraw = async (amount: number, method: string, account: string) => {
    if (amount < MIN_WITHDRAWAL) {
      toast.error(`Mínimo de retiro $${fmt(MIN_WITHDRAWAL)}`);
      return;
    }
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, method, account })
    });
    if (res.ok) {
      toast.success('Solicitud de retiro enviada');
      setWith(false);
    } else {
      toast.error(await res.text() || 'Error al procesar el retiro.');
    }
  };

  /* Tx icon helper */
  const getTxIcon = (type: TxType) => {
    switch (type) {
      case 'recarga':        return <FaArrowUp className="text-green-400" />;
      case 'ganancia':       return <FaCoins className="text-yellow-400" />;
      case 'reembolso':      return <FaCheckCircle className="text-sky-400" />;
      case 'retiro_pending': return <FaClock className="text-orange-400" />;
      case 'retiro':         return <FaMoneyBillWave className="text-red-500" />;
      case 'apuesta':        return <FaArrowDown className="text-red-400" />;
      default:               return <FaExclamationCircle className="text-gray-400" />;
    }
  };

  const emptyWallet: WalletRow = {
    balance_cop: 0,
    withdrawable_cop: 0,
    mmc_coins: 0,
    locked_mmc: 0,
    fuel_coins: 0,
    locked_fuel: 0,
  };
  const displayWallet = wallet ?? emptyWallet;

  /* Variants for animation */
  const mainVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };
  const listItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' }
    }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white pb-24 font-exo2 antialiased">
      <Header />

      <motion.main
        className="pt-20 sm:pt-24 max-w-3xl mx-auto px-4 sm:px-6 space-y-10"
        variants={mainVariants}
        initial="hidden"
        animate="visible"
      >
        <WalletCard
          balanceCop={displayWallet.balance_cop}
          withdrawable={displayWallet.withdrawable_cop}
          fuel={displayWallet.fuel_coins}
          lockedFuel={displayWallet.locked_fuel}
          mmc={displayWallet.mmc_coins}
          lockedMmc={displayWallet.locked_mmc}
        />

        {promo && promo.remaining > 0 && (
          <PlayThroughProgress remaining={promo.remaining} total={promo.total} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActionButton title="Depositar" icon={<FaArrowUp />} color="amber" onClick={() => setDep(true)} />
          <ActionButton title="Retirar" icon={<FaArrowDown />} color="cyan" onClick={() => setWith(true)} />
          <ActionButton title="Código Promocional" icon={<FaTicketAlt />} color="emerald" onClick={() => setRedeem(true)} />
        </div>

        <section className="bg-gradient-to-br from-gray-800/70 via-black/50 to-gray-900/70 rounded-xl shadow-xl border border-gray-700/50">
          <div className="p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-1">Historial de Transacciones</h2>
            <p className="text-sm text-gray-400 mb-6">Un resumen de tus actividades recientes en la plataforma.</p>

            {loadingT ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                <FaSpinner className="animate-spin text-3xl text-sky-400" />
                <p className="text-lg">Cargando transacciones…</p>
              </div>
            ) : txs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-4 text-center">
                <FaFileInvoiceDollar className="text-5xl opacity-30" />
                <p className="text-lg font-medium mt-2">Aún no hay movimientos.</p>
                <p className="text-sm">Cuando realices una recarga o participes, tus transacciones aparecerán aquí.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {txs.map((t, index) => (
                  <motion.li
                    key={t.id}
                    custom={index}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex justify-between items-center py-3.5 px-3 rounded-lg hover:bg-gray-700/70 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-700/80 text-xl shrink-0">
                        {getTxIcon(t.type)}
                      </span>
                      <div className="flex-grow">
                        <p className="font-medium text-gray-100 capitalize text-sm sm:text-base">
                          {t.description || t.type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(t.created_at).toLocaleString('es-CO', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true
                          })}
                        </p>
                      </div>
                    </div>
                    <span className={`font-semibold text-sm sm:text-base whitespace-nowrap pl-2 ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.amount >= 0 ? '+' : ''}{fmt(t.amount)} COP
                    </span>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </motion.main>

      <AnimatePresence>
        {showDep && <DepositModal onClose={() => setDep(false)} onDeposit={onDeposit} />}
        {showWith && (
          <WithdrawModal
            max={displayWallet.withdrawable_cop}
            onClose={() => setWith(false)}
            onSubmit={onWithdraw}
          />
        )}
        {showRedeem && <RedeemCodeModal onClose={() => setRedeem(false)} />}
      </AnimatePresence>
    </div>
  );
}