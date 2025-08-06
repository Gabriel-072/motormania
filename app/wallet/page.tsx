// app/wallet/page.tsx - Fixed TypeScript Errors
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { createAuthClient } from '@/lib/supabase';
import { openBoldCheckout } from '@/lib/bold';
import useAutoRedeem from '@/hooks/useAutoRedeem';
import { toast } from 'sonner';

import {
  FaArrowUp,
  FaArrowDown,
  FaSpinner,
  FaMoneyBillWave,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaTicketAlt,
  FaFileInvoiceDollar,
  FaPlay,
  FaGift
} from 'react-icons/fa';

import WalletCard from '@/components/WalletCard';
import RedeemCodeModal from '@/components/RedeemCodeModal';
import ActionButton from '@/components/ActionButton';
import PlayThroughProgress from '@/components/PlayThroughProgress';
import PicksResumen from '@/components/PicksResumen'

/* Lazy modals */
const DepositModal  = dynamic(() => import('@/components/DepositModal'));
const WithdrawModal = dynamic(() => import('@/components/WithdrawModal'));

// Simplified transaction types (cash only)
type TxType = 'recarga'|'jugada'|'ganancia'|'reembolso'|'retiro_pending'|'retiro'|'gasto'|'promo_bonus';

// 🔥 FIXED: Simplified wallet interface (cash only)
interface WalletRow {
  balance_cop: number;
  withdrawable_cop: number;
}

interface PromoProgress {
  remaining: number;
  total: number;
}

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  created_at: string;
  // Optional promotional fields
  original_amount?: number;
  total_effective?: number;
}

const fmt = (n: number) => n.toLocaleString('es-CO');

function WalletContent() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const uid = user?.id;

  // Simplified state (no coin balances)
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [promo, setPromo] = useState<PromoProgress | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [hasDeposited, setHasDeposited] = useState(false);
  const [showDep, setDep] = useState(false);
  const [showWith, setWith] = useState(false);
  const [showRedeem, setRedeem] = useState(false);
  const [loadingW, setLW] = useState(true);
  const [loadingT, setLT] = useState(true);

  // Auto‐redeem promo codes from ?code=
  useAutoRedeem();

  // Simplified wallet fetch & realtime subscriptions
  useEffect(() => {
    if (!isSignedIn || !uid) return;
    let sb: ReturnType<typeof createAuthClient>, chW: any, chT: any;

    (async () => {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      sb = createAuthClient(token);

      setLW(true);
      setLT(true);

      // 🔥 FIXED: Simplified wallet fetch (cash only)
      const { data: w } = await sb
        .from('wallet')
        .select('balance_cop,withdrawable_cop')
        .eq('user_id', uid)
        .single();
      
      // 🔥 FIXED: Proper type handling
      if (w) {
        setWallet({
          balance_cop: w.balance_cop || 0,
          withdrawable_cop: w.withdrawable_cop || 0
        });
      } else {
        setWallet({ balance_cop: 0, withdrawable_cop: 0 });
      }
      setLW(false);

      // Promo progress (if you still use this)
      const { data: pr } = await sb
        .from('promotions_user')
        .select('wager_remaining_mmc, locked_amount_mmc')
        .eq('user_id', uid)
        .eq('status', 'active')
        .maybeSingle();
      if (pr) {
        setPromo({
          remaining: pr.wager_remaining_mmc,
          total: pr.locked_amount_mmc * 2
        });
      }

      // Check if user has made at least one deposit
      const { count: recargas } = await sb
        .from('transactions')
        .select('id', { count: 'exact' })
        .eq('user_id', uid)
        .eq('type', 'recarga');
      setHasDeposited((recargas ?? 0) > 0);

      // Get regular transactions
      const { data: regularTxs } = await sb
        .from('transactions')
        .select('id,type,amount,description,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20);

      // Get promotional applications (if you want to show them)
      const { data: promoTxs } = await sb
        .from('user_promo_applications')
        .select(`
          id,
          original_amount,
          bonus_amount,
          total_effective_amount,
          applied_at,
          status,
          promotional_campaigns(name)
        `)
        .eq('user_id', uid)
        .order('applied_at', { ascending: false })
        .limit(10);

      // Combine transactions
      const combinedTxs = [
        ...(regularTxs || []),
        ...(promoTxs || []).map(promo => ({
          id: promo.id,
          type: 'promo_bonus' as const,
          amount: promo.bonus_amount,
          description: `Bono aplicado: ${(promo.promotional_campaigns as any)?.name || 'Promoción'}`,
          created_at: promo.applied_at,
          original_amount: promo.original_amount,
          total_effective: promo.total_effective_amount
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTxs(combinedTxs);
      setLT(false);

      // 🔥 FIXED: Simplified realtime wallet updates (cash only)
      chW = sb
        .channel(`wallet-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wallet', filter: `user_id=eq.${uid}` },
          payload => {
            const newData = payload.new as any;
            setWallet({
              balance_cop: newData.balance_cop || 0,
              withdrawable_cop: newData.withdrawable_cop || 0
            });
          }
        )
        .subscribe();

      // Realtime transactions
      chT = sb
        .channel(`tx-${uid}`)
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

  // Deposit handler (unchanged)
  const onDeposit = async (amount: number) => {
    if (!uid || !user) return;

    try {
      const res = await fetch('/api/transactions/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      if (!res.ok) throw new Error('Error generando firma');
      const { orderId, amount: amtStr, callbackUrl, integrityKey } = await res.json();

      openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_API_KEY!,
        orderId,
        amount: amtStr,
        currency: 'COP',
        description: `Depósito MMC GO - ${user.fullName}`,
        integritySignature: integrityKey,
        redirectionUrl: callbackUrl,
        customerData: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress,
          fullName: user.fullName
        }),
        renderMode: 'embedded',
        onSuccess: () => {
          toast.success('Depósito exitoso');
          setDep(false);
        },
        onFailed: () => toast.error('Error en el depósito'),
        onClose: () => setDep(false)
      });
    } catch (err) {
      console.error('Deposit error:', err);
      toast.error('Error iniciando depósito');
    }
  };

  // Get transaction icon
  const getTransactionIcon = (type: TxType) => {
    switch (type) {
      case 'recarga': return <FaArrowUp className="text-green-400" />;
      case 'jugada': case 'gasto': return <FaPlay className="text-blue-400" />;
      case 'ganancia': return <FaCheckCircle className="text-emerald-400" />;
      case 'retiro': case 'retiro_pending': return <FaArrowDown className="text-red-400" />;
      case 'promo_bonus': return <FaGift className="text-purple-400" />;
      default: return <FaMoneyBillWave className="text-gray-400" />;
    }
  };

  // Get transaction description
  const getTransactionDescription = (tx: Transaction) => {
    if (tx.type === 'promo_bonus') {
      return (
        <div>
          <div className="font-medium">{tx.description}</div>
          {tx.original_amount && tx.total_effective && (
            <div className="text-xs text-gray-400">
              Jugada: ${tx.original_amount.toLocaleString('es-CO')} → 
              Efectivo: ${tx.total_effective.toLocaleString('es-CO')}
            </div>
          )}
        </div>
      );
    }
    return tx.description;
  };

  // Get amount display
  const getAmountDisplay = (tx: Transaction) => {
    if (tx.type === 'promo_bonus') {
      return (
        <div className="text-right">
          <div className="font-bold text-purple-400">
            +${tx.amount.toLocaleString('es-CO')}
          </div>
          <div className="text-xs text-gray-400">Bono aplicado</div>
        </div>
      );
    }
    
    const isPositive = ['recarga', 'ganancia'].includes(tx.type);
    return (
      <span className={`font-bold ${
        isPositive ? 'text-green-400' : 'text-gray-300'
      }`}>
        {isPositive ? '+' : ''}${fmt(tx.amount)}
      </span>
    );
  };

  // 🔥 FIXED: Simplified wallet display (cash only) with proper fallback
  const displayWallet = wallet || { balance_cop: 0, withdrawable_cop: 0 };

  const mainVar = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };
  const itemVar = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.05, duration: 0.3 }
    })
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white pb-24 font-exo2 antialiased">
      <Header />

      <motion.main
        className="pt-20 sm:pt-24 max-w-3xl mx-auto px-4 sm:px-6 space-y-10"
        variants={mainVar}
        initial="hidden"
        animate="visible"
      >
        {/* 🔥 FIXED: Simplified Wallet Card (cash only) */}
        <WalletCard
          balanceCop={displayWallet.balance_cop}
          withdrawableCop={displayWallet.withdrawable_cop}
        />

        {/* Promo progress (if still needed) */}
        {hasDeposited && promo && promo.remaining > 0 && (
          <PlayThroughProgress remaining={promo.remaining} total={promo.total} />
        )}

        {/* 🔥 FIXED: Action buttons with correct colors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActionButton
            title="Depositar"
            icon={<FaArrowUp />}
            color="emerald"
            onClick={() => setDep(true)}
          />
          <ActionButton
            title="Retirar"
            icon={<FaArrowDown />}
            color="cyan"
            onClick={() => setWith(true)}
          />
          <ActionButton
            title="Código Promocional"
            icon={<FaTicketAlt />}
            color="amber"
            onClick={() => setRedeem(true)}
          />
        </div>

        {/* Transaction History */}
        <section className="bg-gradient-to-br from-gray-800/70 via-black/50 to-gray-900/70 rounded-xl shadow-xl border border-gray-700/50">
          <div className="p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-1">
              Historial de Transacciones
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Un resumen de tus actividades recientes en la plataforma.
            </p>

            {loadingT ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                <FaSpinner className="animate-spin text-3xl text-sky-400" />
                <p className="text-lg">Cargando transacciones…</p>
              </div>
            ) : txs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                <FaFileInvoiceDollar className="text-4xl" />
                <p className="text-lg">No hay transacciones aún</p>
                <p className="text-sm">Haz tu primer depósito para comenzar</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {txs.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    variants={itemVar}
                    initial="hidden"
                    animate="visible"
                    custom={index}
                    className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                      tx.type === 'promo_bonus' 
                        ? 'bg-purple-900/20 border border-purple-500/20' 
                        : 'bg-gray-800/50 hover:bg-gray-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-gray-700/50">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        {getTransactionDescription(tx)}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(tx.created_at).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {getAmountDisplay(tx)}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Picks Summary */}
        <PicksResumen />
      </motion.main>

      {/* 🔥 FIXED: Modals */}
      <AnimatePresence>
        {showDep && <DepositModal onClose={() => setDep(false)} onDeposit={onDeposit} />}
        {showWith && (
          <WithdrawModal 
            onClose={() => setWith(false)}
            max={displayWallet.withdrawable_cop}
            onSubmit={async (amount, method, account) => {
              console.log('Withdraw requested:', { amount, method, account });
              // TODO: Implement withdrawal logic
              setWith(false);
            }}
          />
        )}
        {showRedeem && <RedeemCodeModal onClose={() => setRedeem(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center">
        <FaSpinner className="animate-spin text-4xl text-amber-500" />
      </div>
    }>
      <WalletContent />
    </Suspense>
  );
}