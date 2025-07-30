// components/EmbeddedCryptoCheckout.tsx
'use client';

import { useEffect, useRef } from 'react';

interface EmbeddedCryptoCheckoutProps {
  chargeId: string;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (error: any) => void;
}

declare global {
  interface Window {
    CoinbaseCommerce: any;
  }
}

export function EmbeddedCryptoCheckout({ 
  chargeId, 
  onSuccess, 
  onCancel, 
  onError 
}: EmbeddedCryptoCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chargeId || !containerRef.current) return;

    const initCoinbase = () => {
      if (window.CoinbaseCommerce && containerRef.current) {
        try {
          window.CoinbaseCommerce.createCheckout({
            chargeId,
            onSuccess: () => {
              console.log('✅ Crypto payment successful');
              onSuccess();
            },
            onCancel: () => {
              console.log('❌ Crypto payment cancelled');
              onCancel();
            },
            onError: (err: any) => {
              console.error('❌ Crypto payment error:', err);
              onError(err);
            }
          }, containerRef.current);
        } catch (error) {
          console.error('Coinbase init error:', error);
          onError(error);
        }
      }
    };

    // Try immediately or wait for script to load
    if (window.CoinbaseCommerce) {
      initCoinbase();
    } else {
      const checkCoinbase = setInterval(() => {
        if (window.CoinbaseCommerce) {
          clearInterval(checkCoinbase);
          initCoinbase();
        }
      }, 100);

      // Cleanup after 10 seconds
      setTimeout(() => clearInterval(checkCoinbase), 10000);
    }
  }, [chargeId, onSuccess, onCancel, onError]);

  return (
    <div 
      ref={containerRef}
      className="w-full min-h-[500px] bg-gray-800 rounded-lg flex items-center justify-center"
    >
      <div className="text-center text-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p>Cargando checkout crypto...</p>
      </div>
    </div>
  );
}