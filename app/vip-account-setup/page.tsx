//'app/vip-account-setup/page.tsx' - AUTO-LOGIN AFTER PAY-FIRST

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

function VipAccountSetupContent() {
  const router = useRouter();
  const clerk = useClerk();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');

  const [status, setStatus] = useState<'checking' | 'creating' | 'logging-in' | 'success' | 'error'>('checking');
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [pollCount, setPollCount] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  

  useEffect(() => {
    if (!orderId) {
      toast.error('ID de orden inválido');
      router.push('/');
      return;
    }

    // Start polling for account creation
    pollForAccountCreation();

    // Timer for elapsed time display
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [orderId]);

  const pollForAccountCreation = async () => {
    const maxPolls = 30; // Poll for 5 minutes max (30 polls * 10 seconds)
    let currentPoll = 0;

    const poll = async () => {
      try {
        currentPoll++;
        setPollCount(currentPoll);

        const response = await fetch(`/api/vip/check-account-status?order=${orderId}`);
        const data = await response.json();

        if (data.status === 'account_ready') {
            // Account created, proceed to login
            setAccountInfo(data.account);
            setStatus('logging-in');
            await performAutoLogin(data.account);
          } else if (data.status === 'needs_email_collection') {
            // 🔥 NEW: Payment successful but need email
            setAccountInfo({ 
              needs_email: true, 
              customer_name: data.customer_name,
              order_id: data.order_id 
            });
            setShowEmailForm(true);
            setStatus('creating');
          } else if (data.status === 'payment_pending') {

          // Payment still processing
          setStatus('checking');
          if (currentPoll < maxPolls) {
            setTimeout(poll, 10000); // Poll every 10 seconds
          } else {
            setStatus('error');
            toast.error('El proceso está tardando más de lo esperado. Por favor contacta soporte.');
          }
        } else if (data.status === 'payment_failed') {
          setStatus('error');
          toast.error('Hubo un problema con tu pago. Por favor intenta nuevamente.');
          setTimeout(() => router.push('/'), 3000);
        } else {
          // Keep polling
          if (currentPoll < maxPolls) {
            setTimeout(poll, 10000);
          } else {
            setStatus('error');
            toast.error('El proceso está tardando más de lo esperado. Tu pago fue exitoso, te contactaremos pronto.');
          }
        }
      } catch (error) {
        console.error('❌ Error polling account status:', error);
        if (currentPoll < maxPolls) {
          setTimeout(poll, 10000);
        } else {
          setStatus('error');
        }
      }
    };

    // Start first poll after 5 seconds (give webhook time to process)
    setTimeout(poll, 5000);
  };

// 🔥 UPDATED: Handle email submission with unified flow
const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !orderId) return;
    
    setEmailSubmitting(true);
    
    try {
      const response = await fetch('/api/vip/collect-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          email: email.trim().toLowerCase()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowEmailForm(false);
        
        // 🔥 UPDATED: Unified flow for both new and existing users
        if (data.is_new_user) {
          toast.success('✅ Cuenta creada. Iniciando sesión...');
        } else {
          toast.success('✅ Acceso VIP activado. Iniciando sesión...');
        }
        
        // Set account info and proceed directly to auto-login
        setAccountInfo({
          email: data.email,
          plan_id: data.plan_activated,
          login_session_token: data.login_session_token,
          is_new_user: data.is_new_user
        });
        
        setStatus('logging-in');
        
        // Proceed directly to auto-login (no polling needed)
        setTimeout(() => {
          performAutoLogin({
            email: data.email,
            login_session_token: data.login_session_token
          });
        }, 1000);
        
      } else {
        throw new Error(data.error || 'Error procesando email');
      }
    } catch (error) {
      console.error('❌ Email submission error:', error);
      toast.error('Error procesando email. Por favor intenta nuevamente.');
    } finally {
      setEmailSubmitting(false);
    }
  };
  
  const performAutoLogin = async (account: any) => {
    try {
      if (!account.login_session_token) {
        // Fallback: redirect to sign in
        toast.info('Tu cuenta fue creada. Por favor inicia sesión.');
        clerk.redirectToSignIn({
          afterSignInUrl: '/f1-fantasy-panel'
        });
        return;
      }
  
      // Use the session token to verify and get user info
      const loginResponse = await fetch('/api/vip/auto-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: account.login_session_token,
          orderId: orderId
        })
      });
  
      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        
        if (loginData.success) {
          setStatus('success');
          
          // 🔥 UPDATED: Dynamic success message
          const isNewUser = accountInfo?.is_new_user;
          if (isNewUser) {
            toast.success('🎉 ¡Cuenta creada e inicio de sesión exitoso!');
          } else {
            toast.success('🎉 ¡Acceso VIP activado e inicio de sesión exitoso!');
          }
          
          // Redirect to sign-in (more reliable than server-side sessions)
          setTimeout(() => {
            clerk.redirectToSignIn({
              afterSignInUrl: '/f1-fantasy-panel'
            });
          }, 2000);
        } else {
          // Fallback to manual login
          toast.info('Tu acceso fue activado. Serás redirigido para iniciar sesión.');
          clerk.redirectToSignIn({
            afterSignInUrl: '/f1-fantasy-panel'
          });
        }
      } else {
        throw new Error('Auto-login failed');
      }
    } catch (error) {
      console.error('❌ Auto-login error:', error);
      // Fallback: redirect to sign in
      const isNewUser = accountInfo?.is_new_user;
      if (isNewUser) {
        toast.info('Tu cuenta fue creada exitosamente. Por favor inicia sesión.');
      } else {
        toast.info('Tu acceso VIP fue activado. Por favor inicia sesión.');
      }
      clerk.redirectToSignIn({
        afterSignInUrl: '/f1-fantasy-panel'
      });
    }
  };
  
  // 🔥 UPDATED: Status messages that handle email collection
  const getStatusMessage = () => {
    switch (status) {
      case 'checking':
        return 'Verificando tu pago...';
      case 'creating':
        if (showEmailForm) {
          return '¡Pago exitoso! Completa tu registro';
        }
        return 'Creando tu cuenta VIP...';
      case 'logging-in':
        const isNewUser = accountInfo?.is_new_user;
        if (isNewUser) {
          return 'Cuenta creada. Iniciando sesión...';
        } else {
          return 'Acceso VIP activado. Iniciando sesión...';
        }
      case 'success':
        const isNew = accountInfo?.is_new_user;
        if (isNew) {
          return '¡Cuenta creada exitosamente!';
        } else {
          return '¡Acceso VIP activado exitosamente!';
        }
      case 'error':
        return 'Hubo un problema. Contactando soporte...';
      default:
        return 'Procesando...';
    }
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return '🔍';
      case 'creating':
        if (showEmailForm) {
          return '📧';
        }
        return '👤';
      case 'logging-in':
        return '🔑';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 text-center border border-gray-700"
        >
          {/* Logo */}
          <div className="text-3xl font-bold mb-8">
            <span className="text-red-500">Motor</span>
            <span className="text-amber-400">Manía</span>
          </div>

          {/* Status Icon */}
          <motion.div
            key={status}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-6xl mb-6"
          >
            {getStatusIcon()}
          </motion.div>

          {/* Status Message */}
          <motion.h1
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-2xl font-bold text-white mb-4"
          >
            {getStatusMessage()}
          </motion.h1>

          {/* Progress Indicator */}
          {status !== 'error' && status !== 'success' && (
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
              </div>
              
              <div className="text-gray-400 text-sm space-y-2">
                <p>Tiempo transcurrido: {timeElapsed}s</p>
                {pollCount > 0 && (
                  <p>Verificación #{pollCount}/30</p>
                )}
              </div>
            </div>
          )}

{/* Email Collection Form */}
{showEmailForm && accountInfo?.needs_email && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="mb-6"
  >
    <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-6">
      <h3 className="text-amber-400 font-bold mb-3 text-lg">
        ¡Pago Exitoso! 🎉
      </h3>
      <p className="text-gray-300 text-sm mb-4">
        Para completar tu acceso VIP, necesitamos tu email:
      </p>
      
      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu.email@ejemplo.com"
            required
            disabled={emailSubmitting}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
          />
        </div>
        
        <button
          type="submit"
          disabled={emailSubmitting || !email}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {emailSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              Procesando...
            </>
          ) : (
            <>
              Crear Mi Cuenta VIP
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </form>
      
      <p className="text-xs text-gray-400 mt-3 text-center">
        🔒 Tu información está segura y protegida
      </p>
    </div>
  </motion.div>
)}

{/* Account Info */}
          {accountInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-green-900/30 border border-green-500/30 rounded-lg p-4 mb-6"
            >
              <h3 className="text-green-400 font-bold mb-2">¡Cuenta VIP Creada!</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <p><strong>Email:</strong> {accountInfo.email}</p>
                <p><strong>Plan:</strong> {accountInfo.plan_id === 'season-pass' ? 'Season Pass' : 'Race Pass'}</p>
                {accountInfo.race_pass_gp && (
                  <p><strong>GP:</strong> {accountInfo.race_pass_gp}</p>
                )}
              </div>
            </motion.div>
          )}

          {/* What's Next */}
          {status === 'checking' && (
            <div className="text-gray-400 text-sm">
              <p className="mb-2">🔥 <strong>¡Tu pago fue exitoso!</strong></p>
              <p>Estamos creando tu cuenta VIP automáticamente...</p>
              <p className="mt-4 text-xs">Este proceso suele tomar menos de 30 segundos</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-green-400 text-sm">
              <p className="mb-2">🎉 <strong>¡Bienvenido a MotorManía VIP!</strong></p>
              <p>Serás redirigido para iniciar sesión en unos segundos...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-red-400 text-sm">
              <p className="mb-4">Tu pago fue procesado exitosamente, pero hubo un problema técnico.</p>
              <p className="mb-4">Nuestro equipo de soporte te contactará en las próximas horas para activar tu cuenta.</p>
              <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-300">
                <p><strong>ID de Orden:</strong> {orderId}</p>
                <p><strong>Soporte:</strong> soporte@motormania.com</p>
              </div>
            </div>
          )}

          {/* Manual Access Button for Errors */}
          {status === 'error' && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              onClick={() => clerk.redirectToSignIn({ afterSignInUrl: '/f1-fantasy-panel' })}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all"
            >
              Intentar Acceso Manual
            </motion.button>
          )}
        </motion.div>

        {/* Security Notice */}
        <div className="text-center mt-6 text-gray-500 text-xs">
          <p>🔒 Proceso seguro y automático • Tus datos están protegidos</p>
        </div>
      </div>
    </div>
  );
}

// 🔥 FIXED: Single export default with Suspense wrapper
export default function VipAccountSetup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-amber-400 font-bold">Cargando...</p>
        </div>
      </div>
    }>
      <VipAccountSetupContent />
    </Suspense>
  );
}