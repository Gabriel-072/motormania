// app/(auth)/sign-in/[[...sign-in]]/page.tsx
'use client';

import { SignIn } from '@clerk/nextjs';
import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';

export default function SignInPage() {
  const wrapperControls = useAnimation();
  const borderControls = useAnimation();

  // Trigger animations after a slight delay to ensure loading
  useEffect(() => {
    const timer = setTimeout(() => {
      wrapperControls.start({ opacity: 1, transition: { duration: 0.6 } });
      borderControls.start({
        '--border-angle': '360deg',
        transition: { duration: 5, repeat: Infinity, ease: 'linear' },
      });
    }, 100); // Small delay to ensure component mounts

    return () => clearTimeout(timer);
  }, [wrapperControls, borderControls]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Wrapper for the entire card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={wrapperControls}
        className="relative"
      >
        {/* Animated Border */}
        <motion.div
          className="rounded-xl p-0.5"
          initial={{ '--border-angle': '0deg' } as any}
          animate={borderControls}
          style={{
            background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #F59E0B 20deg, #22D3EE 30deg, #F59E0B 40deg, transparent 50deg, transparent 360deg)`,
          }}
        >
          {/* Sign-In Content */}
          <div className="bg-gradient-to-br from-gray-900 to-black p-4 sm:p-6 rounded-xl shadow-lg relative z-10 w-full max-w-md">
            <h1 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 mb-6 sm:mb-8 font-exo2 text-center">
              Inicia Sesión en MotorManía
            </h1>
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              afterSignInUrl="/dashboard"
            />
          </div>
        </motion.div>
      </motion.div>

      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-1/3 w-48 sm:w-64 h-48 sm:h-64 bg-amber-500/10 rounded-full filter blur-2xl sm:blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-64 sm:w-80 h-64 sm:h-80 bg-cyan-500/10 rounded-full filter blur-2xl sm:blur-3xl animate-pulse delay-1000" />
      </div>
    </div>
  );
}