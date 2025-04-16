'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { createAuthClient } from '@/lib/supabase';
import Link from 'next/link';
import Header from '@/components/Header';
import { openBoldCheckout } from '@/lib/bold';

// Type Definitions
type Wallet = { balance_cop: number; balance_fc: number; fuel_coins_claimed: boolean };
type Transaction = {
  id: string;
  type: 'deposit' | 'bet' | 'winning';
  amount: number;
  date: string;
  description: string;
};

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

export default function WalletPage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [wallet, setWallet] = useState<Wallet>({ balance_cop: 0, balance_fc: 0, fuel_coins_claimed: false });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('Participante');

  const fetchWalletData = useCallback(async () => {
    if (!isSignedIn || !user) return;

    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación.');
      const supabase = createAuthClient(token);

      const userId = user.id;

      const { data: userData } = await supabase
        .from('clerk_users')
        .select('username, full_name')
        .eq('clerk_id', user.id)
        .maybeSingle();
      const displayName = userData?.username || userData?.full_name || user.fullName || 'Participante';
      setUserName(displayName);

      const { data: walletData, error: walletError } = await supabase
        .from('wallet')
        .select('balance_cop, balance_fc, fuel_coins_claimed')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletError && walletError.code !== 'PGRST116') {
        throw new Error('Error al cargar la billetera: ' + walletError.message);
      }

      if (!walletData) {
        const { data: newWallet, error: insertError } = await supabase
          .from('wallet')
          .insert({ user_id: userId, balance_cop: 0, balance_fc: 0, fuel_coins_claimed: false })
          .select()
          .single();
        if (insertError) throw new Error('Error al crear la billetera: ' + insertError.message);
        setWallet(newWallet);
      } else {
        setWallet(walletData);
      }

      const { data: betResults, error: resultsError } = await supabase
        .from('pick_results')
        .select('id, payout, processed_at, gp_name, result')
        .eq('user_id', userId)
        .order('processed_at', { ascending: false })
        .limit(5);

      if (resultsError) throw new Error('Error al cargar resultados: ' + resultsError.message);

      const allTransactions: Transaction[] = (betResults || []).map((result) => ({
        id: result.id,
        type: 'winning',
        amount: result.payout,
        date: result.processed_at,
        description: `Resultado (${result.result}) en ${result.gp_name}`,
      }));

      setTransactions(allTransactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user, getToken]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const handleBoldDeposit = async () => {
    if (!user?.id || !user?.primaryEmailAddress) return;
    const orderId = `ORDER-${Date.now()}`;
    const response = await fetch('/api/bold/hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount: 20000, currency: 'COP' }),
    });

    const { hash } = await response.json();

    openBoldCheckout({
      apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
      orderId,
      amount: 20000,
      currency: 'COP',
      description: 'Depósito de $20.000 COP',
      redirectionUrl: 'https://motormaniacolombia.com/wallet',
      integritySignature: hash,
      customerData: {
        email: user?.primaryEmailAddress?.emailAddress,
        fullName: userName,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white p-8">
      <Header />
      <main className="max-w-4xl mx-auto">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="text-4xl font-bold text-center mb-8 font-exo2">
          Mi Billetera
        </motion.h1>

        <motion.div {...fadeInUp} className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8">
          <p className="text-gray-300 text-lg font-exo2">Balance actual:</p>
          <div className="mt-4 flex justify-around text-center">
            <div>
              <p className="text-gray-400">COP</p>
              <p className="text-green-400 text-2xl font-bold">${wallet.balance_cop.toLocaleString('es-CO')}</p>
            </div>
            <div>
              <p className="text-gray-400">MMC Coins</p>
              <p className="text-white text-2xl font-bold">{wallet.balance_cop / 1000}</p>
            </div>
            <div>
              <p className="text-gray-400">Fuel Coins</p>
              <p className="text-amber-400 text-2xl font-bold">{wallet.balance_fc}</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBoldDeposit}
              className="bg-gradient-to-r from-amber-500 to-cyan-500 text-white px-8 py-3 rounded-full font-semibold font-exo2 hover:from-amber-600 hover:to-cyan-600 transition-all"
            >
              Depositar $20.000 COP con Bold
            </motion.button>
          </div>
        </motion.div>

        <motion.div {...fadeInUp} className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4 font-exo2">Tus últimos resultados</h2>
          {loading ? (
            <p className="text-gray-400 font-exo2 text-center">Cargando transacciones...</p>
          ) : transactions.length === 0 ? (
            <p className="text-gray-400 font-exo2 text-center">No hay resultados recientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-white font-exo2 text-sm sm:text-base">
                <thead>
                  <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                    <th className="p-3 text-left">Fecha</th>
                    <th className="p-3 text-left">Descripción</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="border-b border-gray-700 hover:bg-gray-800"
                    >
                      <td className="p-3">
                        {new Date(tx.date).toLocaleString('es-CO', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3">{tx.description}</td>
                      <td className={`p-3 text-right ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString('es-CO')} COP
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
