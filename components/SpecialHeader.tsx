// components/SpecialHeader.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { Howl } from 'howler';

export default function SpecialHeader() {
  
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [balances, setBalances] = useState<{ mmc: number; fuel: number } | null>(null);

  // Traer saldo de la wallet
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      const token = await getToken({ template: 'supabase' });
      const supabase = createAuthClient(token);
      const { data, error } = await supabase
        .from('wallet')
        .select('mmc_coins, fuel_coins')
        .eq('user_id', user?.id)
        .single();
      if (!error && data) {
        setBalances({ mmc: data.mmc_coins, fuel: data.fuel_coins });
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

  return (
    <header className="fixed top-0 inset-x-0 h-12 bg-black/90 flex items-center px-4 shadow-lg z-40">
      <Link href="/mmc-go" className="flex items-center gap-2">
        <img src="/logo-mmcgo.svg" alt="MotorManía GO" className="h-8" />
      </Link>

      <div className="ml-auto flex items-center gap-6">
        {balances ? (
          <>
            <div className="flex items-center gap-1 bg-gray-800/50 py-1 px-3 rounded-full">
              <span className="text-sm font-medium">MMC:</span>
              <span className="text-sm font-bold">{balances.mmc}</span>
            </div>
            <div className="flex items-center gap-1 bg-gray-800/50 py-1 px-3 rounded-full">
              <span className="text-sm font-medium">Fuel:</span>
              <span className="text-sm font-bold">{balances.fuel}</span>
            </div>
          </>
        ) : (
          <span className="text-sm text-gray-400">Cargando saldo…</span>
        )}

        <Link
          href="/wallet"
          className="text-sm font-semibold bg-amber-500 text-black py-1 px-3 rounded-full hover:bg-amber-600 transition"
        >
          Wallet
        </Link>
      </div>
    </header>
  );
}