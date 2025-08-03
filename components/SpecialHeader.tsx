// components/SpecialHeader.tsx - Simplified Cash Only
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { FaMoneyBillWave } from 'react-icons/fa';

export default function SpecialHeader() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  // Fetch cash balance only
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) return;
        
        const supabase = createAuthClient(token);
        const { data, error } = await supabase
          .from('wallet')
          .select('balance_cop')
          .eq('user_id', user?.id)
          .single();
          
        if (!error && data) {
          setBalance(data.balance_cop);
        }
      } catch (error) {
        console.warn('Error fetching wallet balance:', error);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, user?.id]);

  const formatCurrency = (amount: number) => `$${amount.toLocaleString('es-CO')}`;

  return (
    <header className="fixed top-0 inset-x-0 h-12 bg-black/90 flex items-center px-4 shadow-lg z-40">
      <Link href="/mmc-go" className="flex items-center gap-2">
        <img src="/logo-mmcgo.svg" alt="MotorManía GO" className="h-8" />
      </Link>

      <div className="ml-auto flex items-center gap-6">
        {/* Cash Balance Display */}
        {balance !== null ? (
          <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/30 py-1 px-3 rounded-full">
            <FaMoneyBillWave className="text-green-400 h-4 w-4" />
            <span className="text-sm font-medium text-green-300">Balance:</span>
            <span className="text-sm font-bold text-white">{formatCurrency(balance)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-gray-800/50 py-1 px-3 rounded-full">
            <div className="animate-pulse flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-600 rounded"></div>
              <span className="text-sm text-gray-400">Cargando...</span>
            </div>
          </div>
        )}

        {/* Wallet Link */}
        <Link
          href="/wallet"
          className="text-sm font-semibold bg-green-500 text-black py-1 px-3 rounded-full hover:bg-green-600 transition-colors"
        >
          Wallet
        </Link>
      </div>
    </header>
  );
}