// /Users/imgabrieltoro/Projects/motormania/components/MMCGoSubHeader.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase'; // Adjust path if needed
import { motion, AnimatePresence } from 'framer-motion';
// Ensure this path is correct based on your project structure
import { CoinsExplainModal } from '@/components/CoinsExplainModal'; // Adjust path if needed

// Import necessary icons
import { FaCoins, FaGasPump, FaWallet } from 'react-icons/fa';

// Type for wallet balances
type Balances = {
  mmc: number;
  fuel: number;
};

// Type to determine which modal content to show
type ModalContentType = 'mmc' | 'fuel';

export default function MMCGoSubHeader() {
  // Hooks for Clerk authentication and user data
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  // Hook for navigation
  const router = useRouter();

  // State for wallet balances
  const [balances, setBalances] = useState<Balances | null>(null);
  // State to track loading status
  const [isLoading, setIsLoading] = useState(true);
  // State for modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);
  // State to determine which content to show in the modal
  const [modalContent, setModalContent] = useState<ModalContentType | null>(null);

  // --- Modal Handlers ---
  const openModal = (type: ModalContentType) => {
    setModalContent(type);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Effect to fetch wallet balances
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setIsLoading(!isLoaded);
      return;
    }
    if (balances !== null) { // Avoid refetch if balances already loaded
      setIsLoading(false);
      return;
    }
    let mounted = true;
    setIsLoading(true);
    const fetchBalances = async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) {
          console.error('Failed to get Supabase token.');
          if (mounted) setBalances({ mmc: 0, fuel: 0 });
          return;
        }
        const supabase = createAuthClient(token);
        const { data, error } = await supabase
          .from('wallet')
          .select('mmc_coins, fuel_coins')
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') { // Wallet not found
            if (mounted) setBalances({ mmc: 0, fuel: 0 });
          } else {
            console.error('Error fetching wallet balances:', error.message);
            if (mounted) setBalances({ mmc: 0, fuel: 0 });
          }
        } else if (data && mounted) {
          setBalances({ mmc: data.mmc_coins ?? 0, fuel: data.fuel_coins ?? 0 });
        }
      } catch (err) {
        console.error('Failed to load balances:', err);
        if (mounted) setBalances({ mmc: 0, fuel: 0 });
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchBalances();
    return () => { mounted = false; };
  }, [isLoaded, isSignedIn, user, getToken, balances]); // `balances` added to prevent re-fetch loop once loaded

  if (!isLoaded) return null;

  const mmcAmount = balances?.mmc;
  const fuelAmount = balances?.fuel;

  // --- Aggressively Compact Tailwind Class Definitions for Mobile ---
  const containerClasses = `
    fixed top-0 inset-x-0 z-50
    bg-gradient-to-br from-gray-950 via-black to-gray-800
    border-b border-amber-600/25
    shadow-xl
    px-2 py-1                  /* MOBILE: Very minimal horizontal & vertical padding */
    sm:px-4 sm:py-2           /* SM: Slightly more padding */
    font-exo2 text-white
    text-xs                     /* MOBILE: Smallest practical text size */
    sm:text-sm                  /* SM: Restore to slightly larger text */
    flex flex-col sm:flex-row items-center sm:justify-between
    gap-1 sm:gap-3              /* MOBILE: Minimal gap between balances & wallet button */
    transition-all duration-300
  `;

  const balancesContainerClasses = `
    flex flex-row items-center justify-center sm:justify-start
    gap-2 sm:gap-3              /* MOBILE: Minimal horizontal gap between MMC/FUEL */
    w-full sm:w-auto flex-wrap
  `;

  const balanceItemClasses = `
    flex items-center justify-center
    gap-1 sm:gap-1.5            /* MOBILE: Minimal internal gap */
    p-0.5 sm:p-1                /* MOBILE: Minimal internal padding */
    rounded hover:bg-white/10 transition-colors duration-200 /* sm:rounded-md if different radius needed */
    cursor-pointer
    focus:outline-none focus:ring-1 focus:ring-amber-400 focus:ring-offset-1 focus:ring-offset-gray-900
  `;

  const iconSizeClass = "h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0"; // Smallest practical icons

  const dividerClass = `
    hidden sm:block h-3.5 sm:h-4 w-px bg-gray-600
  `;

  const buttonClasses = `
    w-full sm:w-auto bg-amber-500 text-black font-bold
    px-3 py-1                  /* MOBILE: Minimal padding */
    sm:px-4 sm:py-1.5          /* SM: Slightly more padding */
    text-xs sm:text-sm          /* Match container text size */
    rounded hover:bg-amber-400 hover:shadow-md /* sm:rounded-md if different radius needed */
    focus:outline-none focus:ring-1 focus:ring-amber-400 focus:ring-offset-1 focus:ring-offset-gray-900
    transition-all duration-200 ease-in-out
    flex items-center justify-center
    gap-1 sm:gap-1.5            /* MOBILE: Minimal internal gap */
    transform hover:scale-105 active:scale-95
  `;

  const skeletonTextClass = "h-3 w-6 sm:h-3.5 sm:w-8 bg-gray-700 rounded animate-pulse"; // Adjusted for text-xs

  // --- Modal Content Components (No changes needed here) ---
  const MmcContent = () => ( <div className="space-y-4 text-gray-200"> <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2"> <FaCoins aria-hidden="true" /> MMC Coins </h3> <p>Son monedas de bonificación que recibes como premio al recargar.</p> <ul className="list-disc list-inside space-y-1 pl-2"> <li>No se compran directamente</li> <li>Las obtienes como bono con cada compra de Fuel Coins</li> <li>Se canjear por premios reales 🎁 (souvenirs, productos, sorteos)</li> </ul> <p>👉 Piensa en ellas como tus puntos de recompensa por jugar.</p> </div> );
  const FuelContent = () => ( <div className="space-y-4 text-gray-200"> <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2"> <FaGasPump aria-hidden="true" /> Fuel Coins </h3> <p>Son tu moneda principal para jugar en MotorManía GO.</p> <p>Tienen una equivalencia directa: <span className="font-semibold">1 COP = 1 Fuel Coin</span>.</p> <ul className="list-disc list-inside space-y-1 pl-2"> <li>Se usan para hacer tus apuestas (picks)</li> <li>Tienen valor virtual y están ligadas al monto que pagas en pesos</li> <li>No son canjeables por dinero real, pero sí determinan tu potencial de ganancia</li> </ul> <p>👉 Si apuestas $10.000 COP, estás usando 10.000 Fuel Coins.</p> </div> );
  const ExampleContent = () => ( <div className="mt-6 border-t border-gray-600 pt-4"> <h4 className="text-md font-semibold text-white mb-2">📊 Ejemplo práctico:</h4> <p className="text-gray-300">Pagas $20.000 COP</p> <p className="text-gray-300">→ Recibes 20.000 Fuel Coins para apostar</p> <p className="text-gray-300">→ Y ganas 20 MMC Coins como recompensa 🎉</p> </div> );

  // --- Component Return ---
  return (
    <>
      <AnimatePresence>
        {isSignedIn && (
          <motion.div
            key="subHeader"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={containerClasses}
          >
            <div className={balancesContainerClasses}>
              <div
                className={balanceItemClasses}
                onClick={() => openModal('mmc')}
                role="button" tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openModal('mmc')}
              >
                <FaCoins className={`text-cyan-400 ${iconSizeClass}`} aria-hidden="true" />
                <span className="text-cyan-400 font-medium whitespace-nowrap">MMC:</span>
                {isLoading ? (
                  <span className={skeletonTextClass}></span>
                ) : (
                  <span className="font-bold tabular-nums">{mmcAmount?.toLocaleString() ?? '0'}</span>
                )}
              </div>

              <div className={dividerClass} aria-hidden="true"></div>

              <div
                className={balanceItemClasses}
                onClick={() => openModal('fuel')}
                role="button" tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openModal('fuel')}
              >
                <FaGasPump className={`text-amber-400 ${iconSizeClass}`} aria-hidden="true" />
                <span className="text-amber-400 font-medium whitespace-nowrap">FUEL:</span>
                {isLoading ? (
                  <span className={skeletonTextClass}></span>
                ) : (
                  <span className="font-bold tabular-nums">{fuelAmount?.toLocaleString() ?? '0'}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => router.push('/wallet')}
              className={buttonClasses}
              disabled={isLoading}
            >
              <FaWallet className={iconSizeClass} aria-hidden="true" />
              Triplicamos tu primer déposito
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <CoinsExplainModal isOpen={isModalOpen} onClose={closeModal} title="⚙️ ¿Qué son los MMC Coins y Fuel Coins?">
        <div className="space-y-6">
          {modalContent === 'fuel' && <FuelContent />}
          {modalContent === 'mmc' && <MmcContent />}
          {(modalContent === 'fuel' || modalContent === 'mmc') && <ExampleContent />}
        </div>
      </CoinsExplainModal>
    </>
  );
}