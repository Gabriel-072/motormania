// components/Header.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Menu, X, Home, Users, Trophy, Rocket, LogIn } from 'lucide-react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isMenuOpen) setIsMenuOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const isActive = (href: string) => pathname === href;

  const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/aliados", label: "Aliados", icon: Users },
    { href: "/f1-fantasy", label: "F1 Fantasy", icon: Trophy },
    { href: "/mmc-go", label: "MMC GO", icon: Rocket },
  ];

  // Tailwind Classes
  const headerClasses = `
    fixed top-8 left-0 w-full z-50
    bg-black/70 backdrop-blur-md
    border-b border-white/10
    shadow-lg shadow-black/20
  `;

  const containerClasses = "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";
  const contentWrapperClasses = "flex h-16 items-center justify-between";

  // Desktop Nav
  const desktopNavClasses = "hidden md:flex items-center space-x-6";
  const desktopLinkBase = "relative text-sm font-medium transition-colors duration-200 group focus:outline-none focus-visible:text-amber-400";
  const desktopLinkActive = "text-amber-400";
  const desktopLinkInactive = "text-gray-300 hover:text-white";
  const desktopLinkUnderline = "absolute bottom-[-4px] left-0 h-0.5 bg-amber-400 w-full scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100 transition-transform duration-300 origin-center";

  // Mobile Nav
  const mobileMenuButtonClasses = "md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 transition";
  const mobileMenuPanelClasses = "fixed inset-y-8 right-0 z-50 w-full max-w-xs bg-gray-900 shadow-xl p-6 flex flex-col";
  const mobileCloseButtonClasses = "absolute top-4 right-4 p-2 -m-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full transition";
  const mobileNavLinkBase = "flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-colors duration-200 focus:outline-none focus-visible:bg-gray-700/70 focus-visible:text-amber-300";
  const mobileNavLinkActive = "bg-amber-600/10 text-amber-300";
  const mobileNavLinkInactive = "text-gray-300 hover:bg-gray-800/60 hover:text-amber-300";

  // Auth Buttons
  const authContainerClasses = "flex items-center gap-4";
  const loginButtonDesktopClasses = `${desktopLinkInactive} ${desktopLinkBase} bg-gray-800/70 hover:bg-gray-700/80 px-4 py-1.5 rounded-md text-xs`;
  const loginButtonMobileClasses = "flex items-center justify-center gap-2 w-full text-center bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold py-3 px-4 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/40 active:scale-95";

  // Framer Motion Variants
  const panelVariants = {
    hidden: { x: '100%', opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: { x: '100%', opacity: 0, transition: { type: 'tween', ease: 'easeIn', duration: 0.2 } },
  };
  const mobileLinkVariants = {
    hidden: { opacity: 0, x: 30 },
    visible: (i: number) => ({ opacity: 1, x: 0, transition: { delay: 0.1 + i * 0.05 } }),
    exit: { opacity: 0, x: 30, transition: { duration: 0.1 } }
  };
  const backdropVariants = {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  };

  return (
    <>
      <header className={headerClasses}>
        <div className={containerClasses}>
          <div className={contentWrapperClasses}>
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-xl sm:text-2xl font-bold text-white hover:text-amber-400 font-exo2 tracking-tight transition-colors duration-200">
                MotorManía
              </Link>
            </div>

            {/* Desktop Navigation & Auth */}
            <div className={desktopNavClasses}>
              <nav className="flex space-x-5">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${desktopLinkBase} ${isActive(item.href) ? desktopLinkActive : desktopLinkInactive}`}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                  >
                    {item.label}
                    <span className={`${desktopLinkUnderline} ${isActive(item.href) ? 'scale-x-100' : ''}`}></span>
                  </Link>
                ))}
              </nav>
              {/* Desktop Auth Buttons */}
              <div className={authContainerClasses}>
                <SignedOut>
                  <Link href="/sign-in" className={loginButtonDesktopClasses}>Log In</Link>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" appearance={{
                    elements: { userButtonAvatarBox: "w-8 h-8 ring-1 ring-offset-1 ring-offset-gray-900 ring-white/20 hover:ring-amber-400/80" }
                  }} />
                </SignedIn>
              </div>
            </div>

            {/* Mobile Menu Button & Auth */}
            <div className="md:hidden flex items-center">
              <div className="mr-2">
                <SignedIn>
                  <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-8 h-8" } }} />
                </SignedIn>
              </div>
              <button
                type="button"
                className={mobileMenuButtonClasses}
                onClick={toggleMenu}
                aria-controls="mobile-menu"
                aria-expanded={isMenuOpen}
                aria-label="Abrir menú principal"
              >
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu - Using Framer Motion */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mobile-backdrop"
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md md:hidden"
              aria-hidden="true"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={toggleMenu}
            />

            {/* Panel */}
            <motion.div
              key="mobile-panel"
              id="mobile-menu"
              className={mobileMenuPanelClasses}
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-menu-title"
            >
              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className={mobileCloseButtonClasses}
                  onClick={toggleMenu}
                  aria-label="Cerrar menú"
                >
                  <X className="h-7 w-7" aria-hidden="true" />
                </button>
              </div>
              {/* Links */}
              <nav className="mt-6 flex-1 flow-root">
                <div className="-my-6 divide-y divide-gray-700/50">
                  <div className="space-y-2 py-6">
                    {/* Stagger link animation */}
                    <AnimatePresence initial={false}>
                      {navItems.map((item, i) => (
                        <motion.div key={item.href} custom={i} variants={mobileLinkVariants} animate="visible" initial="hidden" exit="exit">
                          <Link
                            href={item.href}
                            className={`${mobileNavLinkBase} ${isActive(item.href) ? mobileNavLinkActive : mobileNavLinkInactive}`}
                            onClick={toggleMenu}
                            aria-current={isActive(item.href) ? 'page' : undefined}
                          >
                            <item.icon className="h-5 w-5 flex-shrink-0 opacity-80" aria-hidden="true" />
                            {item.label}
                          </Link>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  {/* Auth section at bottom */}
                  <div className="py-6">
                    <SignedOut>
                      <Link href="/sign-in" className={loginButtonMobileClasses} onClick={toggleMenu}>
                        <LogIn size={18} className="mr-1" />
                        Iniciar Sesión / Registrarse
                      </Link>
                    </SignedOut>
                  </div>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}