// 📁 /app/wallet/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { createAuthClient } from '@/lib/supabase';
import { openBoldCheckout } from '@/lib/bold';
import { toast } from 'sonner'; // <--- AÑADIDO: Importar toast para feedback
import {
  FaCoins, FaGasPump, FaMoneyBillWave, FaCheckCircle, FaClock,
  FaExclamationCircle, FaArrowUp, FaArrowDown, FaSpinner
} from 'react-icons/fa'; // Iconos ya estaban importados, OK
import { RiCopperCoinLine } from 'react-icons/ri'; // Icono ya estaba importado, OK

/* ---------- Types ---------- */
interface WalletRow {
  balance_cop: number;
  // CORREGIDO: Usar los nombres de columna correctos que usa tu código
  mmc_coins: number;  // Asumiendo que este es el nombre correcto en tu DB/estado
  fuel_coins: number; // Asumiendo que este es el nombre correcto en tu DB/estado
  withdrawable_cop: number;
}
type TxType = 'recarga' | 'apuesta' | 'ganancia' | 'reembolso' | 'retiro_pending' | 'retiro';

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  created_at: string;
}

/* ---------- Helpers ---------- */
const fmt = (n: number) => n?.toLocaleString('es-CO') ?? '0';

/* ---------- Lazy Modals ---------- */
// Asumiendo que las rutas son correctas
const DepositModal   = dynamic(() => import('@/components/DepositModal'));
const WithdrawModal  = dynamic(() => import('@/components/WithdrawModal'));

/* ---------- Page ---------- */
export default function WalletPage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const [wallet, setWallet]         = useState<WalletRow | null>(null);
  const [txs, setTxs]               = useState<Transaction[]>([]);
  const [showDeposit,  setDep]      = useState(false);
  const [showWithdraw, setWithd]    = useState(false);
  const [isWalletLoading, setWL]    = useState(true);
  const [isTxLoading, setTL]        = useState(true);
  const [generalError, setErr]      = useState<string | null>(null);

  const uid = user?.id ?? null;

  /* ---------- Realtime sync ---------- */
  useEffect(() => {
    if (!isSignedIn || uid === null) { setWL(false); setTL(false); return; }

    let supabase: ReturnType<typeof createAuthClient>;
    let wCh: any, tCh: any;
    let mounted = true;

    (async () => {
      setWL(true); setTL(true); setErr(null);
      const token = await getToken({ template: 'supabase' });
      supabase = createAuthClient(token ?? null);

      /* initial wallet */
      const { data: w, error: we } = await supabase
        .from('wallet')
        // CORREGIDO: Usar los nombres de columna correctos del tipo WalletRow
        .select('balance_cop, mmc_coins, fuel_coins, withdrawable_cop')
        .eq('user_id', uid)
        .maybeSingle();
      // Manejo de error más robusto
      if (we && mounted) { setErr(`Error cargando billetera: ${we.message}`); console.error("Wallet fetch error:", we); }
      else if (mounted) setWallet(w);

      /* initial tx */
      const { data: t, error: te } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(30);
      // Manejo de error más robusto
      if (te && mounted) { setErr(`Error cargando transacciones: ${te.message}`); console.error("Tx fetch error:", te); }
      else if (mounted) setTxs(t || []);

      // Solo proceder a suscribirse si las cargas iniciales no fallaron gravemente
      if (mounted && !we && !te) {
          /* realtime wallet */
          wCh = supabase.channel(`rt-wallet-${uid}`)
            .on('postgres_changes',
                { event:'*', schema:'public', table:'wallet', filter:`user_id=eq.${uid}` },
                (p) => mounted && setWallet(p.new as WalletRow))
            .subscribe((status, err) => { if(err) console.error(`Subscripción Wallet RT [${uid}] Error:`, err)});

          /* realtime tx */
          tCh = supabase.channel(`rt-tx-${uid}`)
            .on('postgres_changes',
                { event:'INSERT', schema:'public', table:'transactions', filter:`user_id=eq.${uid}` },
                (p) => mounted && setTxs(prev => [p.new as Transaction, ...prev].slice(0,30)))
            .subscribe((status, err) => { if(err) console.error(`Subscripción TX RT [${uid}] Error:`, err)});
      }

      if(mounted){
          setWL(false); setTL(false);
      }
    })();

    return () => { mounted = false; wCh?.unsubscribe(); tCh?.unsubscribe(); };
  }, [isSignedIn, uid, getToken]);

  // --- ELIMINADA FUNCIÓN startDeposit ---

  /* --- NUEVA FUNCIÓN handleActualDeposit --- */
  const handleActualDeposit = async (amount: number) => {
    if (!uid || !user) throw new Error('Usuario no autenticado.');

    const orderId = `MM-WAL-${uid}-${Date.now()}`;

    const res = await fetch('/api/bold/hash', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ orderId, amount, currency: 'COP' }),
    });

    if (!res.ok) {
      // Intenta obtener mensaje de error del JSON, si falla, usa un genérico
      const { message } = await res.json().catch(() => ({ message: 'Error desconocido generando firma.' }));
      throw new Error(message || 'Error al generar firma para Bold.');
    }

    const { hash } = await res.json();

    openBoldCheckout({
      apiKey             : process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
      orderId,
      amount             : String(amount),     // 👈 obligatorio en string
      currency           : 'COP',
      description        : `Recarga de $${fmt(amount)} COP`,
      redirectionUrl     : `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/wallet`,
      integritySignature : hash,
      // customerData debe ser un objeto, no un JSON string (según la definición usual de openBoldCheckout)
      // Si tu implementación específica requiere string, mantenlo como JSON.stringify.
      // De lo contrario, usa un objeto:
      customerData       : {
        email   : user.primaryEmailAddress?.emailAddress ?? '',
        fullName: user.fullName || 'Player',
      },
      // renderMode: 'embedded', // Si usas modo embebido, asegúrate que el contenedor exista

      /* ------- feedback en UI ------- */
      onSuccess: () => {
        toast.success('✅ Recarga recibida, se reflejará en segundos…');
        // El webhook actualizará saldo → RT recibe y refresca UI
        // No cerramos el modal aquí, dejamos que onClose lo haga si es necesario
      },
      onFailed : ({ message }: { message?: string }) => {
        toast.error(`Pago falló: ${message ?? 'Intenta de nuevo.'}`);
      },
      onPending: () => {
         toast.info('Pago pendiente de confirmación.');
         // Usualmente no se cierra el modal aquí
      },
      onClose  : () => setDep(false), // <- Cierra el modal cuando el checkout de Bold se cierra
    });
    // Ya no necesitamos setDep(false) aquí porque onClose del checkout lo maneja
  };

  /* ---------- Withdraw ---------- */
  const MIN_WITHDRAW = 10_000; // Asegúrate que este valor sea consistente

  const submitWithdraw = async (amount: number, method: string, account: string) => {
    try {
        // Añadir validación básica aquí
        if(amount < MIN_WITHDRAW) {
            throw new Error(`El monto mínimo para retirar es $${fmt(MIN_WITHDRAW)}`);
        }
        if((wallet?.withdrawable_cop ?? 0) < amount) {
            throw new Error('Saldo retirable insuficiente.');
        }

        const res = await fetch('/api/withdraw', { // Asumiendo que tienes este endpoint
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${await getToken()}` }, // Añadir Auth si es necesario
          body:JSON.stringify({ amount, method, account })
        });
        if (!res.ok) {
            // Intentar obtener un mensaje de error más específico del backend
            const errorBody = await res.text();
            throw new Error(errorBody || 'Error al procesar la solicitud de retiro.');
        }
        // Éxito
        toast.success('Solicitud de retiro enviada. Se procesará pronto.');
        setWithd(false); // Cerrar modal de retiro
        // El balance se actualizará vía realtime cuando el estado cambie a retiro_pending/retiro
    } catch (error) {
        console.error("Withdrawal error:", error);
        toast.error(error instanceof Error ? error.message : 'Error al solicitar retiro.');
        // No cerramos el modal para que el usuario vea el error y pueda corregir si es necesario
    }
  };

  /* ---------- Tx icon helper ---------- */
  const txStyle = (type: TxType) => {
    // Misma lógica que antes
    switch (type) {
      case 'recarga'        : return { icon:<FaArrowUp/>,       color:'text-green-400' };
      case 'ganancia'       : return { icon:<FaCoins/>,         color:'text-amber-400' };
      case 'reembolso'      : return { icon:<FaCheckCircle/>,   color:'text-cyan-400' };
      case 'retiro_pending' : return { icon:<FaClock/>,         color:'text-yellow-400' };
      case 'retiro'         : return { icon:<FaMoneyBillWave/>, color:'text-red-400' };
      case 'apuesta'        : return { icon:<FaArrowDown/>,     color:'text-red-400' };
      default               : return { icon:<FaExclamationCircle/>, color:'text-gray-400' };
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white pb-24 font-exo2">
      <Header/>

      <main className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Balances */}
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} transition={{duration:.3}}
          className="sticky top-[56px] sm:top-[64px] z-20 flex flex-wrap items-center gap-x-4 gap-y-2 bg-gray-900/90 backdrop-blur border border-gray-700/40 rounded-xl px-3 sm:px-4 py-3 mb-7 shadow-lg">
          {/* Usar los nombres correctos del estado wallet */}
          <Balance label="COP"  value={wallet?.balance_cop ?? 0}  color="text-green-400" prefix="$" isLoading={isWalletLoading}/>
          <Balance label="MMC"  value={wallet?.mmc_coins   ?? 0}  color="text-white"           isLoading={isWalletLoading}/>
          <Balance label="Fuel" value={wallet?.fuel_coins  ?? 0}  color="text-amber-400"       isLoading={isWalletLoading}/>

          <button onClick={()=>setDep(true)}
            className="ml-auto bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-full px-4 py-1.5 text-sm shadow active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-gray-900">
            Recargar
          </button>
        </motion.div>

        {/* Error Global */}
        {generalError && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center shadow-md text-sm">
              <p>Error: {generalError}</p>
           </motion.div>
        )}

        {/* Saldo retirable + botón de retiro */}
        {!isWalletLoading && !generalError && (
          <motion.section initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.1}}
            className="bg-gray-800/70 rounded-xl p-5 mb-6 border border-gray-700/50 shadow">
            <div className="flex justify-between items-center mb-1">
                 <p className="text-sm text-gray-300">Saldo retirable (COP)</p>
                 {/* Opcional: Info tooltip aquí */}
            </div>
            <p className="text-2xl font-bold text-cyan-400">${fmt(wallet?.withdrawable_cop ?? 0)}</p>
            { (wallet?.withdrawable_cop ?? 0) >= MIN_WITHDRAW && (
              <button onClick={()=>setWithd(true)}
                className="mt-3 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-full px-4 py-1.5 text-sm shadow active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-800">
                Solicitar retiro
              </button>
            )}
          </motion.section>
        )}

        {/* Transacciones */}
        <motion.section initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.2}}
          className="bg-gray-800/70 rounded-xl p-5 border border-gray-700/50 shadow min-h-[200px]"> {/* Añadido min-h para evitar salto con loader */}
          <h2 className="text-lg font-bold mb-4">Transacciones recientes</h2>
          {isTxLoading ? (
            <div className="flex justify-center items-center py-10 text-gray-400 space-x-2">
                <FaSpinner className="animate-spin text-xl"/>
                <span>Cargando...</span>
            </div>
          ) : txs.length===0 ? (
            <p className="text-gray-400 text-center py-10">No hay movimientos recientes.</p>
          ) : (
            <ul className="divide-y divide-gray-700/80 -mb-3">
              <AnimatePresence initial={false}>
                {txs.map((t,i)=>{ const {icon,color}=txStyle(t.type); return(
                  <motion.li key={t.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                    exit={{opacity:0,x:-10}} transition={{duration: 0.3, delay:i*0.02}} // Ajustar delay si es necesario
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 text-sm hover:bg-gray-700/30 px-1 -mx-1 rounded transition-colors">
                    <div className="flex items-center gap-3 flex-grow min-w-[180px]">
                      <span className={`text-lg ${color} flex-shrink-0 w-5 text-center`}>{icon}</span> {/* Asegurar ancho icono */}
                      <div className='flex-1'>
                        <p className="text-white font-medium capitalize">{t.description || t.type.replace('_',' ')}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(t.created_at).toLocaleString('es-CO',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit', hour12: true})}
                        </p>
                      </div>
                    </div>
                    {/* Monto */}
                    <span className={`font-semibold whitespace-nowrap ${color}`}>
                        {t.amount>=0?'+':'-'}${fmt(Math.abs(t.amount))}
                        <span className="text-xs font-medium text-gray-400 ml-0.5"> COP</span> {/* Añadir COP para claridad */}
                    </span>
                  </motion.li>
                );})}
              </AnimatePresence>
            </ul>
          )}
        </motion.section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showDeposit  && <DepositModal  onClose={()=>setDep(false)}  onDeposit={handleActualDeposit}/> } {/* <- CORREGIDO: Llama a handleActualDeposit */}
        {showWithdraw && wallet && (
        <WithdrawModal
           max={wallet.withdrawable_cop}
           onClose={() => setWithd(false)}
           onSubmit={submitWithdraw}    // 👈 seguir usando submitWithdraw
        />
      )}
      </AnimatePresence>

      {/* Toast para errores generales (no los de depósito/retiro que se manejan con toast ahora) */}
      {/* Ya no es necesario si se usa toast para errores */}

    </div>
  );
}

/* ---------- Balance pill ---------- */
function Balance({label,value,color,prefix='',isLoading}:{label:string,value:number,color:string,prefix?:string,isLoading?:boolean}) {
  return (
    <div className="text-center flex-1 min-w-[70px]">
      <p className="text-[10px] sm:text-[11px] uppercase text-gray-400 tracking-wider font-medium">{label}</p>
      <div className="h-7 flex justify-center items-center">
        {isLoading
          ? <FaSpinner className="animate-spin text-gray-500 text-base"/>
          : <p className={`text-base sm:text-lg font-bold ${color} truncate leading-tight`}>{prefix}{fmt(value)}</p>}
      </div>
    </div>
  );
}