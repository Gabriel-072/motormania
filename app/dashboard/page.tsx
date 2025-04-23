// app/dashboard/page.tsx 
'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';

// --- Local Imports (Ensure paths are correct) ---
import { createAuthClient } from '@/lib/supabase';
import { openBoldCheckout } from '@/lib/bold';
import { trackFBEvent } from '@/lib/trackFBEvent';
import PicksResumen from '@/components/PicksResumen';

// --- Constants ---
// Reverted Bold amounts to original, ensure these are correct
const EXTRA_NUMBER_PRICE = 2000;
const EXTRA_NUMBER_COUNT = 5;
const BOLD_CURRENCY = 'COP';
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';
const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://motormaniacolombia.com'; // Use origin or fallback

// --- Helper Types ---
type UserData = { username: string | null; full_name: string | null; email: string | null; } | null;
type EntriesData = { numbers: string[]; paid_numbers_count?: number; } | null;

// --- Main Component ---
export default function DashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  // --- State ---
  const [entries, setEntries] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('Participante');
  const [userEmail, setUserEmail] = useState<string | null>(null); // Added state for email
  const [isLoading, setIsLoading] = useState<boolean>(true); // General data loading state
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState<boolean>(false); // Purchase success message
  const [showNumbers, setShowNumbers] = useState<boolean>(false); // Number list visibility
  // Removed: const [isBuyingNumbers, setIsBuyingNumbers] = useState<boolean>(false);

  const digitalIdRef = useRef<HTMLDivElement>(null);

  // --- Data Fetching Logic (Kept refined version) ---
  const fetchData = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn || !user?.id) {
      setIsLoading(false); setError(null); setUserName('Invitado'); setEntries([]);
      return;
    }
    setIsLoading(true); setError(null); setPaymentConfirmed(false);
    try {
      const jwt = await getToken({ template: 'supabase' });
      if (!jwt) throw new Error('Authentication token not available');
      const supabase = createAuthClient(jwt);

      const { data: userData, error: userError } = await supabase.from('clerk_users').select('username, full_name, email').eq('clerk_id', user.id).maybeSingle<UserData>();
      if (userError) throw new Error(`Error fetching user data: ${userError.message}`);
      const displayName = userData?.username || userData?.full_name || user.fullName || 'Participante';
      setUserName(displayName);
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      setUserEmail(primaryEmail || userData?.email || null); // Store email

      const { data: entriesData, error: entriesError } = await supabase.from('entries').select('numbers').eq('user_id', user.id).maybeSingle<EntriesData>();
      if (entriesError) throw new Error(`Error fetching entries: ${entriesError.message}`);
      const numbersArray: string[] = entriesData?.numbers || [];
      const formattedNumbers = numbersArray.map((num) => String(num).padStart(6, '0'));
      setEntries(formattedNumbers);
    } catch (err: unknown) {
      console.error("Dashboard fetch error:", err);
      const message = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      setError(`Error al cargar tus datos: ${message}. Intenta recargar o contacta a ${SUPPORT_EMAIL}`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, user?.id, user?.fullName, user?.primaryEmailAddress, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Event Handlers ---

  // Download Digital ID (Kept refined version)
  const downloadDigitalID = useCallback(async () => {
    const element = digitalIdRef.current;
    if (!element) { setError("No se pudo encontrar el carnet para descargar."); return; }
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      const canvas = await html2canvas(element, { backgroundColor: '#111827', scale: 2.5, useCORS: true, logging: false });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      const safeUserName = userName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `MotorMania_DigitalID_${safeUserName || 'usuario'}.png`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (err: unknown) {
      console.error("Error downloading Digital ID:", err);
      setError("Error al generar la imagen del carnet.");
    }
  }, [userName]);

  // --- Payment Handler - REVERTED to user's original logic ---
  const handleBuyExtraNumbers = async () => {
    // Original pre-checks
    if (!user?.id || !user?.primaryEmailAddress) {
        // Maybe set an error here in the refined version?
        setError("Información de usuario (ID o Email) incompleta para la compra.");
        return;
    }
     // API Key Check (Good practice to keep)
    const boldApiKey = process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY;
     if (!boldApiKey) {
        console.error("Bold API Key missing: NEXT_PUBLIC_BOLD_BUTTON_KEY");
        setError(`La configuración de pago no está disponible. Contacta a ${SUPPORT_EMAIL}.`); return;
    }

    // Removed: setIsBuyingNumbers(true);
    setError(null); // Keep error clearing
    setPaymentConfirmed(false); // Keep confirmation clearing

    const orderId = `ORDER-${Date.now()}`; // Original Order ID format

    try { // Added try/catch around fetch for hash
        const response = await fetch('/api/bold/hash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Use constants for price/currency
            body: JSON.stringify({ orderId, amount: EXTRA_NUMBER_PRICE, currency: BOLD_CURRENCY }),
        });

         if (!response.ok) { // Added check for fetch hash response
            let errorMsg = `Error getting payment signature (${response.status})`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (_) { }
            throw new Error(errorMsg);
        }

        const { hash } = await response.json();
        if (!hash) throw new Error("Invalid payment signature received."); // Added check for hash


        // --- Original openBoldCheckout call structure ---
        openBoldCheckout({
            apiKey: boldApiKey, // Use variable checked above
            orderId,
            amount: EXTRA_NUMBER_PRICE, // Use constant
            currency: BOLD_CURRENCY, // Use constant
            description: `Pago por ${EXTRA_NUMBER_COUNT} números extra`, // Use constant
            redirectionUrl: `${APP_ORIGIN}/dashboard`, // Use dynamic origin (original had hardcoded URL)
            integritySignature: hash,
            customerData: {
                // Use state variable for email if available, fallback to user object
                email: userEmail || user.primaryEmailAddress?.emailAddress,
                fullName: userName, // Use state variable
            },
            // Original onSuccess logic
            onSuccess: async () => {
                console.log(`Original Bold Success callback: ${orderId}`); // Added logging
                try {
                    const jwt = await getToken({ template: 'supabase' });
                    if (!jwt) throw new Error('No authentication token available post-payment');
                    const supabase = createAuthClient(jwt);

                    // Generate new numbers (same as original)
                    const newNumbers = Array.from({ length: EXTRA_NUMBER_COUNT }, () => // Use constant
                        Math.floor(100000 + Math.random() * 900000).toString()
                    );

                    // Get current entries (same as original)
                    const { data: currentEntries, error: fetchError } = await supabase // Added error handling
                        .from('entries')
                        .select('numbers, paid_numbers_count')
                        .eq('user_id', user.id)
                        .maybeSingle<EntriesData>(); // Use type

                    if (fetchError) throw new Error(`DB Error (fetch post-payment): ${fetchError.message}`); // Handle fetch error

                    const existingNumbers = (currentEntries?.numbers || []).map(String); // Ensure string array
                    const updatedNumbers = [...existingNumbers, ...newNumbers]; // Merge
                    const updatedPaidCount = (currentEntries?.paid_numbers_count || 0) + EXTRA_NUMBER_COUNT; // Use constant

                    // Upsert (same as original)
                    const { error: upsertError } = await supabase // Renamed error variable
                        .from('entries')
                        .upsert(
                            { user_id: user.id, numbers: updatedNumbers, paid_numbers_count: updatedPaidCount },
                            { onConflict: 'user_id' } // CONFIRM PK/UNIQUE
                        );

                    if (upsertError) throw new Error(`Error updating entries: ${upsertError.message}`); // Check upsert error

                    // Send confirmation email (same as original, ensure API route exists)
                    await fetch('/api/send-numbers-confirmation', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: userEmail || user.primaryEmailAddress?.emailAddress, // Use state email
                            name: userName, // Use state username
                            numbers: newNumbers, // Send only new numbers
                            amount: EXTRA_NUMBER_PRICE, // Use constant
                            orderId: orderId, // Include order ID
                        }),
                    }).catch(emailError => console.error("Non-blocking: Email confirmation error:", emailError)); // Add catch

                    // Track FB Event (same as original, using constants/state vars)
                    const eventId = `evt_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
                    const currentEmail = userEmail || user.primaryEmailAddress?.emailAddress || ''; // Ensure string

                    trackFBEvent('Purchase', {
                        params: {
                            page: 'dashboard',
                            value: EXTRA_NUMBER_PRICE / 100, // Send value in main currency unit
                            currency: BOLD_CURRENCY, // Use constant
                            orderId,
                            content_type: 'product', // Standard FB param
                            content_ids: ['EXTRA_NUMBERS_5'], // Example ID
                            // Removed: tipo: 'extra-numeros', unless specifically needed by FB CAPI
                        },
                        email: currentEmail,
                        event_id: eventId,
                    });

                    // Update local state (same as original)
                    setEntries(updatedNumbers.map((num: string) => String(num).padStart(6, '0')));
                    setPaymentConfirmed(true);
                    setShowNumbers(true); // Added: Show numbers automatically after successful purchase

                } catch (err: unknown) { // Use unknown
                    // Original only had console.error, now setting UI error
                    console.error('❌ Error in onSuccess:', err);
                    const message = err instanceof Error ? err.message : 'Error desconocido procesando el pago.';
                     // Inform user payment was OK (presumably), but processing failed
                     setError(`¡Pago recibido! PERO hubo un error al actualizar tus números (${message}). Contacta a ${SUPPORT_EMAIL} con tu Order ID: ${orderId}`);
                }
            },
            // Removed: onFailed, onPending, onClose handlers
        });

    } catch (err: unknown) { // Catch errors during hash fetch or checkout init
         console.error("Error initiating purchase flow:", err);
         const message = err instanceof Error ? err.message : 'Error inesperado al iniciar pago.';
         setError(message);
         // Removed: setIsBuyingNumbers(false);
    }
  };
  // --- End of reverted payment handler ---

  // Toggle Number List Visibility
  const toggleNumbers = () => { setShowNumbers(prev => !prev); };

  // --- Rendering Logic (Kept refined version with fixes) ---

  // Skeleton Loader Component
  const SkeletonLoader = ({ count = 5 }: { count?: number }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-gray-700/50 rounded-lg animate-pulse aspect-video" />
      ))}
    </div>
  );

  // Main Content Renderer
  const renderContent = () => {
    // 1. Initial Clerk Loading State
    if (!isLoaded) return (
      <div className="flex items-center justify-center space-x-3 p-6 bg-gray-800/50 rounded-lg mt-6">
        <motion.div aria-hidden="true" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 border-3 border-t-transparent border-amber-400 rounded-full" />
        <p className="text-gray-300 text-lg font-exo2">Verificando tu sesión...</p> {/* Hydration Fixed Text */}
      </div>
    );

    // 2. App Data Loading State (after Clerk is ready)
    if (isLoading && isSignedIn) return (
      <div className="mt-6 animate-rotate-border rounded-xl p-0.5" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '6s', '--border-angle': '0deg' } as React.CSSProperties}>
        <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white mb-4 font-exo2">Cargando tus números...</h3>
          <SkeletonLoader count={EXTRA_NUMBER_COUNT} />
        </div>
      </div>
    );

    // 3. Signed Out State
    if (!isSignedIn) return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center p-6 bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-lg border border-amber-500/30">
        <p className="text-amber-300 text-lg font-exo2 font-semibold">¡Hola Invitado!</p>
        <p className="text-gray-300 mt-2 font-exo2">Inicia sesión o regístrate para ver tu dashboard.</p>
        <div className="flex gap-4 justify-center mt-4">
          <Link href="/sign-in" className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-md">Iniciar Sesión</Link>
          <Link href="/sign-up" className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-md">Registrarse</Link>
        </div>
      </motion.div>
    );

    // 4. No Entries State (Signed In, Loaded, No Entries)
    if (entries.length === 0) return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center p-6 bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-lg border border-cyan-500/30">
        <p className="text-cyan-300 text-lg font-exo2 font-semibold">¡Bienvenido a MotorManía!</p>
        <p className="text-gray-300 mt-2 font-exo2">Aún no tienes números asignados.</p>
        <p className="text-gray-400 mt-1 font-exo2 text-sm">Compra números extra o participa en F1 Fantasy.</p>
        <div className="flex gap-4 justify-center mt-4">
           {/* Reverted Button - No disabled state based on isBuyingNumbers */}
          <button onClick={handleBuyExtraNumbers} disabled={!isLoaded || isLoading || !isSignedIn} className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-md disabled:opacity-60">Comprar Números</button>
          <Link href="/jugar-y-gana" className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-md">Ir a F1 Fantasy</Link>
        </div>
      </motion.div>
    );

    // 5. Default: Display Entries (Signed In, Loaded, Has Entries)
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="mt-6">
        <div className="animate-rotate-border rounded-xl p-0.5" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '6s', '--border-angle': '0deg' } as React.CSSProperties}>
          <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3 sm:gap-4">
              <h3 className="text-xl font-semibold text-white font-exo2 order-1 sm:order-none">Tus Números ({entries.length})</h3>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={toggleNumbers} aria-expanded={showNumbers} className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-cyan-500 text-white px-5 py-2 rounded-full font-semibold font-exo2 text-sm hover:from-amber-600 hover:to-cyan-600 transition-all shadow-md order-2 sm:order-none">
                {showNumbers ? 'Ocultar Números' : 'Mostrar Números'}
              </motion.button>
            </div>
            <AnimatePresence mode="wait">
              {showNumbers && (
                <motion.div key="numbers-list-animated" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease: "easeInOut" }} className="overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                    {entries.map((num, index) => (
                      <motion.div key={`${num}-${index}`} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.025, duration: 0.25, ease: "easeOut" }} className="relative bg-gray-800/60 p-3 rounded-lg text-center border border-amber-500/30 hover:border-amber-500/70 shadow-sm hover:shadow-md hover:shadow-amber-500/10 transition-all backdrop-blur-sm group aspect-video flex items-center justify-center">
                        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 to-purple-600/5 opacity-0 group-hover:opacity-60 transition-opacity rounded-lg duration-300" />
                        <span className="relative text-lg sm:text-xl md:text-2xl font-bold text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.4)] font-mono tracking-wider select-all">{num}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  };

  // --- Main Component JSX Return ---
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white overflow-x-hidden font-exo2">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-20">

        {/* Header */}
        <motion.h1 initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 tracking-tight">
          <span className="text-gray-400">¡Hola</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400">{userName}</span><span className="text-gray-400">!</span> <span className="text-2xl ml-2" role="img" aria-label="rocket">🚀</span>
        </motion.h1>

        {/* Error Display */}
        <AnimatePresence>
          {error && (<motion.div key="error-message-area" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6" role="alert" aria-live="assertive">
            <div className="bg-red-900/50 border border-red-600/70 text-red-200 px-4 py-3 rounded-lg text-sm sm:text-base shadow-md"><span className="font-semibold mr-2">Error:</span>{error}</div>
          </motion.div>)}
        </AnimatePresence>

        {/* Payment Confirmation */}
        <AnimatePresence>
          {paymentConfirmed && (<motion.div key="payment-confirmed-message" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mb-6" role="status">
            <div className="animate-rotate-border rounded-xl p-0.5" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #86efac 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '4s', '--border-angle': '0deg' } as React.CSSProperties}>
              <div className="bg-gradient-to-br from-gray-950 to-black p-4 rounded-xl shadow-lg backdrop-blur-sm text-green-300 text-center font-semibold text-sm sm:text-base"><span role="img" aria-label="party popper" className="mr-2">🎉</span> ¡Pago confirmado! Se agregaron {EXTRA_NUMBER_COUNT} números a tu cuenta.</div>
            </div>
          </motion.div>)}
        </AnimatePresence>

        {/* Main Content Area */}
        {renderContent()}

        {/* Buy Extra Numbers Section */}
        {isSignedIn && (<motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-10 sm:mt-12" aria-labelledby="buy-extra-heading">
          <div className="animate-rotate-border rounded-xl p-0.5" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #eab308 20deg, #f59e0b 30deg, #eab308 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '7s', '--border-angle': '0deg' } as React.CSSProperties}>
            <div className="bg-gradient-to-br from-gray-950 via-black to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center">
              <h3 id="buy-extra-heading" className="text-xl font-semibold text-white mb-2">¿Más Oportunidades de Ganar?</h3>
              <p className="text-gray-300 mb-5 text-sm sm:text-base">Agrega {EXTRA_NUMBER_COUNT} números extra por {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(EXTRA_NUMBER_PRICE)}.</p>
              {/* Reverted Button - No loading state or spinner */}
              <motion.button
                  whileHover={{ scale: 1.03, boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)'}} // Adjusted hover
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBuyExtraNumbers}
                  // Removed: disabled={isBuyingNumbers...} -> Use basic disabled check
                  disabled={!isLoaded || isLoading || !isSignedIn}
                  className={`relative inline-flex items-center justify-center w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group overflow-hidden shadow-md hover:from-amber-600 hover:to-orange-600 hover:shadow-lg hover:shadow-amber-500/20`}
              >
                  Quiero {EXTRA_NUMBER_COUNT} Números Extra
              </motion.button>
            </div>
          </div>
        </motion.section>)}

        {/* Other Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 mt-10 sm:mt-12">
          {/* F1 Fantasy Section */}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} aria-labelledby="f1-fantasy-heading">
            <div className="animate-rotate-border rounded-xl p-0.5 h-full" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #67e8f9 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '5s', '--border-angle': '0deg' } as React.CSSProperties}>
              <div className="bg-gradient-to-br from-gray-950 via-black/90 to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center h-full flex flex-col justify-between">
                <div><h2 id="f1-fantasy-heading" className="text-2xl font-bold text-cyan-400 mb-3">¡Acelerá tu Pasión!</h2><p className="text-gray-300 mb-6 text-sm sm:text-base">Juega en nuestro <span className="font-semibold text-white">F1 Fantasy</span>. ¡Predice podios, compite y gana!</p></div>
                <Link href="/jugar-y-gana" className="mt-4 block self-center"><motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(34, 211, 238, 0.4)' }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-8 py-3 rounded-full font-semibold hover:from-cyan-600 hover:to-purple-600 transition-all shadow-md">Jugar F1 Fantasy</motion.button></Link>
              </div>
            </div>
          </motion.section>
          {/* MMC-GO Section */}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }} aria-labelledby="mmc-go-heading">
            <div className="animate-rotate-border rounded-xl p-0.5 h-full" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #a855f7 20deg, #c084fc 30deg, #a855f7 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '6s', '--border-angle': '0deg' } as React.CSSProperties}>
              <div className="bg-gradient-to-br from-gray-950 via-black/90 to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center h-full flex flex-col justify-between">
                <div><h2 id="mmc-go-heading" className="text-2xl font-bold text-purple-400 mb-3">MMC-GO</h2><p className="text-gray-300 mb-6 text-sm sm:text-base">Participa en nuestro juego <span className="font-semibold text-white">MMC-GO</span> y vive la adrenalina.</p></div>
                <Link href="/mmc-go" className="mt-4 block self-center"><motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-violet-500 text-white px-8 py-3 rounded-full font-semibold hover:from-purple-600 hover:to-violet-600 transition-all shadow-md">Jugar MMC-GO</motion.button></Link>
              </div>
            </div>
          </motion.section>
        </div>

        {/* Picks Resumen Section */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }} className="mt-10 sm:mt-12" aria-labelledby="picks-resumen-heading">
          <div className="animate-rotate-border rounded-xl p-0.5" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #4ade80 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '8s', '--border-angle': '0deg' } as React.CSSProperties}>
            <div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm">
              <h2 id="picks-resumen-heading" className="text-xl sm:text-2xl font-semibold text-green-400 mb-4 text-center sm:text-left">Resumen de tus Picks F1</h2>
              <PicksResumen />
            </div>
          </div>
        </motion.section>

        {/* Digital ID Card Section */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7 }} className="mt-10 sm:mt-12 max-w-md mx-auto" aria-labelledby="digital-id-main-heading">
          <div className="animate-rotate-border rounded-xl p-0.5" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #facc15 20deg, #fde047 30deg, #facc15 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '6s', '--border-angle': '0deg' } as React.CSSProperties}>
            <div className="bg-gradient-to-br from-gray-950 via-black to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center">
              <h2 id="digital-id-main-heading" className="text-2xl font-semibold text-amber-300 mb-4">Carnet Digital MotorManía</h2>
              {/* Content Area for html2canvas */}
              <div ref={digitalIdRef} className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 rounded-lg mb-5 text-left relative overflow-hidden border border-amber-500/20 shadow-inner">
                <div className="flex justify-between items-start mb-4 relative z-10"><h3 className="text-lg font-bold text-amber-400">MotorManía ID</h3><p className="text-xs text-cyan-300 mt-1">Miembro Oficial</p></div>
                <p className="text-gray-300 text-sm mb-1 relative z-10">Nombre:<span className="block font-semibold text-base text-white break-words ml-1">{userName}</span></p>
                <p className="text-gray-400 text-xs mb-4 relative z-10">ID Usuario:<span className="block font-mono text-sm text-gray-200 ml-1">{user?.id || 'N/A'}</span></p>
                <div className="flex flex-col items-center mt-4 mb-4 relative z-10">
                  <div className="bg-white p-2 rounded-md shadow-md">
                    <QRCode value={user?.id ? `${APP_ORIGIN}/verify?uid=${user.id}` : 'invalid-user'} size={90} bgColor="#FFFFFF" fgColor="#111827" level="M" />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Escanea para verificar</p>
                </div>
                <p className="text-center text-gray-500 text-[10px] mt-3 relative z-10">&copy; {new Date().getFullYear()} MotorManía Colombia</p>
              </div>
              {/* Download Button */}
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={downloadDigitalID} disabled={!isLoaded || isLoading || !user?.id || !isSignedIn} className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 px-6 py-2.5 rounded-full font-semibold text-sm hover:from-yellow-400 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
                Descargar Carnet Digital
              </motion.button>
              <p className="text-xs text-gray-400 mt-3">Muestra este carnet en negocios aliados.</p>
            </div>
          </div>
        </motion.section>

      </main>
    </div>
  );
}