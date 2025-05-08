// app/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useUser, useAuth, SignedOut } from '@clerk/nextjs';
import { motion, AnimatePresence, useAnimation, AnimationControls } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';

import MovingBar from '@/components/MovingBar';
import { InfiniteLogoCarousel } from '@/components/InfiniteLogoCarousel';
import { trackFBEvent } from '@/lib/trackFBEvent';
import { createAuthClient } from '@/lib/supabase'; // Assuming this is correctly set up for client-side auth

// --- Types ---
type Tier = 'Intro' | 'Estándar' | 'Premium';
type Logo = { name: string; src: string };
type ReviewData = { name: string; rating: number; comment: string };

// --- Data (Consider moving to a separate constants/data file for larger apps) ---
const line1Logos: Logo[] = [
  { name: 'Automás', src: '/logos/automás.png' }, { name: 'Cupohotel', src: '/logos/cupohotel.png' },
  { name: 'DLX', src: '/logos/dlx.png' }, { name: 'Oilfilters', src: '/logos/oilfilters.png' },
  { name: 'Tellantas', src: '/logos/tellantas.png' },
];
const line2Logos: Logo[] = [
  { name: 'XtremeSecurity', src: '/logos/XtremeSecurity.png' }, { name: 'GruasVIP', src: '/logos/GruasVIP.png' },
  { name: 'Halifax', src: '/logos/Halifax.png' }, { name: 'MedalloCustoms', src: '/logos/MedalloCustoms.png' },
  { name: 'Tractomulas', src: '/logos/Tractomulas.png' },
];
const line3Logos: Logo[] = [
  { name: 'Cerolio', src: '/logos/Cerolio.png' }, { name: 'IndustriasQatar', src: '/logos/IndustriasQatar.png' },
  { name: 'XecuroHelmets', src: '/logos/XecuroHelmets.png' }, { name: 'AMT', src: '/logos/AMT.png' },
  { name: 'Rent4Racing', src: '/logos/Rent4Racing.png' },
];

const reviews: ReviewData[] = [
  { name: 'Juan Pérez', rating: 5, comment: 'Qué genial poder ahorrar en la compra de mis llantas, ya hacia falta' },
  { name: 'María Gómez', rating: 4, comment: 'Me encanta ser parte de MotorManía. Es emocionante' },
  { name: 'Carlos Rodríguez', rating: 5, comment: 'El soporte es excelente. Me ayudaron a encontrar el negocio que necesitaba' },
  { name: 'Ana López', rating: 5, comment: 'Increíble el juego de fantasía de la F1, solo decirles ufff' },
  { name: 'Pedro Sánchez', rating: 4, comment: 'Gran comunidad para los amantes de los autos. ¡Recomendado!' },
  { name: 'Sofía Martínez', rating: 5, comment: 'Obtuve un descuento increíble en repuestos gracias a MotorManía.' },
  { name: 'Luis Ramírez', rating: 4, comment: 'El proceso de registro fue súper fácil, y los beneficios son geniales.' },
  { name: 'Clara Fernández', rating: 5, comment: '¡Ganar un sorteo fue una sorpresa increíble! Gracias, MotorManía.' },
  { name: 'Diego Torres', rating: 4, comment: 'Las promociones de los socios son muy útiles para mi taller.' },
  { name: 'Valeria Díaz', rating: 5, comment: 'Ser parte de este club ha hecho que mis gastos sean más económicos.' },
  { name: 'Andrés Morales', rating: 4, comment: 'Me gusta la variedad. ¡Siempre hay algo nuevo!' },
  { name: 'Laura Vargas', rating: 5, comment: 'El mejor club para fanáticos de los autos en Colombia.' },
  { name: 'Javier Castillo', rating: 4, comment: 'Esperando con ansias lo siguiente.' },
  { name: 'Camila Rojas', rating: 5, comment: 'El soporte al cliente es rápido y muy profesional.' },
  { name: 'Felipe Gómez', rating: 4, comment: 'Las invitaciones a eventos son un toque especial.' },
  { name: 'Natalia Ortiz', rating: 5, comment: 'He ahorrado mucho en servicios automotrices con MotorManía.' },
  { name: 'Santiago Gonzales', rating: 4, comment: 'Creo que es la empresa más genial de Colombia' },
  { name: 'Mateo Silva', rating: 4, comment: 'La comunidad es increíble, siempre hay algo nuevo que descubrir.' },
  { name: 'Gabriela Mendoza', rating: 5, comment: 'MotorManía ha superado todas mis expectativas.' },
  { name: 'Elena Castro', rating: 5, comment: '¡Los sorteos y descuentos son lo mejor! Súper recomendado.' },
];

const entryData: Record<Tier, number[]> = {
  Intro: [1, 2, 3, 4, 5],
  Estándar: [4, 8, 12, 16, 20],
  Premium: [10, 20, 30, 40, 50],
};
const maxEntries: Record<Tier, number> = { Intro: 5, Estándar: 20, Premium: 50 };

const categories = [
  { title: 'Automotriz', description: 'Tu tienda única para ofertas exclusivas en talleres, repuestos, accesorios y más.', image: '/images/automotriz.png' },
  { title: 'Servicios y Artículos del Hogar', description: 'Descubre servicios y productos para el hogar con descuentos exclusivos.', image: '/images/servicios_hogar.png' },
  { title: 'Merch', description: 'Explora nuestra colección oficial de MotorManía Colombia para fanáticos.', image: '/images/merch.png' },
];

const signUpBenefits = [
  { num: 'Gratis', text: 'Participa en sorteos gratis' },
  { num: 'F1', text: 'Vive la emoción de la F1' },
  { num: 'Aliados', text: 'Ahorra gracias al ecosistema de aliados' },
];

// --- Constants ---
const REVIEWS_PER_PAGE = 3; // Number of reviews visible at once
const REVIEW_AUTOROTATE_INTERVAL = 7000; // milliseconds

// --- Helper Function for Tracking ---
const trackEvent = (
  eventName: 'ViewContent' | 'ButtonClick' | 'Lead',
  params: Record<string, any>,
  userEmail: string | null | undefined
): void => { // Added void return type
  trackFBEvent(eventName, {
    params,
    email: userEmail || '', // Ensure email is always a string
    event_id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
  });
};

// --- Component ---
export default function Home() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth(); // Get token function from Clerk

  const [selectedTier, setSelectedTier] = useState<Tier>('Intro'); // For the Entries Tracker view
  const [currentReviewPage, setCurrentReviewPage] = useState(0); // Page index (0, 1, 2...)
  const [userTier, setUserTier] = useState<Tier | null>(null); // User's actual tier from DB
  const [isFetchingTier, setIsFetchingTier] = useState<boolean>(false); // Loading state for tier fetch

  const reviewControls: AnimationControls = useAnimation(); // Controls for Framer Motion animations
  const autoRotateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalReviewPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const userEmail = user?.primaryEmailAddress?.emailAddress; // Cache user email

  // --- Effects ---

  // Track ViewContent on initial load
  useEffect(() => {
    trackEvent('ViewContent', { page: 'home' }, userEmail);
  }, [userEmail]); // Depend only on userEmail changes

  // Fetch user tier from Supabase when signed in status changes
  // Fetch user tier from Supabase when signed in status changes
  useEffect(() => {
    let isMounted = true; // Prevent state update on unmounted component

    const fetchUserTier = async () => {
      // Reset states if user is not signed in
      if (!isSignedIn || !user) {
        if (isMounted) {
          setUserTier(null);
          setSelectedTier('Intro'); // Reset view if user logs out
          setIsFetchingTier(false);
        }
        return;
      }

      if(isMounted) setIsFetchingTier(true); // Set loading state only if mounted

      try {
        const jwt = await getToken({ template: 'supabase' });
        if (!jwt) {
          console.warn('Supabase token not available.');
           if (isMounted) {
               setUserTier('Intro'); // Default if no token
               setSelectedTier('Intro');
           }
           return; // Stop if no token
        }

        const supabase = createAuthClient(jwt);
        const { data, error } = await supabase
          .from('clerk_users')
          .select('tier')
          .eq('clerk_id', user.id)
          .maybeSingle(); // Fetches one row or null

        if (error) throw error; // Throw if Supabase returned an error

        if (isMounted) {
          // ---- CORRECTED LOGIC ----
          const tierFromData = data?.tier; // Safely access tier (string | null | undefined)

          // Check if tierFromData is one of the valid Tier literals
          const isValidTier = (['Intro', 'Estándar', 'Premium'] as Tier[]).includes(tierFromData as Tier); // Cast here is okay for includes check

          // Determine the final tier, defaulting to 'Intro'
          const resolvedTier: Tier = isValidTier ? (tierFromData as Tier) : 'Intro';
          // ---- END CORRECTED LOGIC ----

          setUserTier(resolvedTier);
          setSelectedTier(resolvedTier); // Set the initial view to the user's actual tier
        }
      } catch (err) {
        console.error('Error fetching user tier:', err instanceof Error ? err.message : String(err));
        if (isMounted) {
          setUserTier('Intro'); // Default to Intro on error
          setSelectedTier('Intro');
        }
      } finally {
          if (isMounted) setIsFetchingTier(false); // Ensure loading state is turned off
      }
    };

    fetchUserTier();

    return () => {
      isMounted = false; // Cleanup function
    };

  }, [isSignedIn, user, getToken]); // Dependencies


  // --- Review Carousel Logic ---

  // Animate carousel to a specific page index
  const animateToPage = useCallback((pageIndex: number) => {
    reviewControls.start({
      x: `-${pageIndex * 100}%`, // Move by percentage based on page index
      transition: { duration: 0.5, ease: 'easeInOut' },
    });
  }, [reviewControls]);

  // Go to the next page
  const handleNextPage = useCallback(() => {
    setCurrentReviewPage((prevPage) => {
      const nextPage = Math.min(prevPage + 1, totalReviewPages - 1);
      if (nextPage !== prevPage) { // Only animate if page actually changes
          animateToPage(nextPage);
      }
      return nextPage;
    });
    resetAutoRotateTimer(); // Reset timer on manual navigation
  }, [totalReviewPages, animateToPage]);

  // Go to the previous page
  const handlePrevPage = useCallback(() => {
    setCurrentReviewPage((prevPage) => {
      const nextPage = Math.max(prevPage - 1, 0);
       if (nextPage !== prevPage) { // Only animate if page actually changes
          animateToPage(nextPage);
      }
      return nextPage;
    });
    resetAutoRotateTimer(); // Reset timer on manual navigation
  }, [animateToPage]);

  // Go to a specific page index (e.g., from pagination dots)
  const goToPage = useCallback((pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < totalReviewPages) {
      setCurrentReviewPage(pageIndex);
      animateToPage(pageIndex);
      resetAutoRotateTimer(); // Reset timer on manual navigation
    }
  }, [totalReviewPages, animateToPage]);


  // Function to reset (or start) the auto-rotate timer
  const resetAutoRotateTimer = useCallback((pause = false) => {
    // Clear any existing interval
    if (autoRotateIntervalRef.current) {
      clearInterval(autoRotateIntervalRef.current);
      autoRotateIntervalRef.current = null;
    }
    // Start a new interval if not paused and there's more than one page
    if (!pause && totalReviewPages > 1) {
      autoRotateIntervalRef.current = setInterval(() => {
        setCurrentReviewPage((prevPage) => {
          const nextPage = (prevPage + 1) % totalReviewPages; // Loop back to 0
          animateToPage(nextPage);
          return nextPage;
        });
      }, REVIEW_AUTOROTATE_INTERVAL);
    }
  }, [totalReviewPages, animateToPage]); // Dependencies: total pages and the animation function

  // Effect to start/manage the auto-rotate timer
  useEffect(() => {
    resetAutoRotateTimer(); // Start the timer initially when the component mounts or totalPages changes
    // Cleanup function to clear the interval when the component unmounts
    return () => {
      if (autoRotateIntervalRef.current) {
        clearInterval(autoRotateIntervalRef.current);
      }
    };
  }, [resetAutoRotateTimer]); // Run when reset function identity changes (includes its own dependencies)

  // --- Component Render ---
  return (
    // Added overflow-x-hidden to prevent horizontal scroll caused by animations/carousels
    <div className="min-h-screen text-white overflow-x-hidden bg-gray-950 font-exo2">
      <MovingBar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:pt-24 sm:pb-28 sm:px-6 lg:px-8 text-center overflow-hidden">
        {/* Background Decorative Glows */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/5 w-48 h-48 sm:w-72 sm:h-72 bg-amber-500/10 rounded-full filter blur-3xl animate-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-cyan-500/10 rounded-full filter blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <motion.span
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="text-amber-400 text-lg sm:text-xl font-semibold mb-4 block" // Used font-semibold
          >
            ¡El mejor club de beneficios en el sector automotriz!
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 mb-6 drop-shadow-[0_0_15px_rgba(255,191,0,0.6)]"
          >
            MotorManía Colombia
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg sm:text-xl md:text-2xl text-gray-300 mt-4 mb-10 max-w-2xl mx-auto"
          >
            Ahorro, velocidad y premios para los apasionados por los carros y las motos en Colombia.
          </motion.p>

          {/* Framed CTA Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="animate-rotate-border rounded-2xl p-0.5 max-w-lg mx-auto"
            style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 15deg, #f59e0b 30deg, #22d3ee 60deg, #f59e0b 90deg, transparent 105deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: '5s' } as React.CSSProperties}
          >
            <div className="bg-gradient-to-br from-gray-900 via-black to-gray-950 p-6 sm:p-8 rounded-2xl flex flex-col items-center gap-6">
              {/* Primary CTA */}
              <Link
                href={isSignedIn ? '/dashboard' : '/sign-up'}
                onClick={() => trackEvent(isSignedIn ? 'ButtonClick' : 'Lead', { page: 'home', button: isSignedIn ? 'dashboard' : 'signup' }, userEmail)}
                className="relative w-full sm:w-auto bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-8 py-4 rounded-lg font-semibold text-lg hover:from-amber-600 hover:to-cyan-600 hover:shadow-[0_0_25px_rgba(34,211,238,0.7)] transition-all duration-300 animate-pulse-glow transform hover:scale-105"
              >
                {isSignedIn ? 'IR A MI DASHBOARD' : '¡UNIRME AHORA!'}
              </Link>
              {/* Secondary Links */}
              <div className="flex flex-col sm:flex-row gap-x-6 gap-y-3 text-sm sm:text-base">
                <Link href="/aliados" onClick={() => trackEvent('ButtonClick', { page: 'home', button: 'aliados' }, userEmail)}
                      className="text-amber-400 hover:text-amber-300 transition-colors duration-300 group">
                  Explorar Aliados <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </Link>
                <span className="hidden sm:inline text-gray-600">|</span>
                <Link href={isSignedIn ? '/fantasy' : '/landing-fantasy'} onClick={() => trackEvent('ButtonClick', { page: 'home', button: 'juega_y_gana' }, userEmail)}
                      className="text-cyan-400 hover:text-cyan-300 transition-colors duration-300 group">
                  Juega y Gana <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Partners Carousel Section */}
      <section className="relative py-12 sm:py-16 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
           <motion.h2
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-4"
           > Nuestros Socios </motion.h2>
           <motion.p
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay:0.1 }} viewport={{ once: true }}
             className="text-center text-gray-400 mb-10 max-w-2xl mx-auto"
           >
             Accede a descuentos y beneficios exclusivos con nuestra red de aliados en constante crecimiento.
           </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} viewport={{ once: true }}
            className="animate-rotate-border rounded-2xl p-0.5"
            style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #4f46e5 20deg, #ec4899 30deg, #4f46e5 40deg, transparent 50deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: '7s' } as React.CSSProperties}
          >
            <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-2xl">
              <InfiniteLogoCarousel
                topLineLogos={line1Logos} middleLineLogos={line2Logos} bottomLineLogos={line3Logos}
                speed="normal"
              />
            </div>
          </motion.div>
           <motion.div
             initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }} viewport={{ once: true }}
             className="text-center mt-8"
           >
               <Link href="/aliados" onClick={() => trackEvent('ButtonClick', { page: 'home', button: 'ver_todos_aliados' }, userEmail)}
                     className="text-amber-400 hover:text-amber-300 transition-colors duration-300 group text-lg">
                 Ver todos los Aliados <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>
               </Link>
           </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
           <motion.h2
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}
             className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-12"
           > Explora Nuestras Ofertas </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: index * 0.15 }} viewport={{ once: true }}
                className="animate-rotate-border rounded-xl p-0.5 overflow-hidden group/card" // Group for hover effect on image
                style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: '6s' } as React.CSSProperties}
              >
                {/* Ensure consistent height and flex layout */}
                <div className="p-6 bg-gradient-to-br from-gray-950 to-black rounded-xl shadow-lg backdrop-blur-sm h-full flex flex-col">
                  <div className="relative w-full h-48 mb-4 overflow-hidden rounded-lg">
                    <Image
                      src={item.image} alt={`${item.title} category`} fill sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover rounded-lg group-hover/card:scale-105 transition-transform duration-300" // Image zoom on card hover
                      priority={index === 0} // Prioritize loading the first image
                      loading={index > 0 ? 'lazy' : undefined} // Lazy load subsequent images
                    />
                  </div>
                  <h3 className="text-amber-400 text-xl sm:text-2xl font-bold mb-2">{item.title}</h3>
                  {/* flex-grow pushes content down if card heights differ slightly */}
                  <p className="text-gray-300 text-sm sm:text-base flex-grow">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* F1 Fantasy and MMC-GO Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-900"> {/* Subtle background change */}
        <div className="max-w-7xl mx-auto">
           <motion.h2
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}
             className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-12"
           > ¡Vive la Emoción del Automovilismo! </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* F1 Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} viewport={{ once: true }}
              className="animate-rotate-border rounded-xl p-0.5 overflow-hidden"
              style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #9333ea 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: '5s' } as React.CSSProperties}
            >
              {/* Flex + Justify between pushes button to bottom */}
              <div className="p-6 bg-gradient-to-br from-gray-950 to-black rounded-xl shadow-lg backdrop-blur-sm h-full flex flex-col justify-between">
                <div>
                    <h3 className="text-cyan-400 text-xl sm:text-2xl font-bold mb-2">F1 Fantasy: ¡Predice y Gana!</h3>
                    <p className="text-gray-300 text-sm sm:text-base mb-6">
                      Adivina los podios de la Fórmula 1, compite con fanáticos y gana premios exclusivos.
                    </p>
                </div>
                <Link href={isSignedIn ? '/fantasy' : '/landing-fantasy'} onClick={() => trackEvent('ButtonClick', { page: 'home', button: 'f1_fantasy' }, userEmail)}>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }} whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-6 py-3 rounded-full font-semibold hover:from-cyan-600 hover:to-purple-600 transition-all"
                  > Jugar F1 Fantasy Ahora </motion.button>
                </Link>
              </div>
            </motion.div>
            {/* MMC-GO Card */}
             <motion.div
               initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true }}
               className="animate-rotate-border rounded-xl p-0.5 overflow-hidden"
               style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: '6s' } as React.CSSProperties}
             >
               {/* Flex + Justify between pushes button to bottom */}
               <div className="p-6 bg-gradient-to-br from-gray-950 to-black rounded-xl shadow-lg backdrop-blur-sm h-full flex flex-col justify-between">
                 <div>
                    <h3 className="text-amber-400 text-xl sm:text-2xl font-bold mb-2">MMC-GO: ¡Apuesta por la Velocidad!</h3>
                    <p className="text-gray-300 text-sm sm:text-base mb-6">
                      Participa en nuestro juego exclusivo, elige tus picks y vive la adrenalina. <span className="text-xs text-gray-500">(¡Próximamente!)</span> {/* Added clarification */}
                    </p>
                 </div>
                 <Link href="/mmc-go" onClick={() => trackEvent('ButtonClick', { page: 'home', button: 'mmc_go' }, userEmail)}>
                   <motion.button
                     whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(245, 158, 11, 0.5)' }} whileTap={{ scale: 0.95 }}
                     className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-cyan-500 text-white px-6 py-3 rounded-full font-semibold hover:from-amber-600 hover:to-cyan-600 transition-all"
                     // disabled // Uncomment if MMC-GO isn't live yet and you want to disable the button visually
                     // className={`... ${true ? 'opacity-50 cursor-not-allowed' : ''}`} // Conditional styling for disabled
                   > Jugar MMC-GO Ahora </motion.button>
                 </Link>
               </div>
             </motion.div>
          </div>
        </div>
      </section>

      {/* Reviews Carousel Section */}
       <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative">
         <motion.h2
           initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}
           className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-12"
         > Lo que Dicen Nuestros Miembros </motion.h2>

         {/* Carousel Container */}
         <div
           className="relative overflow-hidden cursor-grab active:cursor-grabbing" // Add grab cursors for desktop interaction hint
           onMouseEnter={() => resetAutoRotateTimer(true)} // Pause auto-rotate on hover
           onMouseLeave={() => resetAutoRotateTimer()} // Resume auto-rotate on leave
           onTouchStart={() => resetAutoRotateTimer(true)} // Pause on touch start
           onTouchEnd={() => resetAutoRotateTimer()} // Resume on touch end
         >
           {reviews.length > 0 ? (
             <>
               {/* Framer Motion Draggable Div */}
               <motion.div
                 role="region"
                 aria-label="Reviews carousel"
                 // aria-live="off" // 'off' is suitable if auto-rotate is too noisy for screen readers; controls provide navigation
                 className="w-full"
                 drag="x" // Enable horizontal dragging
                 dragConstraints={{ left: 0, right: 0 }} // Prevent dragging beyond bounds (animation handles movement)
                 dragElastic={0.2} // Elasticity when dragging ends (can be adjusted)
                 onDragEnd={(event, { offset, velocity }) => {
                     const swipePower = Math.abs(offset.x) * velocity.x;
                     const swipeThreshold = 5000; // Adjust sensitivity as needed

                     if (swipePower < -swipeThreshold) {
                         handleNextPage(); // Swipe left
                     } else if (swipePower > swipeThreshold) {
                         handlePrevPage(); // Swipe right
                     } else {
                         // Optional: Animate back to the current page if swipe wasn't strong enough
                         animateToPage(currentReviewPage);
                     }
                 }}
                 animate={reviewControls} // Link to animation controls
                 initial={{ x: '0%' }} // Start at the beginning
               >
                 {/* Inner container holding all review cards */}
                 <div className="flex">
                   {reviews.map((review, index) => {
                     // Determine if the slide is currently visible (or partially visible)
                     const currentPageStart = currentReviewPage * REVIEWS_PER_PAGE;
                     const isVisible = index >= currentPageStart && index < currentPageStart + REVIEWS_PER_PAGE;

                     return (
                       <div
                         key={`${review.name}-${index}`} // Use a unique key for each review card
                         className="flex-shrink-0 w-full sm:w-1/3 px-3 sm:px-4" // Width based on REVIEWS_PER_PAGE, added padding
                         aria-hidden={!isVisible} // Hide non-visible slides from screen readers
                         style={{ touchAction: 'pan-y' }} // Allow vertical scroll while dragging horizontally
                       >
                         {/* Review Card Structure (Framed) */}
                         <div
                           className="animate-rotate-border rounded-xl p-0.5 overflow-hidden h-full" // Ensure cards take full height of their row
                           style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: `${5 + index % 3}s` } as React.CSSProperties} // Vary animation slightly
                         >
                           {/* Flex + Justify between pushes name to bottom */}
                           <div className="p-6 bg-gradient-to-br from-gray-950 to-black rounded-xl shadow-lg backdrop-blur-sm relative h-full flex flex-col justify-between">
                             {/* Decorative Quote Icon */}
                             <div aria-hidden="true" className="absolute top-4 left-4 text-amber-400 text-4xl opacity-10 z-0">
                               <svg fill="currentColor" viewBox="0 0 24 24" className="w-10 h-10"><path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.003-.002 2.999 1.999c.003-.001.006-.002.009-.004 5.162-1.278 9.973-5.72 9.973-12.601v-7.392h-3.995zm12 0v7.391c0 5.704-3.748 9.571-9 10.609l-.003-.002 3 1.999c.003-.001.006-.002.009-.004 5.168-1.278 9.982-5.72 9.982-12.601v-7.392h-3.988z" /></svg>
                             </div>
                             {/* Content Area */}
                             <div className="relative z-10"> {/* Ensure content is above quote icon */}
                               <div className="flex justify-center mb-4">
                                 {Array.from({ length: 5 }).map((_, starIndex) => (
                                   <svg key={starIndex} className={`w-6 h-6 sm:w-7 sm:h-7 ${starIndex < review.rating ? 'text-amber-400' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                 ))}
                               </div>
                               <p className="text-gray-300 text-sm sm:text-base italic mb-4">{`"${review.comment}"`}</p> {/* Added quotes */}
                             </div>
                             {/* Name pushed to bottom */}
                             <h3 className="text-amber-400 text-lg font-semibold text-center mt-auto relative z-10">{review.name}</h3>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </motion.div>

               {/* Navigation Buttons */}
               <button onClick={handlePrevPage} disabled={currentReviewPage === 0} aria-label="Previous reviews"
                       className="absolute top-1/2 left-0 sm:left-2 transform -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-800/60 backdrop-blur-sm text-white hover:bg-amber-500/80 transition-all duration-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed z-20">
                 <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
               </button>
               <button onClick={handleNextPage} disabled={currentReviewPage >= totalReviewPages - 1} aria-label="Next reviews"
                       className="absolute top-1/2 right-0 sm:right-2 transform -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-800/60 backdrop-blur-sm text-white hover:bg-amber-500/80 transition-all duration-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed z-20">
                 <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
               </button>

               {/* Pagination Dots */}
               <div className="flex justify-center mt-8 space-x-3">
                 {Array.from({ length: totalReviewPages }).map((_, index) => (
                   <button key={index} onClick={() => goToPage(index)} aria-label={`Go to review page ${index + 1}`}
                           aria-current={currentReviewPage === index ? 'true' : 'false'} // Indicate current page
                           className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${currentReviewPage === index ? 'bg-amber-400 scale-125' : 'bg-gray-600 hover:bg-amber-400/50'}`}
                   />
                 ))}
               </div>
             </>
           ) : (
             <p className="text-gray-400 text-center">No hay reseñas disponibles en este momento.</p>
           )}
         </div>
       </section>

      {/* Entries Tracker Component */}
       <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-950 via-black to-gray-950">
         <div className="max-w-5xl mx-auto text-center">
           <motion.h2
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}
             className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-6"
           > ¡Tus Entradas Se Acumulan! </motion.h2>
           <motion.p
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} viewport={{ once: true }}
             className="text-gray-400 mb-10 text-lg"
           >
             Cuanto más tiempo seas miembro, más entradas acumulas para nuestros sorteos mensuales.
             {/* Show user's tier if logged in and not loading */}
             {isSignedIn && !isFetchingTier && userTier && (
               <span className="block mt-2 text-amber-300 font-semibold">Tu membresía actual: {userTier}</span>
             )}
             {isFetchingTier && ( // Optional: Show a simple loading indicator
                 <span className="block mt-2 text-gray-500 font-semibold animate-pulse">Cargando tu membresía...</span>
             )}
           </motion.p>
           <motion.div
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} viewport={{ once: true }}
             className="animate-rotate-border rounded-xl p-0.5 overflow-hidden"
             style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: '6s' } as React.CSSProperties}
           >
             <div className="relative bg-gradient-to-br from-gray-950 to-black backdrop-blur-sm rounded-xl p-4 sm:p-8 shadow-lg">
               {/* Tier Selection Buttons */}
                <div className="flex justify-center gap-3 sm:gap-4 mb-8 flex-wrap">
                  {(['Intro', 'Estándar', 'Premium'] as const).map((tier) => (
                    <motion.button
                      key={tier}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedTier(tier)}
                      className={`px-3 sm:px-5 py-2 rounded-full font-semibold transition-all duration-300 text-xs sm:text-base border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black ${
                        selectedTier === tier
                          ? tier === 'Intro' ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_10px_rgba(251,191,36,0.7)] focus:ring-amber-500'
                          : tier === 'Estándar' ? 'bg-teal-500 border-teal-400 text-white shadow-[0_0_10px_rgba(20,184,166,0.7)] focus:ring-teal-500'
                          : 'bg-cyan-500 border-cyan-400 text-white shadow-[0_0_10px_rgba(34,211,238,0.7)] focus:ring-cyan-500'
                        : userTier === tier && isSignedIn // Highlight user's actual tier if logged in
                          ? 'bg-transparent border-amber-400 text-amber-300 focus:ring-amber-500' // Distinct style for user's current tier (not selected)
                          : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:bg-gray-600/50 hover:border-gray-500 focus:ring-gray-500' // Default non-selected style
                      }`}
                    >
                      {tier} {userTier === tier && isSignedIn && <span className="text-xs font-normal opacity-80 ml-1">(Tu Nivel)</span>}
                    </motion.button>
                  ))}
                </div>

               {/* Entry Rows with Animation */}
               <AnimatePresence mode="wait">
                 <motion.div
                   key={selectedTier} // Key change triggers enter/exit animation
                   initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }}
                   className="space-y-4"
                 >
                   {Array.from({ length: 5 }, (_, monthIndex) => {
                     const month = monthIndex + 1;
                     const entries = entryData[selectedTier][monthIndex];
                     const max = maxEntries[selectedTier];
                     // Adjusted progress for better visual fill, max 90% to leave space for label/count
                     const progressPercentage = Math.min((entries / max) * 100, 100); // Use 100% for fill
                     const tierColors = selectedTier === 'Intro'
                       ? 'from-amber-600 to-amber-400'
                       : selectedTier === 'Estándar'
                         ? 'from-teal-600 to-teal-400' // Adjusted Estándar colors slightly
                         : 'from-cyan-600 to-cyan-400';

                     return (
                       <motion.div
                         key={month}
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: monthIndex * 0.05 }}
                         className="flex items-center justify-between flex-row gap-3 sm:gap-4"
                       >
                         {/* Month Label */}
                         <div className="flex items-center text-gray-300 text-sm sm:text-base w-1/5 sm:w-1/6 flex-shrink-0">
                           <svg aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                           Mes {month}
                         </div>
                         {/* Progress Bar Container */}
                         <div className="w-3/5 sm:w-3/5 flex-grow relative group"> {/* Group for potential tooltip */}
                           <div className="h-6 sm:h-8 rounded-full bg-gray-700/50 overflow-hidden relative">
                             <motion.div
                               initial={{ width: 0 }}
                               animate={{ width: `${progressPercentage}%` }}
                               transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: monthIndex * 0.05 + 0.2 }} // Smoother easing
                               className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${tierColors}`}
                             />
                             {/* Optional: Add text inside or on hover if needed */}
                           </div>
                         </div>
                         {/* Entry Count */}
                         <div className="w-1/5 sm:w-1/6 text-right flex-shrink-0">
                           <motion.span
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.4, delay: monthIndex * 0.05 + 0.4 }}
                              className={`inline-block px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-white text-xs sm:text-sm font-bold shadow-md bg-gradient-to-r ${tierColors}`} // Adjusted padding/size slightly
                           >
                             {entries}
                           </motion.span>
                         </div>
                       </motion.div>
                     );
                   })}
                 </motion.div>
               </AnimatePresence>
             </div>
           </motion.div>
         </div>
       </section>

      {/* Sign Up Section */}
       <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative bg-gray-900"> {/* Consistent BG */}
         <div className="max-w-5xl mx-auto text-center">
           <motion.h2
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}
             className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-6"
           > ¡Regístrate y Gana! </motion.h2>
           <motion.p
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} viewport={{ once: true }}
             className="text-lg sm:text-xl text-gray-300 mb-10 sm:mb-12 max-w-3xl mx-auto"
           > Únete ahora y obtén <span className="text-amber-400 font-bold">5 números GRATIS</span> para el sorteo del LEGO F1. </motion.p>

           {/* Benefit Cards */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16 max-w-4xl mx-auto">
             {signUpBenefits.map((item, index) => (
               <motion.div
                 key={item.num}
                 initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: index * 0.1 }} viewport={{ once: true }}
                 className="animate-rotate-border rounded-xl p-0.5 overflow-hidden"
                 style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: `${6 + index}s` } as React.CSSProperties} // Varied duration slightly
               >
                 {/* Ensure cards have consistent height */}
                 <div className="p-5 sm:p-6 bg-gradient-to-br from-gray-950 to-black rounded-xl shadow-lg backdrop-blur-sm h-full">
                   <h3 className="text-amber-400 text-2xl sm:text-3xl font-bold mb-2">{item.num}</h3>
                   <p className="text-white text-sm sm:text-base">{item.text}</p>
                 </div>
               </motion.div>
             ))}
           </div>

            {/* Final CTA Button - Only shown if user is signed out */}
           <SignedOut>
               <motion.div
                 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} viewport={{ once: true }}
                 className="animate-rotate-border rounded-full p-0.5 inline-block" // Rounded full for button shape
                 style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 20deg, #f59e0b 40deg, #22d3ee 60deg, #f59e0b 80deg, transparent 100deg, transparent 360deg)`, '--border-angle': '0deg', animationDuration: '4s' } as React.CSSProperties}
               >
                   <div className="bg-gradient-to-br from-gray-950 to-black p-1 rounded-full"> {/* Inner padding for background */}
                     <Link
                       href="/sign-up"
                       onClick={() => trackEvent('Lead', { page: 'home', action: 'signup_click_final' }, userEmail)}
                       className="block bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-8 sm:px-12 py-3 sm:py-4 rounded-full text-lg sm:text-xl font-semibold hover:from-amber-600 hover:to-cyan-600 hover:shadow-[0_0_25px_rgba(34,211,238,0.8)] transition-all duration-300 animate-pulse-glow transform hover:scale-105"
                     >
                       ¡Quiero Mis Números Gratis!
                     </Link>
                   </div>
               </motion.div>
               <motion.p
                 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }} viewport={{ once: true }}
                 className="mt-6 text-gray-400 text-sm sm:text-base"
               > Solo necesitas un correo válido. Sin riesgos, sin complicaciones. </motion.p>

               {/* Sticky Mobile CTA - Only shown if user is signed out */}
               <motion.div
                 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.5 }} // Delayed appearance after scroll
                 className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 md:hidden" // Hide on medium screens and up
               >
                 <Link href="/sign-up" onClick={() => trackEvent('Lead', { page: 'home', action: 'signup_click_mobile_sticky' }, userEmail)}
                       className="bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-6 py-3 rounded-full font-semibold shadow-[0_5px_20px_rgba(34,211,238,0.4)] transition-all duration-300 animate-pulse-glow text-sm"
                 > ¡Únete Ahora Gratis! </Link>
               </motion.div>
           </SignedOut>
         </div>
       </section>
      {/* Minimal Footer */}
    </div>
  );
}