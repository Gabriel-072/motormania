// 📁 /app/dashboard/page.tsx
'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';

// --- Local Imports (Asegúrate que las rutas sean correctas) ---
import { createAuthClient } from '@/lib/supabase';
import { openBoldCheckout } from '@/lib/bold'; // Importa la función corregida
import PicksResumen from '@/components/PicksResumen';
import { trackFBEvent } from '@/lib/trackFBEvent'; // Importa si la usas aquí

// --- Constantes ---
const EXTRA_NUMBER_PRICE = 2000; // Tu precio actualizado
const EXTRA_NUMBER_COUNT = 5;
const BOLD_CURRENCY = 'COP';
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';
// Obtiene el origen dinámicamente o usa el de producción como fallback
const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://motormaniacolombia.com';

// --- Tipos ---
type UserData = { username: string | null; full_name: string | null; email: string | null; } | null;
type EntriesData = { numbers: string[]; paid_numbers_count?: number; } | null;
// Tipo para la respuesta esperada de /api/bold/hash
type BoldHashResponse = {
  orderId: string;
  amount: string; // <-- Espera string
  callbackUrl: string;
  integrityKey: string;
  metadata?: { reference: string };
};

// --- Componente Principal ---
export default function DashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  // --- Estado del Componente ---
  const [entries, setEntries] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('Participante');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading inicial de datos
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState<boolean>(false); // Para mensaje de éxito FE
  const [showNumbers, setShowNumbers] = useState<boolean>(false); // Visibilidad de números

  const digitalIdRef = useRef<HTMLDivElement>(null); // Ref para descargar ID

  // --- Carga de Datos ---
  const fetchData = useCallback(async (showLoading = true) => {
    console.log("fetchData called. showLoading:", showLoading); // Log para depurar
    if (!isLoaded) { console.log("fetchData: Clerk not loaded yet."); return; }
    if (!isSignedIn || !user?.id) {
      console.log("fetchData: User not signed in or no ID.");
      setIsLoading(false); setError(null); setUserName('Invitado'); setEntries([]);
      return;
    }

    console.log("fetchData: Fetching data for user:", user.id);
    if (showLoading) setIsLoading(true);
    // No limpiar error/confirmación en refresh de fondo para que el usuario vea mensajes previos
    // if (showLoading) { setError(null); setPaymentConfirmed(false); }

    try {
      const jwt = await getToken({ template: 'supabase' });
      if (!jwt) { console.error("fetchData: Supabase token not available."); throw new Error('Token no disponible'); }
      const supabase = createAuthClient(jwt);

      // Fetch user details (needed for name/email display)
      console.log("fetchData: Fetching user details...");
      const { data: userData, error: userError } = await supabase.from('clerk_users').select('username, full_name, email').eq('clerk_id', user.id).maybeSingle<UserData>();
      if (userError) throw userError;
      const displayName = userData?.username || userData?.full_name || user.fullName || 'Participante';
      setUserName(displayName);
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      setUserEmail(primaryEmail || userData?.email || null);
      console.log(`WorkspaceData: User details set. Name: ${displayName}, Email: ${userEmail}`);

      // Fetch entries
      console.log("fetchData: Fetching entries...");
      const { data: entriesData, error: entriesError } = await supabase.from('entries').select('numbers').eq('user_id', user.id).maybeSingle<EntriesData>();
      if (entriesError) throw entriesError;
      const numbersArray: string[] = entriesData?.numbers || [];
      const formattedNumbers = numbersArray.map((num) => String(num).padStart(6, '0'));
      setEntries(formattedNumbers);
      console.log(`WorkspaceData: Entries fetched. Count: ${formattedNumbers.length}`);

      // Limpiar error solo si la carga fue exitosa y no estamos mostrando confirmación de pago
      if (!paymentConfirmed) setError(null);

    } catch (err: unknown) {
      console.error("Dashboard fetch error:", err);
      const message = err instanceof Error ? err.message : 'Error inesperado.';
      // Solo mostrar error si no hay un mensaje de confirmación de pago activo
      if (!paymentConfirmed) {
          setError(`Error al cargar datos: ${message}.`);
      }
    } finally {
      if (showLoading) setIsLoading(false);
      console.log("fetchData finished.");
    }
    // Añadimos paymentConfirmed y error a las dependencias para que useCallback se actualice si cambian,
    // evitando cierres (closures) con valores viejos si se verifican dentro.
  }, [isLoaded, isSignedIn, user?.id, user?.fullName, user?.primaryEmailAddress, getToken, paymentConfirmed, error]);

  // Efecto para carga inicial y cuando cambian datos clave de usuario
  useEffect(() => {
    console.log("Dashboard useEffect triggered. Fetching initial data...");
    fetchData();
  }, [fetchData]); // fetchData ya incluye sus dependencias

  // --- Manejadores de Eventos ---

  const toggleNumbers = () => setShowNumbers(prev => !prev);

  const downloadDigitalID = useCallback(async () => {
    const element = digitalIdRef.current;
    if (!element) { setError("No se pudo encontrar carnet."); return; }
    try {
      await new Promise(r => setTimeout(r, 150));
      const canvas = await html2canvas(element, { backgroundColor: '#111827', scale: 2.5, useCORS: true, logging: false });
      const link = document.createElement('a'); link.href = canvas.toDataURL('image/png');
      const safeUserName = userName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `MotorMania_ID_${safeUserName || 'usuario'}.png`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (err: unknown) { console.error("Error downloading ID:", err); setError("Error al generar imagen."); }
  }, [userName]);

  // --- Manejador de Compra de Números (Corregido y Simplificado) ---
  const handleBuyExtraNumbers = async () => {
    console.log("handleBuyExtraNumbers called");
    // 1. Validar Usuario y Email de Forma Segura
    const userEmailAddress = user?.primaryEmailAddress?.emailAddress;
    if (!user?.id || !userEmailAddress) {
      console.error("handleBuyExtraNumbers Error: User ID or Email missing.");
      setError("Información de usuario (ID o Email) incompleta para la compra.");
      return;
    }

    // 2. Validar API Key Pública de Bold
    const boldApiKey = process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY;
    if (!boldApiKey) {
      console.error('handleBuyExtraNumbers Error: NEXT_PUBLIC_BOLD_BUTTON_KEY missing');
      setError('Error de configuración de pago (FE). Contacta a soporte.');
      return;
    }

    // Resetear estados antes de empezar
    setError(null);
    setPaymentConfirmed(false);
    // NO hay estado isBuyingNumbers aquí, el botón no mostrará spinner

    try {
      console.log("handleBuyExtraNumbers: Fetching payment hash...");
      // 3. Obtener Firma y Datos desde el Backend
      const response = await fetch('/api/bold/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: EXTRA_NUMBER_PRICE }), // Enviar precio
      });
      console.log("handleBuyExtraNumbers: Hash API response status:", response.status);

      if (!response.ok) {
        let errorMsg = 'Error generando firma de pago.';
        try { const errData = await response.json(); errorMsg = errData?.error || errorMsg; } catch (_) { }
        console.error("handleBuyExtraNumbers: Error from /api/bold/hash:", errorMsg);
        throw new Error(errorMsg);
      }

      // 4. Extraer Datos de la Respuesta (Esperando amount como string)
      const {
        orderId,
        amount: amountStr, // <-- Espera string
        callbackUrl,
        integrityKey,
      }: BoldHashResponse = await response.json(); // Usa el tipo definido
      console.log("handleBuyExtraNumbers: Received from API:", { orderId, amountStr, callbackUrl, integrityKeyExists: !!integrityKey });

      if (!orderId || !integrityKey || !callbackUrl || !amountStr) {
         console.error("handleBuyExtraNumbers: Missing crucial data from API response.");
         throw new Error('Respuesta inválida del servidor para iniciar el pago.');
      }

      // 5. Lanzar Bold Checkout (Usando la función de /lib/bold)
      console.log("handleBuyExtraNumbers: Calling openBoldCheckout...");
      openBoldCheckout({
        apiKey: boldApiKey,
        orderId: orderId,
        amount: amountStr, // <-- Pasa amount como STRING
        currency: BOLD_CURRENCY,
        description: `Pago por ${EXTRA_NUMBER_COUNT} números extra (${orderId.slice(-10)})`,
        // Usa los nombres que espera la librería Bold según la documentación/lib/bold.ts
        redirectionUrl: callbackUrl,
        integritySignature: integrityKey,
        customerData: JSON.stringify({
          email: userEmailAddress, // Usa variable segura
          fullName: userName,
        }),
        renderMode: 'embedded',
        // Callbacks para feedback inmediato en UI (Webhook es la fuente de verdad)
         onSuccess: () => {
             console.log(`Client-side Bold Success reported for: ${orderId}`);
             setPaymentConfirmed(true); // Muestra mensaje de éxito en FE
             setError(null);
             // Refresca datos en segundo plano después de un delay
             console.log("Client-side Success: Triggering background data refresh in 7 seconds...");
             setTimeout(() => { console.log("Executing background data refresh..."); fetchData(false); }, 7000); // Delay un poco más largo
         },
         onFailed: (details: any) => {
              console.warn(`Client-side Bold Failed/Cancelled: ${orderId}`, details);
              setError(`Pago falló o cancelado. ${details?.message ? `Razón: ${details.message}.` : ''}`);
              setPaymentConfirmed(false);
         },
         onClose: () => {
             console.log(`Client-side Bold Closed: ${orderId}`);
             // Podrías limpiar errores no críticos aquí si fuera necesario
         },
         onPending: (details: any) => {
              console.log(`Client-side Bold Pending: ${orderId}`, details);
              setError(`Pago pendiente. ${details?.message ? `Razón: ${details.message}.` : ''}`);
              setPaymentConfirmed(false);
         }
      });
      console.log("handleBuyExtraNumbers: openBoldCheckout called.");

    } catch (err: unknown) {
      console.error('❌ Error en handleBuyExtraNumbers:', err);
      setError(err instanceof Error ? err.message : 'Error inesperado iniciando el pago.');
      setPaymentConfirmed(false); // Asegura que no se muestre confirmación si hay error
    }
  };

  // --- Componente Interno: Skeleton Loader ---
const SkeletonLoader = ({ count = 5 }: { count?: number }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="bg-gray-700/50 rounded-lg animate-pulse aspect-video" />
    ))}
  </div>
);

  // --- Lógica de Renderizado ---
  const renderContent = () => {
      // 1. Loading de Clerk
      if (!isLoaded) return (<div className="flex items-center justify-center space-x-3 p-6 bg-gray-800/50 rounded-lg mt-6"><motion.div aria-hidden="true" animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} className="w-6 h-6 border-3 border-t-transparent border-amber-400 rounded-full"/><p className="text-gray-300 text-lg font-exo2">Verificando tu sesión...</p></div>);
      // 2. Loading de Datos (si está logueado)
      if (isLoading && isSignedIn) return (<div className="mt-6 animate-rotate-border rounded-xl p-0.5" style={{background:`conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`, animationDuration:'6s', '--border-angle':'0deg'} as React.CSSProperties}><div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm"><h3 className="text-xl font-semibold text-white mb-4 font-exo2">Cargando tus números...</h3><SkeletonLoader count={EXTRA_NUMBER_COUNT}/></div></div>);
      // 3. No Logueado
      if (!isSignedIn) return (<motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-6 text-center p-6 bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-lg border border-amber-500/30"><p className="text-amber-300 text-lg font-exo2 font-semibold">¡Hola Invitado!</p><p className="text-gray-300 mt-2 font-exo2">Inicia sesión o regístrate.</p><div className="flex gap-4 justify-center mt-4"><Link href="/sign-in" className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-md">Iniciar Sesión</Link><Link href="/sign-up" className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-md">Registrarse</Link></div></motion.div>);
      // 4. Logueado pero sin Números (y no está cargando)
      if (entries.length === 0) return (<motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-6 text-center p-6 bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-lg border border-cyan-500/30"><p className="text-cyan-300 text-lg font-exo2 font-semibold">¡Bienvenido a MotorManía!</p><p className="text-gray-300 mt-2 font-exo2">Aún no tienes números asignados.</p><p className="text-gray-400 mt-1 font-exo2 text-sm">Compra números extra o participa en F1 Fantasy.</p><div className="flex gap-4 justify-center mt-4"><button onClick={handleBuyExtraNumbers} disabled={!isLoaded || isLoading || !isSignedIn} className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-md disabled:opacity-60">Comprar Números</button><Link href="/jugar-y-gana" className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow-md">Ir a F1 Fantasy</Link></div></motion.div>);
      // 5. Default: Mostrar Números
      return (<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6,delay:0.1}} className="mt-6"><div className="animate-rotate-border rounded-xl p-0.5" style={{background:`conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #22d3ee 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`, animationDuration:'6s', '--border-angle':'0deg'} as React.CSSProperties}><div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm"><div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3 sm:gap-4"><h3 className="text-xl font-semibold text-white font-exo2 order-1 sm:order-none">Tus Números ({entries.length})</h3><motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={toggleNumbers} aria-expanded={showNumbers} className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-cyan-500 text-white px-5 py-2 rounded-full font-semibold font-exo2 text-sm hover:from-amber-600 hover:to-cyan-600 transition-all shadow-md order-2 sm:order-none">{showNumbers?'Ocultar':'Mostrar'} Números</motion.button></div><AnimatePresence mode="wait">{showNumbers && (<motion.div key="numbers-list-animated" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:0.4,ease:"easeInOut"}} className="overflow-hidden"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">{entries.map((num, index)=>(<motion.div key={`${num}-${index}`} initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}} transition={{delay:index*0.025,duration:0.25,ease:"easeOut"}} className="relative bg-gray-800/60 p-3 rounded-lg text-center border border-amber-500/30 hover:border-amber-500/70 shadow-sm hover:shadow-md hover:shadow-amber-500/10 transition-all backdrop-blur-sm group aspect-video flex items-center justify-center"><div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 to-purple-600/5 opacity-0 group-hover:opacity-60 transition-opacity rounded-lg duration-300"/><span className="relative text-lg sm:text-xl md:text-2xl font-bold text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.4)] font-mono tracking-wider select-all">{num}</span></motion.div>))}</div></motion.div>)}</AnimatePresence></div></div></motion.div>);
   };


  // --- JSX Estructura Principal ---
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white overflow-x-hidden font-exo2">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-20">
         {/* Header */}
         <motion.h1 initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 tracking-tight"> <span className="text-gray-400">¡Hola</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400">{userName}</span><span className="text-gray-400">!</span> <span className="text-2xl ml-2" role="img" aria-label="rocket">🚀</span> </motion.h1>
         {/* Error Display */}
         <AnimatePresence>{error && (<motion.div key="error-message-area" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6" role="alert" aria-live="assertive"><div className="bg-red-900/50 border border-red-600/70 text-red-200 px-4 py-3 rounded-lg text-sm sm:text-base shadow-md"><span className="font-semibold mr-2">Error:</span>{error}</div></motion.div>)}</AnimatePresence>
         {/* Payment Confirmation */}
         <AnimatePresence>{paymentConfirmed && (<motion.div key="payment-confirmed-message" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mb-6" role="status"><div className="animate-rotate-border rounded-xl p-0.5" style={{ background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #16a34a 20deg, #86efac 30deg, #16a34a 40deg, transparent 50deg, transparent 360deg)`, animationDuration: '4s', '--border-angle': '0deg' } as React.CSSProperties}><div className="bg-gradient-to-br from-gray-950 to-black p-4 rounded-xl shadow-lg backdrop-blur-sm text-green-300 text-center font-semibold text-sm sm:text-base"><span role="img" aria-label="party popper" className="mr-2">🎉</span> Pago procesado. Tus números se asignarán pronto vía webhook. ¡Refresca en unos segundos!</div></div></motion.div>)}</AnimatePresence>
         {/* Main Content */}
         {renderContent()}
         {/* Buy Extra Button Section */}
         {isSignedIn && (<motion.section initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6,delay:0.3}} className="mt-10 sm:mt-12" aria-labelledby="buy-extra-heading"><div className="animate-rotate-border rounded-xl p-0.5" style={{background:`conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #eab308 20deg, #f59e0b 30deg, #eab308 40deg, transparent 50deg, transparent 360deg)`, animationDuration:'7s', '--border-angle':'0deg'} as React.CSSProperties}><div className="bg-gradient-to-br from-gray-950 via-black to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center"><h3 id="buy-extra-heading" className="text-xl font-semibold text-white mb-2">¿Más Oportunidades?</h3><p className="text-gray-300 mb-5 text-sm sm:text-base">Agrega {EXTRA_NUMBER_COUNT} números extra por ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(EXTRA_NUMBER_PRICE)}.</p><motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={handleBuyExtraNumbers} disabled={!isLoaded||isLoading||!isSignedIn} className={`relative inline-flex items-center justify-center w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group overflow-hidden shadow-md hover:from-amber-600 hover:to-orange-600 hover:shadow-lg hover:shadow-amber-500/20`}> Quiero {EXTRA_NUMBER_COUNT} Números Extra </motion.button></div></div></motion.section>)}
         {/* Other Sections Grid (F1, MMC-GO) */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 mt-10 sm:mt-12">
            <motion.section /* F1 */ aria-labelledby="f1-fantasy-heading"> {/* ... F1 Content ... */} </motion.section>
            <motion.section /* MMC-GO */ aria-labelledby="mmc-go-heading"> {/* ... MMC-GO Content ... */} </motion.section>
         </div>
         {/* Picks Resumen Section */}
         <motion.section /* ... */ className="mt-10 sm:mt-12" aria-labelledby="picks-resumen-heading"><div className="animate-rotate-border rounded-xl p-0.5" /* ... */><div className="bg-gradient-to-br from-gray-950 to-black p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm"><h2 id="picks-resumen-heading" className="text-xl sm:text-2xl font-semibold text-green-400 mb-4 text-center sm:text-left">Resumen Picks F1</h2><PicksResumen /></div></div></motion.section>
         {/* Digital ID Card Section */}
         <motion.section /* ... */ className="mt-10 sm:mt-12 max-w-md mx-auto" aria-labelledby="digital-id-main-heading"><div className="animate-rotate-border rounded-xl p-0.5" /* ... */><div className="bg-gradient-to-br from-gray-950 via-black to-gray-950 p-6 rounded-xl shadow-lg backdrop-blur-sm text-center"><h2 id="digital-id-main-heading" className="text-2xl font-semibold text-amber-300 mb-4">Carnet Digital</h2><div ref={digitalIdRef} /* ... ID Content ... */></div><motion.button /* ... */ onClick={downloadDigitalID} disabled={!isLoaded||isLoading||!user?.id||!isSignedIn} className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 px-6 py-2.5 rounded-full font-semibold text-sm hover:from-yellow-400 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md">Descargar Carnet</motion.button><p className="text-xs text-gray-400 mt-3">Muestra este carnet.</p></div></div></motion.section>
      </main>
    </div>
  );
}

// Remember to copy the actual JSX for F1, MMC-GO sections if truncated above