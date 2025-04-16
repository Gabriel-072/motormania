// components/Header.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-8 left-0 w-full bg-gradient-to-r from-[#FF4500]/20 via-[#FF6B35]/20 to-[#FFD700]/20 backdrop-blur-md border-b border-amber-500/30 z-50">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between"
      >
        <Link href="/" className="text-2xl font-bold text-white hover:text-amber-400 font-exo2 tracking-tight">
          MotorManía
        </Link>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-6">
            <Link href="/" className="text-white text-lg font-semibold hover:text-amber-400">
              Inicio
            </Link>
            <Link href="/aliados" className="text-white text-lg font-semibold hover:text-amber-400">
              Aliados
            </Link>
            <Link href="/jugar-y-gana" className="text-white text-lg font-semibold hover:text-amber-400">
              F1 Fantasy
            </Link>
          </nav>
          <SignedOut>
            <Link href="/sign-in" className="text-white text-lg font-semibold hover:text-amber-400">
              Log In
            </Link>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </motion.div>
    </header>
  );
}