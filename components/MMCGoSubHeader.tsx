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
    // Optional: Delay clearing content for exit animation if needed
    // setTimeout(() => setModalContent(null), 300); // Adjust timing based on modal animation
  };

  // Effect to fetch wallet balances when component mounts or auth state changes
  useEffect(() => {
    // Exit early if Clerk isn't loaded or user isn't signed in
    if (!isLoaded || !isSignedIn || !user) {
      setIsLoading(!isLoaded); // Set loading based on Clerk status
      return;
    }

    // Avoid refetching if balances are already loaded
    if (balances !== null) {
      setIsLoading(false);
      return;
    }

    let mounted = true; // Flag to prevent state updates on unmounted component
    setIsLoading(true); // Set loading state

    const fetchBalances = async () => {
      try {
        // Get Supabase token from Clerk
        const token = await getToken({ template: 'supabase' });
        if (!token) {
          console.error('Failed to get Supabase token.');
          if (mounted) setBalances({ mmc: 0, fuel: 0 }); // Set default balances on token error
          return;
        }
        // Create authenticated Supabase client
        const supabase = createAuthClient(token);
        // Fetch wallet data
        const { data, error } = await supabase
          .from('wallet') // Your Supabase table name
          .select('mmc_coins, fuel_coins') // Columns to select
          .eq('user_id', user.id) // Filter by user ID
          .single(); // Expect a single row

        if (error) {
          // Handle specific error code for 'resource not found' gracefully
          if (error.code === 'PGRST116') {
            console.warn('Wallet not found for user, initializing balances to 0.');
            if (mounted) setBalances({ mmc: 0, fuel: 0 });
          } else {
            // Log other errors
            console.error('Error fetching wallet balances:', error.message);
            if (mounted) setBalances({ mmc: 0, fuel: 0 }); // Set default balances on other errors
          }
        } else if (data && mounted) {
          // Set balances from fetched data, using nullish coalescing for safety
          setBalances({ mmc: data.mmc_coins ?? 0, fuel: data.fuel_coins ?? 0 });
        }
      } catch (err) {
        // Catch any unexpected errors during fetch
        console.error('Failed to load balances:', err);
        if (mounted) setBalances({ mmc: 0, fuel: 0 }); // Set default balances on catch
      } finally {
        // Ensure loading state is turned off regardless of outcome
        if (mounted) setIsLoading(false);
      }
    };

    fetchBalances();

    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      mounted = false;
    };
    // Dependencies for the effect
  }, [isLoaded, isSignedIn, user, getToken, balances]);

  // Render nothing until Clerk is fully loaded to prevent layout shifts or flashes
  if (!isLoaded) return null;

  // Get balance amounts for rendering, default to null if balances haven't loaded yet
  const mmcAmount = balances?.mmc;
  const fuelAmount = balances?.fuel;

  // --- Tailwind Class Definitions for Clarity ---

  const containerClasses = `
    fixed top-20 inset-x-0 z-40
    bg-gradient-to-br from-gray-950 via-black to-gray-800
    border-b border-amber-600/25
    shadow-xl px-4 py-4 sm:px-6 sm:py-5
    font-exo2 text-white text-sm sm:text-base
    flex flex-col sm:flex-row items-center sm:justify-between
    gap-3 sm:gap-6 transition-all duration-300
  `;

  const balancesContainerClasses = `
    flex flex-row items-center justify-center sm:justify-start
    gap-4 sm:gap-5 w-full sm:w-auto flex-wrap
  `;

  // Added cursor-pointer and focus styles for clickability
  const balanceItemClasses = `
    flex items-center justify-center gap-2 p-1.5
    rounded-md hover:bg-white/10 transition-colors duration-200
    cursor-pointer /* Indicate clickable */
    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-gray-900 /* Focus state */
  `;

  const dividerClass = `
    hidden sm:block h-5 w-px bg-gray-600
  `;

  const buttonClasses = `
    w-full sm:w-auto bg-amber-500 text-black font-bold px-5 py-2.5
    rounded-md hover:bg-amber-400 hover:shadow-md
    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-gray-900
    transition-all duration-200 ease-in-out flex items-center justify-center gap-2
    transform hover:scale-105 active:scale-95
  `;

  const skeletonTextClass = "h-5 w-12 bg-gray-700 rounded animate-pulse";

  // --- Modal Content Components ---
  const MmcContent = () => (
    <div className="space-y-4 text-gray-200">
      <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
        <FaCoins aria-hidden="true" /> MMC Coins
      </h3>
      <p>Son monedas de bonificación que recibes como premio al recargar.</p>
      <ul className="list-disc list-inside space-y-1 pl-2">
        <li>No se compran directamente</li>
        <li>Las obtienes como bono con cada compra de Fuel Coins</li>
        <li>Se pueden canjear por premios reales 🎁 (souvenirs, productos, sorteos)</li>
      </ul>
      <p>👉 Piensa en ellas como tus puntos de recompensa por jugar.</p>
    </div>
  );

  const FuelContent = () => (
     <div className="space-y-4 text-gray-200">
      <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
        <FaGasPump aria-hidden="true" /> Fuel Coins
      </h3>
      <p>Son tu moneda principal para jugar en MotorManía GO.</p>
      <p>Tienen una equivalencia directa: <span className="font-semibold">1 COP = 1 Fuel Coin</span>.</p>
      <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Se usan para hacer tus apuestas (picks)</li>
          <li>Tienen valor virtual y están ligadas al monto que pagas en pesos</li>
          <li>No son canjeables por dinero real, pero sí determinan tu potencial de ganancia</li>
      </ul>
       <p>👉 Si apuestas $10.000 COP, estás usando 10.000 Fuel Coins.</p>
    </div>
  );

   const ExampleContent = () => (
    <div className="mt-6 border-t border-gray-600 pt-4">
       <h4 className="text-md font-semibold text-white mb-2">📊 Ejemplo práctico:</h4>
       <p className="text-gray-300">Pagas $20.000 COP</p>
       <p className="text-gray-300">→ Recibes 20.000 Fuel Coins para apostar</p>
       <p className="text-gray-300">→ Y ganas 20 MMC Coins como recompensa 🎉</p>
    </div>
   );

  // --- Component Return ---
  return (
    // Use Fragment as we are returning multiple top-level elements (header + modal)
    <>
      <AnimatePresence>
        {/* Only render the subheader if user is signed in */}
        {isSignedIn && (
          <motion.div
            key="subHeader"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={containerClasses}
          >
            {/* Balances Row/Loading State */}
            <div className={balancesContainerClasses}>
              {/* MMC Balance Item - Make clickable */}
              <div
                className={balanceItemClasses}
                onClick={() => openModal('mmc')} // Call openModal for MMC
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openModal('mmc')}
              >
                <FaCoins className="text-cyan-400 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-cyan-400 font-medium whitespace-nowrap">MMC:</span>
                {/* Show skeleton while loading, otherwise show formatted amount */}
                {isLoading ? (
                  <span className={skeletonTextClass}></span>
                ) : (
                  <span className="font-bold tabular-nums">{mmcAmount?.toLocaleString() ?? '0'}</span>
                )}
              </div>

              {/* Divider between balance items on larger screens */}
              <div className={dividerClass} aria-hidden="true"></div>

              {/* FUEL Balance Item - Make clickable */}
              <div
                className={balanceItemClasses}
                onClick={() => openModal('fuel')} // Call openModal for FUEL
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openModal('fuel')}
              >
                <FaGasPump className="text-amber-400 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-amber-400 font-medium whitespace-nowrap">FUEL:</span>
                {/* Show skeleton while loading, otherwise show formatted amount */}
                {isLoading ? (
                  <span className={skeletonTextClass}></span>
                ) : (
                  <span className="font-bold tabular-nums">{fuelAmount?.toLocaleString() ?? '0'}</span>
                )}
              </div>
            </div> {/* End of balancesContainerClasses div */}

            {/* Wallet Button */}
            <button
              onClick={() => router.push('/wallet')} // Navigate to wallet page
              className={buttonClasses}
              disabled={isLoading} // Disable button while balances are loading
            >
              <FaWallet aria-hidden="true" />
              Wallet
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render the Modal Component */}
      <CoinsExplainModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="⚙️ ¿Qué son los MMC Coins y Fuel Coins?"
      >
        {/* Conditionally render content inside the modal based on state */}
        <div className="space-y-6">
          {modalContent === 'fuel' && <FuelContent />}
          {modalContent === 'mmc' && <MmcContent />}
          {/* Always show example if either type is selected */}
          {(modalContent === 'fuel' || modalContent === 'mmc') && <ExampleContent />}
        </div>
      </CoinsExplainModal>
    </> // End of Fragment
  );
}
