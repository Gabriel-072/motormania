// app/(auth)/sign-up/[[...rest]]/page.tsx - Updated for Anonymous Orders
'use client';

import { SignUp, useUser } from '@clerk/nextjs';
import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AnonymousOrderCompletion from '@/components/AnonymousOrderCompletion';

export default function SignUpPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const wrapperControls = useAnimation();
  const borderControls = useAnimation();
  
  const [showOrderCompletion, setShowOrderCompletion] = useState(false);
  const [pendingOrderInfo, setPendingOrderInfo] = useState<{
    orderId: string;
    amount: string;
    mode: string;
  } | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  // Get URL parameters
  const sessionId = searchParams.get('session');
  const orderId = searchParams.get('order');
  const amount = searchParams.get('amount');
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard';

  // Track CompleteRegistration event when user signs up
  useEffect(() => {
    if (user?.id && !localStorage.getItem(`registration_tracked_${user.id}`)) {
      console.log('🎯 Tracking CompleteRegistration event for user:', user.id);
      
      if (typeof window !== 'undefined' && window.fbq) {
        const eventId = `registration_${user.id}_${Date.now()}`;
        window.fbq('track', 'CompleteRegistration', {
          event_id: eventId,
          content_name: 'MMC_GO_Registration',
          content_category: 'account_creation',
          has_pending_order: !!sessionId
        });
        console.log('✅ CompleteRegistration event tracked:', { eventId, userId: user.id });
        localStorage.setItem(`registration_tracked_${user.id}`, 'true');
      }
    }
  }, [user?.id, sessionId]);

  // Check for pending order info in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('SignUp page loaded with params:', { sessionId, orderId, amount, redirectUrl });

    const pendingPayment = localStorage.getItem('pendingPayment');
    if (pendingPayment && sessionId) {
      try {
        const paymentData = JSON.parse(pendingPayment);
        setPendingOrderInfo({
          orderId: paymentData.orderId || orderId || 'N/A',
          amount: paymentData.amountStr || amount || '0',
          mode: paymentData.mode || 'full'
        });
        console.log('Parsed pending payment data:', pendingOrderInfo);
      } catch (error) {
        console.error('Error parsing pending payment data:', error);
      }
    } else if (!sessionId) {
      console.warn('No sessionId found, anonymous order linking will not proceed');
    }
  }, [sessionId, orderId, amount]);

  // Handle user registration completion
  useEffect(() => {
    if (!isLoaded) return;

    console.log('User state:', { isLoaded, userId: user?.id, sessionId });

    // If user just signed up and we have a session, show order completion
    if (user?.id && sessionId && !showOrderCompletion) {
      setShowOrderCompletion(true);
      console.log('Triggering AnonymousOrderCompletion with session:', sessionId);
    }
    
    // If user is already signed in and no session, redirect
    if (user?.id && !sessionId) {
      router.push(redirectUrl);
    }
  }, [isLoaded, user?.id, sessionId, showOrderCompletion, redirectUrl, router]);

  const handleOrderCompletionFinish = () => {
    setIsLinking(true);
    console.log('Order completion finished, preparing to redirect to:', redirectUrl);
    setTimeout(() => {
      setShowOrderCompletion(false);
      setIsLinking(false);
      router.push(redirectUrl);
    }, 1500); // Delay to show success feedback
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      wrapperControls.start({ opacity: 1, transition: { duration: 0.6 } });
      borderControls.start({
        '--border-angle': '360deg',
        transition: { duration: 5, repeat: Infinity, ease: 'linear' },
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [wrapperControls, borderControls]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={wrapperControls} className="relative">
        {/* 🆕 Pending Order Info Banner */}
        {sessionId && pendingOrderInfo && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-amber-500/10 to-green-500/10 border border-amber-500/30 rounded-xl"
          >
            <div className="text-center">
              <h2 className="text-lg font-bold text-amber-400 mb-2 font-exo2">
                🎉 ¡Pago Exitoso!
              </h2>
              <p className="text-sm text-gray-300 font-exo2 mb-3">
                Tu jugada ha sido procesada. Completa tu registro para gestionar tus picks.
              </p>
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Orden:</span>
                  <span className="text-white font-mono">
                    {pendingOrderInfo.orderId.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-400">Monto:</span>
                  <span className="text-green-400 font-bold">
                    ${parseInt(pendingOrderInfo.amount).toLocaleString()} COP
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          className="rounded-xl p-0.5"
          initial={{ '--border-angle': '0deg' } as any}
          animate={borderControls}
          style={{
            background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #F59E0B 20deg, #22D3EE 30deg, #F59E0B 40deg, transparent 50deg, transparent 360deg)`,
          }}
        >
          <div className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 w-full max-w-md">
            <h1 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 mb-6 sm:mb-8 font-exo2 text-center">
              {sessionId ? 'Finaliza tu Registro' : 'Únete a MotorManía'}
            </h1>
            
            {sessionId && (
              <p className="text-gray-400 text-sm text-center mb-4 font-exo2">
                Un paso más para acceder a tus jugadas
              </p>
            )}

            <SignUp 
              signInUrl="/sign-in" 
              redirectUrl={redirectUrl}
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: 
                    "bg-gray-800 border-gray-600 text-white hover:bg-gray-700",
                  formButtonPrimary: 
                    "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold",
                  formFieldInput: 
                    "bg-gray-800 border-gray-600 text-white focus:border-amber-500",
                  formFieldLabel: "text-gray-300",
                  identityPreviewText: "text-gray-300",
                  identityPreviewEditButton: "text-amber-400",
                  footerActionLink: "text-amber-400 hover:text-amber-300",
                  footerActionText: "text-gray-400",
                  dividerLine: "bg-gray-600",
                  dividerText: "text-gray-400",
                },
              }}
            />
          </div>
        </motion.div>

        {/* Help text */}
        {sessionId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center mt-4 p-3 bg-gray-800/30 rounded-lg"
          >
            <p className="text-xs text-gray-400 font-exo2">
              Al completar tu registro, aceptas nuestros{' '}
              <a href="/terms" className="text-amber-400 hover:text-amber-300">
                Términos y Condiciones
              </a>{' '}
              y{' '}
              <a href="/privacy" className="text-amber-400 hover:text-amber-300">
                Política de Privacidad
              </a>
            </p>
          </motion.div>
        )}
      </motion.div>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-1/3 w-48 sm:w-64 h-48 sm:h-64 bg-amber-500/10 rounded-full filter blur-2xl sm:blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-64 sm:w-80 h-64 sm:h-80 bg-cyan-500/10 rounded-full filter blur-2xl sm:blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Anonymous Order Completion Modal */}
      {showOrderCompletion && (
        <AnonymousOrderCompletion onComplete={handleOrderCompletionFinish} />
      )}
      {isLinking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="text-center">
            <p className="text-white">Vinculando tu jugada...</p>
          </div>
        </div>
      )}
    </div>
  );
}