'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// Define the Partner type
export type Partner = {
  name: string;
  logo: string;
  discount: string;
};

// Partner-specific border colors and animation properties
const partnerBorderStyles: Record<string, { gradientFrom: string; gradientTo: string; duration: string; direction: string }> = {
  "Automás": { gradientFrom: '#ff6f61', gradientTo: '#ff9f43', duration: '4s', direction: 'normal' },
  "Cupohotel": { gradientFrom: '#1e90ff', gradientTo: '#00b4d8', duration: '5s', direction: 'reverse' },
  "DLX": { gradientFrom: '#ff4d6d', gradientTo: '#ff8fa3', duration: '3.5s', direction: 'normal' },
  "Oilfilters": { gradientFrom: '#2a9d8f', gradientTo: '#48cae4', duration: '6s', direction: 'reverse' },
  "Tellantas": { gradientFrom: '#f4a261', gradientTo: '#e76f51', duration: '4.5s', direction: 'normal' },
  "Petrobras": { gradientFrom: '#1A8C47', gradientTo: '#FFD700', duration: '5s', direction: 'normal' }, // Petrobras green to gold
};

export default function Aliados() {
  const { isSignedIn } = useUser();
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);


  // Sample partner data
  const partners: Partner[] = [
    { name: "Automás", logo: "/logos/automás.png", discount: "10% de descuento en servicios" },
    { name: "Cupohotel", logo: "/logos/cupohotel.png", discount: "Estancias con descuento" },
    { name: "DLX", logo: "/logos/dlx.png", discount: "Ofertas exclusivas en productos" },
    { name: "Oilfilters", logo: "/logos/oilfilters.png", discount: "Descuentos en filtros de aceite" },
    { name: "Tellantas", logo: "/logos/tellantas.png", discount: "Promociones en llantas" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-4xl sm:text-5xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 mb-4"
      >
        Aliados MotorManía
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="text-xl sm:text-2xl text-center text-gray-300 mb-12 max-w-3xl mx-auto"
      >
        Gracias a pertenecer a MotorManía tienes acceso a descuentos exclusivos en nuestra red de aliados
      </motion.p>

 {/* Main Partner Petrobras */}
 <motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.6 }}
  className="mb-12 flex justify-center"
>
  <div className="relative w-full max-w-7xl mx-auto">
    <div className="grid grid-cols-1 md:w-[60%] md:mx-auto">
      <div className="w-full">
        <div
          className="animate-rotate-border rounded-xl p-0.5"
          style={{
            background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1A8C47 20deg, #48cae4 30deg, #1A8C47 40deg, transparent 50deg, transparent 360deg)`,
            animationDuration: '4s'
          }}
        >
          <div className="relative rounded-xl overflow-hidden h-24 md:h-auto bg-gradient-to-br from-gray-800 to-gray-900">
            {/* Desktop Video */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="hidden md:block w-full h-auto object-contain"
            >
              <source src="/logos/petrobras-banner.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            {/* Mobile Video */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="block md:hidden w-full h-full object-cover"
            >
              <source src="/logos/petrobras-banner-mobile.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>
    </div>
  </div>
</motion.div>

      {/* Partner Grid */}
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6"
        >
          {partners.map((partner, index) => {
            const styles = partnerBorderStyles[partner.name] || { gradientFrom: '#ffffff', gradientTo: '#d1d5db', duration: '4s', direction: 'normal' };
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div
                  className="animate-rotate-border rounded-xl p-0.5"
                  style={{
                    background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, ${styles.gradientFrom} 20deg, ${styles.gradientTo} 30deg, ${styles.gradientFrom} 40deg, transparent 50deg, transparent 360deg)`,
                    animationDuration: styles.duration,
                    animationDirection: styles.direction,
                  }}
                >
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-xl border border-amber-500/30 shadow-lg relative z-10 flex flex-col items-center">
                    <Image
                      src={partner.logo}
                      alt={partner.name}
                      width={150}
                      height={150}
                      className="mx-auto mb-4"
                      priority
                    />
                    <button
                    
                    
                      className="bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-4 py-2 rounded-lg font-semibold hover:from-amber-600 hover:to-cyan-600 transition-all duration-300 cursor-pointer"
                    >
                      VER DETALLES
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mt-12 max-w-7xl mx-auto flex flex-col sm:flex-row justify-center gap-6 sm:gap-8"
      >
        <Link href="/aliados" className="bg-gray-900/80 text-white px-6 py-3 rounded-lg font-semibold border border-amber-500/30 hover:border-amber-500/50 transition-all duration-300">
          MENÚ
        </Link>
        <Link href="/aliados/negocios" className="bg-gray-900/80 text-white px-6 py-3 rounded-lg font-semibold border border-amber-500/30 hover:border-amber-500/50 transition-all duration-300">
          NEGOCIOS
        </Link>
        <Link href="/aliados/buscar" className="bg-gray-900/80 text-white px-6 py-3 rounded-lg font-semibold border border-amber-500/30 hover:border-amber-500/50 transition-all duration-300">
          BUSCAR
        </Link>
      </motion.nav>


    </div>
  );
}