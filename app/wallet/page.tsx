// 📁 app/wallet/page.tsx
'use client';

import React, { useEffect, useState }   from 'react';
import { useUser, useAuth }             from '@clerk/nextjs';
import { motion, AnimatePresence }      from 'framer-motion';
import dynamic                          from 'next/dynamic';
import Header                           from '@/components/Header';
import { createAuthClient }             from '@/lib/supabase';
import { openBoldCheckout }             from '@/lib/bold';
import { toast }                        from 'sonner';

import { FaArrowUp, FaArrowDown, FaSpinner } from 'react-icons/fa';
import { FaCoins, FaMoneyBillWave, FaCheckCircle, FaClock, FaExclamationCircle } from 'react-icons/fa';
import WalletCard                         from '@/components/WalletCard';
import ActionButton                       from '@/components/ActionButton';
import PlayThroughProgress                from '@/components/PlayThroughProgress';

/* Lazy modals */
const DepositModal  = dynamic(() => import('@/components/DepositModal'));
const WithdrawModal = dynamic(() => import('@/components/WithdrawModal'));

/* Types --------------------------------------------------------- */
interface WalletRow {
  balance_cop      : number;
  withdrawable_cop : number;
  mmc_coins        : number;
  locked_mmc       : number;
  fuel_coins       : number;
  locked_fuel      : number;
}
interface PromoProgress { remaining: number; total: number; }
type TxType = 'recarga'|'apuesta'|'ganancia'|'reembolso'|'retiro_pending'|'retiro';
interface Transaction { id: string; type: TxType; amount: number; description: string; created_at: string; }
const fmt = (n: number) => n.toLocaleString('es-CO');

/* Page ---------------------------------------------------------- */
export default function WalletPage() {
  const { isSignedIn, user } = useUser();
  const { getToken }         = useAuth();
  const uid                  = user?.id;

  const [wallet, setWallet]   = useState<WalletRow | null>(null);
  const [promo, setPromo]     = useState<PromoProgress | null>(null);
  const [txs, setTxs]         = useState<Transaction[]>([]);
  const [showDep, setDep]     = useState(false);
  const [showWith, setWith]   = useState(false);
  const [loadingW, setLW]     = useState(true);
  const [loadingT, setLT]     = useState(true);

  /* Realtime & initial fetch ----------------------------------- */
  useEffect(() => {
    if (!isSignedIn || !uid) return;
    let supabase: ReturnType<typeof createAuthClient>, chW: any, chT: any;

    (async () => {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      supabase = createAuthClient(token);

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
      chW = supabase.channel(`rt-wallet-${uid}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'wallet', filter: `user_id=eq.${uid}` },
          payload => setWallet(payload.new as WalletRow)
        )
        .subscribe();

      /* Realtime transactions */
      chT = supabase.channel(`rt-tx-${uid}`)
        .on('postgres_changes',
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

  /* Deposit ----------------------------------------------------- */
  const onDeposit = async (amount: number) => {
    if (!uid || !user) return;
    try {
      const orderId = `MM-DEP-${uid}-${Date.now()}`;
      const res = await fetch('/api/bold/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, currency: 'COP' })
      });
      if (!res.ok) throw new Error('Error generando firma');
      const { hash } = await res.json();
      if (!hash) throw new Error('Firma inválida');

      openBoldCheckout({
        apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
        orderId,
        amount: String(amount),
        currency: 'COP',
        description: `Recarga $${fmt(amount)} COP`,
        redirectionUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/wallet`,
        integritySignature: hash,
        customerData: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress ?? '',
          fullName: user.fullName || 'Jugador MMC',
        }),
        renderMode: 'embedded',
        onSuccess: () => {
          toast.success('✅ Recarga recibida, se reflejará pronto');
        },
        onFailed: ({ message }: { message?: string }) => {
          toast.error(`Algo salió mal: ${message ?? 'Intenta de nuevo.'}`);
        },
        onPending: () => {
          toast.info('Pago pendiente de confirmación.');
        },
        onClose: () => setDep(false),
      });
    } catch (e: any) {
      console.error(e);
      toast.error(
        'Algo salió mal al conectar con el comercio y Bold. Por favor, inténtalo más tarde.'
      );
    }
  };

  /* Withdraw ---------------------------------------------------- */
  const MIN = 10_000;
  const onWithdraw = async (amount: number, method: string, account: string) => {
    if (amount < MIN) { toast.error(`Mínimo $${fmt(MIN)}`); return; }
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, method, account })
    });
    if (res.ok) {
      toast.success('Solicitud de retiro enviada');
      setWith(false);
    } else {
      toast.error(await res.text());
    }
  };

  /* Tx icon helper --------------------------------------------- */
  const txIcon = (t: TxType) => {
    switch (t) {
      case 'recarga': return <FaArrowUp />;
      case 'ganancia': return <FaCoins />;
      case 'reembolso': return <FaCheckCircle />;
      case 'retiro_pending': return <FaClock />;
      case 'retiro': return <FaMoneyBillWave />;
      case 'apuesta': return <FaArrowDown />;
      default: return <FaExclamationCircle />;
    }
  };

  /* UI ---------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white pb-24 font-exo2">
      <Header />

      <main className="pt-16 max-w-3xl mx-auto px-4 sm:px-6 space-y-8">

        {/* WalletCard */}
        {wallet && (
          <WalletCard
            balanceCop={wallet.balance_cop}
            withdrawable={wallet.withdrawable_cop}
            fuel={wallet.fuel_coins}
            lockedFuel={wallet.locked_fuel}
            mmc={wallet.mmc_coins}
            lockedMmc={wallet.locked_mmc}
          />
        )}

        {/* Play-through */}
        {promo && promo.remaining > 0 && (
          <PlayThroughProgress remaining={promo.remaining} total={promo.total} />
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          <ActionButton title="Depositar" icon={<FaArrowUp />} color="amber" onClick={() => setDep(true)} />
          <ActionButton title="Retirar" icon={<FaArrowDown />} color="cyan" onClick={() => setWith(true)} />
        </div>

        {/* Transactions */}
        <section className="bg-gray-800/70 rounded-xl p-5 border border-gray-700/50 shadow">
          <h2 className="text-lg font-bold mb-4">Transacciones recientes</h2>
          {loadingT ? (
            <div className="flex justify-center py-10 text-gray-400 gap-2">
              <FaSpinner className="animate-spin" /> Cargando…
            </div>
          ) : txs.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Sin movimientos.</p>
          ) : (
            <ul className="divide-y divide-gray-700/80 -mb-3">
              {txs.map(t => (
                <li key={t.id} className="flex justify-between items-center py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{txIcon(t.type)}</span>
                    <div>
                      <p className="capitalize">{t.description || t.type}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(t.created_at).toLocaleString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.amount >= 0 ? '+' : '-'}${fmt(Math.abs(t.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showDep && <DepositModal onClose={() => setDep(false)} onDeposit={onDeposit} />}
        {showWith && wallet && (
          <WithdrawModal
            max={wallet.withdrawable_cop}
            onClose={() => setWith(false)}
            onSubmit={onWithdraw}
          />
        )}
      </AnimatePresence>
    </div>
  );
}