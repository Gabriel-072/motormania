// ──────────────────────────────────────────────────────────────────────────────
// DASHBOARD PAGE — MotorManía Colombia
// World-class dashboard con picks, resultados y confirmación de pago Bold
// ──────────────────────────────────────────────────────────────────────────────

'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { createAuthClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import { openBoldCheckout } from '@/lib/bold';
import PicksResumen from '@/components/PicksResumen';

export default function Dashboard() {
  const { isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<string[]>([]);
  const [userName, setUserName] = useState('Participante');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // PAYOUTS CONFIG
  const payoutCombos: Record<number, number> = {
    2: 3, 3: 6, 4: 10, 5: 20, 6: 35, 7: 60, 8: 100,
  };

  useEffect(() => {
    if (!isLoaded || !user?.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const jwt = await getToken({ template: 'supabase' });
        if (!jwt) throw new Error('No authentication token available');
        const supabase = createAuthClient(jwt);

        const { data: userData } = await supabase
          .from('clerk_users')
          .select('username, full_name, email')
          .eq('clerk_id', user.id)
          .maybeSingle();

        const displayName = userData?.username || userData?.full_name || user.fullName || 'Participante';
        setUserName(displayName);

        const { data: entriesData } = await supabase
          .from('entries')
          .select('numbers')
          .eq('user_id', user.id)
          .maybeSingle();

        const numbersArray = entriesData?.numbers || [];
        const formattedNumbers = numbersArray.map((num: string) => String(num).padStart(6, '0'));
        setEntries(formattedNumbers);
      } catch (err: any) {
        setError(err.message || 'Error al cargar tus datos. Contacta a soporte@motormaniacolombia.com');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isLoaded, user?.id, getToken]);

  const downloadDigitalID = async () => {
    const element = document.getElementById('digital-id');
    if (!element) return;
    const canvas = await html2canvas(element, { backgroundColor: null });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `MotorMania_DigitalID_${userName}.png`;
    link.click();
  };

  const handleBuyExtraNumbers = async () => {
    if (!user?.id || !user?.primaryEmailAddress) return;

    const orderId = `ORDER-${Date.now()}`;
    const response = await fetch('/api/bold/hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount: 5000, currency: 'COP' }),
    });

    const { hash } = await response.json();

    openBoldCheckout({
      apiKey: process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY!,
      orderId,
      amount: 5000,
      currency: 'COP',
      description: 'Pago por 5 números extra',
      redirectionUrl: 'https://motormaniacolombia.com/dashboard',
      integritySignature: hash,
      customerData: {
        email: user?.primaryEmailAddress?.emailAddress,
        fullName: userName,
      },
    });
  };

  const renderContent = () => {
    if (!isLoaded) return <p className="text-gray-400 text-lg animate-pulse">Verificando tu sesión...</p>;
    if (loading) return (
      <div className="flex items-center justify-center space-x-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-4 border-t-transparent border-cyan-500 rounded-full" />
        <p className="text-cyan-400 text-lg">Cargando tus números...</p>
      </div>
    );
    if (error) return <p className="text-red-400 text-lg bg-red-900/20 p-4 rounded-lg border border-red-500/50">{error}</p>;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
        {entries.map((num: string, index: number) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="relative bg-gray-900/80 p-6 rounded-lg text-center border border-amber-500/40 hover:border-amber-500 shadow-lg hover:shadow-amber-500/20 transition-all backdrop-blur-sm group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
            <span className="relative text-2xl font-bold text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">{num}</span>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 p-8 overflow-hidden">
      <motion.h1 initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 mb-10 tracking-wider">
        ¡Hola {userName}, tus números actuales! 🚀
      </motion.h1>

      {paymentConfirmed && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-green-400/40 bg-green-800/20 text-green-300 shadow-lg">
          🎉 ¡Tu pago fue confirmado! Hemos agregado 5 números adicionales a tu cuenta.
        </div>
      )}

      {renderContent()}

      <PicksResumen />

      {/* Botón Bold */}
      <div className="mt-10 text-center">
        <h3 className="text-lg font-semibold text-white mb-2 font-exo2">¿Quieres más oportunidades?</h3>
        <p className="text-gray-300 mb-4 font-exo2">Agrega 5 números extra por $5.000</p>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleBuyExtraNumbers} className="bg-gradient-to-r from-amber-500 to-cyan-500 text-white px-8 py-3 rounded-full font-semibold font-exo2 hover:from-amber-600 hover:to-cyan-600 transition-all">
          Quiero 5 números extra
        </motion.button>
      </div>

      {/* Sección F1 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-12 bg-gray-900/80 p-6 rounded-xl border border-cyan-500/30 backdrop-blur-sm shadow-[0_0_15px_rgba(34,211,238,0.2)] text-center">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4 font-exo2">¡Acelerá tu pasión con F1 Fantasy!</h2>
        <p className="text-gray-300 mb-6 font-exo2">
          Usa tus números para predecir los podios de F1, compite con otros fanáticos y gana premios exclusivos.
        </p>
        <Link href="/jugar-y-gana">
          <motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-8 py-3 rounded-full font-semibold font-exo2 hover:from-cyan-600 hover:to-purple-600 transition-all">
            Jugar F1 Fantasy Ahora
          </motion.button>
        </Link>
      </motion.div>

      {/* Carnet digital */}
      <motion.div id="digital-id" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.4 }} className="mt-12 max-w-md mx-auto bg-gradient-to-r from-amber-500/20 to-cyan-500/20 p-6 rounded-xl border border-amber-500/30 backdrop-blur-sm shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4 text-center font-exo2">Carnet Digital</h2>
        <p className="text-gray-200 text-center font-exo2">
          ESTE CARNET DIGITAL CERTIFICA QUE <span className="font-bold text-amber-400">{userName}</span> tiene un perfil activo en MotorManía. Su ID único es <span className="font-bold text-cyan-400">{user?.id}</span>.
        </p>
        <p className="text-sm text-gray-400 mt-2 text-center font-exo2">
          Muestra este carnet en negocios participantes para obtener beneficios.
        </p>
        <div className="mt-4 flex justify-center">
          <QRCode value={user?.id || ''} size={100} bgColor="transparent" fgColor="#f5f5f5" />
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={downloadDigitalID} className="mt-4 w-full bg-cyan-500 text-white px-6 py-2 rounded-full font-exo2 hover:bg-cyan-600 transition-all">
          Descargar Carnet
        </motion.button>
      </motion.div>

      {/* Footer */}
      <div className="mt-12 text-gray-400 text-sm space-y-2 opacity-75">
        <p>• Sistema certificado bajo la normativa colombiana</p>
        <p>• Validación automática en tiempo real</p>
        <p>• Soporte 24/7: soporte@motormaniacolombia.com</p>
      </div>
    </div>
  );
}
