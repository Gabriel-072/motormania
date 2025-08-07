// components/AnonymousOrderCompletion.tsx - Handle Post-Registration Order Linking
'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface LinkedOrder {
  orderId: string;
  amount: number;
  mode: string;
  picks: number;
}

interface AnonymousOrderCompletionProps {
  onComplete?: () => void;
}

export default function AnonymousOrderCompletion({ onComplete }: AnonymousOrderCompletionProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [linkedOrders, setLinkedOrders] = useState<LinkedOrder[]>([]);
  const [promotionalSummary, setPromotionalSummary] = useState<{
    ordersWithPromotion: number;
    totalBonusApplied: number;
  } | null>(null); // 🔥 NEW: Track promotional results
  const [error, setError] = useState<string | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);

  // Get session ID from URL params or localStorage
  const sessionId = searchParams.get('session') || 
    (typeof window !== 'undefined' ? localStorage.getItem('anonymousSession') : null);

  useEffect(() => {
    // Only process if user is loaded, authenticated, has session, and hasn't processed yet
    if (!isLoaded || !user?.id || !sessionId || hasProcessed) return;

    const linkAnonymousOrders = async () => {
      setIsProcessing(true);
      setError(null);

      try {
        console.log('🔗 Linking anonymous orders for session:', sessionId);

        const response = await fetch('/api/complete-anonymous-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to link orders');
        }

        if (data.linked > 0) {
          setLinkedOrders(data.orders || []);
          setPromotionalSummary(data.promotionalSummary || null); // 🔥 NEW: Store promotional summary
          
          // 🔥 UPDATED: Enhanced success message with promotional info
          const promoText = data.promotionalSummary?.ordersWithPromotion > 0 
            ? ` (${data.promotionalSummary.ordersWithPromotion} con bono aplicado)`
            : '';
          
          toast.success(`¡Perfecto! ${data.linked} jugada${data.linked > 1 ? 's' : ''} vinculada${data.linked > 1 ? 's' : ''}${promoText}`, {
            duration: 5000
          });

          // 🔥 UPDATED: Track successful completion with promotional data
          if (typeof window !== 'undefined' && window.fbq) {
            window.fbq('track', 'CompleteRegistration', {
              content_name: 'Anonymous Order Completion',
              value: data.orders?.reduce((sum: number, order: any) => sum + order.effectiveAmount, 0) / 1000 || 0,
              currency: 'COP',
              custom_data: {
                orders_with_promotion: data.promotionalSummary?.ordersWithPromotion || 0,
                total_bonus_applied: data.promotionalSummary?.totalBonusApplied || 0
              }
            });
          }
        } else {
          console.log('No orders to link');
        }

        // Clean up localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('anonymousSession');
          localStorage.removeItem('pendingPayment');
          localStorage.removeItem('cryptoOrderId');
        }

        setHasProcessed(true);

        // Call completion callback
        if (onComplete) {
          setTimeout(onComplete, 2000);
        }

      } catch (err: any) {
        console.error('Error linking anonymous orders:', err);
        setError(err.message || 'Error vinculando jugada');
        toast.error('Error vinculando tus picks. Contacta soporte.');
      } finally {
        setIsProcessing(false);
      }
    };

    // Small delay to ensure user registration is complete
    const timer = setTimeout(linkAnonymousOrders, 1000);
    return () => clearTimeout(timer);
  }, [isLoaded, user?.id, sessionId, hasProcessed, onComplete]);

  // Don't render anything if no session or already processed
  if (!sessionId || hasProcessed || !isProcessing) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-amber-500/30 shadow-2xl p-8 max-w-md w-full mx-4">
        {isProcessing && (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-white mb-2 font-exo2">
              Finalizando tu registro...
            </h3>
            <p className="text-gray-300 text-sm font-exo2">
              Estamos vinculando tus jugadas y aplicando bonos
            </p>
          </div>
        )}

        {linkedOrders.length > 0 && (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-green-400 mb-2 font-exo2">
              ¡Registro Completado!
            </h3>
            <p className="text-gray-300 text-sm mb-4 font-exo2">
              Tus picks han sido vinculados exitosamente
            </p>
            
            {/* 🔥 NEW: Show promotional summary */}
            {promotionalSummary && promotionalSummary.ordersWithPromotion > 0 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                <p className="text-green-400 text-sm font-semibold">
                  🎁 {promotionalSummary.ordersWithPromotion} jugada{promotionalSummary.ordersWithPromotion > 1 ? 's' : ''} con bono aplicado
                </p>
                <p className="text-green-300 text-xs">
                  Bono total: ${promotionalSummary.totalBonusApplied.toLocaleString()} COP
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              {linkedOrders.map((order: any, index: number) => (
                <div key={index} className="bg-gray-800/50 p-3 rounded-lg text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium text-sm">
                      {order.picks} picks - {order.mode === 'full' ? 'Full Throttle' : 'Safety Car'}
                      {order.promotionApplied && (
                        <span className="text-green-400 text-xs ml-2">+ Bono</span>
                      )}
                    </span>
                    <span className="text-amber-400 font-bold text-sm">
                      ${(order.effectiveAmount || order.amount).toLocaleString()} COP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-red-400 mb-2 font-exo2">
              Error en el proceso
            </h3>
            <p className="text-gray-300 text-sm font-exo2">
              {error}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}