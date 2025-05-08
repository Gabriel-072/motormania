// 📁 components/MMCGoSubHeader.tsx
'use client';

/* ─────────────────────────────────────────────────────────────
   SUB-HEADER: balances, promo dinámica y modal educativo
   ───────────────────────────────────────────────────────────── */

import React, { useEffect, useState }   from 'react';
import { useUser, useAuth }             from '@clerk/nextjs';
import { useRouter }                    from 'next/navigation';
import { createAuthClient }             from '@/lib/supabase';
import { motion, AnimatePresence }      from 'framer-motion';
import Link                             from 'next/link';
import { CoinsExplainModal }            from '@/components/CoinsExplainModal'; // ← named export

import {
  FaCoins, FaGasPump, FaWallet, FaLock
} from 'react-icons/fa';

/* ────────── types ────────── */
type Balances = {
  mmc        : number;
  locked_mmc : number;
  fuel       : number;
  locked_fuel: number;
};
type ModalContentType = 'mmc' | 'fuel';
type ActivePromo = {
  factor: number;
  type  : 'multiplier' | 'percentage';
};

export default function MMCGoSubHeader() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken }                   = useAuth();
  const router                         = useRouter();

  const [balances, setBalances] = useState<Balances>({
    mmc:0, locked_mmc:0, fuel:0, locked_fuel:0
  });
  const [promo, setPromo]       = useState<ActivePromo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<ModalContentType|null>(null);

  /* ────────── fetch balances + promo ────────── */
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    (async () => {
      setLoading(true);
      try {
        const token = await getToken({ template:'supabase' });
        if (!token) throw new Error('No Supabase token');
        const supabase = createAuthClient(token);

        /* Wallet */
        const { data: wal } = await supabase
          .from('wallet')
          .select('mmc_coins, locked_mmc, fuel_coins, locked_fuel')
          .eq('user_id', user.id)
          .single();
        if (wal) {
          setBalances({
            mmc        : wal.mmc_coins ?? 0,
            locked_mmc : wal.locked_mmc ?? 0,
            fuel       : wal.fuel_coins ?? 0,
            locked_fuel: wal.locked_fuel ?? 0,
          });
        }

        /* Promo */
        const { data: promoRow } = await supabase
          .from('deposit_promos')
          .select('factor, type')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (promoRow) setPromo({ factor: promoRow.factor, type: promoRow.type });
      } catch (err) {
        console.error('[MMCGoSubHeader] fetch error', err);
      } finally { setLoading(false); }
    })();
  }, [isLoaded,isSignedIn,user,getToken]);

  if (!isLoaded || !isSignedIn) return null;

  /* ────────── helpers ────────── */
  const openModal  = (t:ModalContentType) => { setModalContent(t); setModalOpen(true); };
  const promoCopy  = promo
    ? promo.type==='multiplier'
        ? promo.factor===3 ? 'Triplicamos'
          : promo.factor===2 ? 'Duplicamos'
          : `x${promo.factor}`
        : `${promo.factor}% extra`
    : 'Bono activo';

  /* tailwind util */
  const iconSize = 'h-3 w-3 sm:h-3.5 sm:w-3.5';

  /* ────────── JSX ────────── */
  return (
    <>
      <AnimatePresence>
        <motion.div
          key="subHeader"
          initial={{y:-80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-80,opacity:0}}
          transition={{duration:.35,ease:'easeOut'}}
          className="fixed top-0 inset-x-0 z-50 bg-gradient-to-br from-gray-950 via-black to-gray-800
                     border-b border-amber-600/25 shadow-xl px-2 py-1 sm:px-4 sm:py-2
                     text-white text-xs sm:text-sm font-exo2 flex flex-col sm:flex-row
                     items-center sm:justify-between gap-1 sm:gap-3">
          {/* balances */}
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            {/* MMC */}
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10
                         focus:outline-none focus:ring-1 focus:ring-amber-400
                         focus:ring-offset-1 focus:ring-offset-gray-900"
              onClick={()=>openModal('mmc')}
            >
              <FaCoins className={`text-cyan-400 ${iconSize}`}/>
              <span>MMC:</span>
              {loading
                ? <span className="animate-pulse bg-gray-700 h-3 w-8 rounded"/>
                : <>
                    <span>{balances.mmc.toLocaleString()}</span>
                    {balances.locked_mmc > 0 && (
                      <span className="flex items-center gap-0.5 text-yellow-400">
                        <FaLock className="h-2 w-2"/>+{balances.locked_mmc}
                      </span>
                    )}
                  </>}
            </button>

            {/* Fuel */}
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10
                         focus:outline-none focus:ring-1 focus:ring-amber-400
                         focus:ring-offset-1 focus:ring-offset-gray-900"
              onClick={()=>openModal('fuel')}
            >
              <FaGasPump className={`text-amber-400 ${iconSize}`}/>
              <span>Fuel:</span>
              {loading
                ? <span className="animate-pulse bg-gray-700 h-3 w-8 rounded"/>
                : <>
                    <span>{balances.fuel.toLocaleString()}</span>
                    {balances.locked_fuel > 0 && (
                      <span className="flex items-center gap-0.5 text-yellow-400">
                        <FaLock className="h-2 w-2"/>+
                        {balances.locked_fuel.toLocaleString()}
                      </span>
                    )}
                  </>}
            </button>
          </div>

          {/* botón wallet */}
          <button
            onClick={()=>router.push('/wallet')}
            disabled={loading}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400
                       text-black font-bold px-3 py-1 rounded
                       transform hover:scale-105 active:scale-95 transition"
          >
            <FaWallet className={iconSize}/>
            {promoCopy} tu primer depósito
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Modal info */}
      <CoinsExplainModal
        isOpen={isModalOpen}
        onClose={()=>setModalOpen(false)}
        title="⚙️ MMC & Fuel Coins"
      >
        {modalContent==='mmc' && (
          <div className="space-y-4 text-gray-200">
            <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
              <FaCoins/> MMC Coins
            </h3>
            <p>Bono de recompensa al recargar Fuel. Se usan primero si están bloqueados.</p>
          </div>
        )}
        {modalContent==='fuel' && (
          <div className="space-y-4 text-gray-200">
            <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
              <FaGasPump/> Fuel Coins
            </h3>
            <p>Moneda principal de juego: <strong>1 COP = 1 Fuel Coin</strong>.</p>
          </div>
        )}
      </CoinsExplainModal>
    </>
  );
}