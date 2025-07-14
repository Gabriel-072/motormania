'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

function EmailOnlyContent() {
  const router = useRouter();
  const clerk = useClerk();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !orderId || submitting) return;
    
    setSubmitting(true);

    try {
      const response = await fetch('/api/vip/collect-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, email: email.trim().toLowerCase() })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('✅ ¡Acceso VIP activado!');
        
        // 🔥 FIXED: Sign user in first, then redirect to dashboard
        setTimeout(() => {
          // Redirect to Clerk sign-in with email pre-filled and return URL
          const signInUrl = `/sign-in?redirect_url=${encodeURIComponent('/fantasy-vip')}`;
          window.location.href = signInUrl;
        }, 1000);
      } else {
        throw new Error(data.error || 'Error activando acceso');
      }
    } catch (error) {
      console.error('Email submission error:', error);
      toast.error('Error activando acceso. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-sm w-full bg-gray-800 rounded-xl p-6 border border-gray-700"
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-xl font-bold text-white mb-2">¡Pago Exitoso!</h1>
          <p className="text-gray-400 text-sm">Solo necesitamos tu email para activar tu acceso VIP:</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:opacity-50"
            required
            disabled={submitting}
            autoFocus
          />
          
          <button
            type="submit"
            disabled={submitting || !email}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Activando...
              </>
            ) : (
              'Activar Acceso VIP →'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">🔒 Tu información está segura</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function VipEmailOnly() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div>
      </div>
    }>
      <EmailOnlyContent />
    </Suspense>
  );
}