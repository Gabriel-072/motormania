// components/CurrencyInitializer.tsx - FIXED FOR YOUR STORE
'use client';

import { useEffect } from 'react';
import { useCurrencyStore } from '@/stores/currencyStore';

interface CurrencyInitializerProps {
  children: React.ReactNode;
}

/**
 * This component ensures currency detection starts immediately when the app loads
 * It should be placed high in your component tree (like in layout or main page)
 */
export function CurrencyInitializer({ children }: CurrencyInitializerProps) {
  const { initializeCurrency, isInitialized, isLoading } = useCurrencyStore();

  useEffect(() => {
    // Start currency detection immediately when component mounts
    if (!isInitialized && !isLoading) {
      console.log('🚀 CurrencyInitializer: Starting early currency detection');
      initializeCurrency().catch((error) => {
        console.error('❌ Early currency detection failed:', error);
      });
    }
  }, [initializeCurrency, isInitialized, isLoading]);

  // Optionally show a loading indicator while detecting
  // if (isLoading) {
  //   return (
  //     <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-3 py-1 rounded-md text-sm">
  //       🌍 Detecting location...
  //     </div>
  //   );
  // }

  return <>{children}</>;
}

// Optional: Preload component for even earlier initialization
export function CurrencyPreloader() {
  const { initializeCurrency, isInitialized, isLoading } = useCurrencyStore();

  useEffect(() => {
    // Preload currency detection in the background
    if (!isInitialized && !isLoading) {
      // Use setTimeout to not block initial page render
      setTimeout(() => {
        initializeCurrency().catch(console.error);
      }, 100);
    }
  }, [initializeCurrency, isInitialized, isLoading]);

  return null; // This component doesn't render anything
}