// app/page.tsx
'use client';

import Link from 'next/link';
import { useUser, SignedOut } from '@clerk/nextjs';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import Image from 'next/image';
import MovingBar from '@/components/MovingBar';
import { useState, useEffect, useCallback, useRef } from 'react';
import { InfiniteLogoCarousel } from '@/components/InfiniteLogoCarousel';

// Partner logos for each line
const line1Logos = [
  { name: 'Automás', src: '/logos/automás.png' },
  { name: 'Cupohotel', src: '/logos/cupohotel.png' },
  { name: 'DLX', src: '/logos/dlx.png' },
  { name: 'Oilfilters', src: '/logos/oilfilters.png' },
  { name: 'Tellantas', src: '/logos/tellantas.png' },
];

const line2Logos = [
  { name: 'XtremeSecurity', src: '/logos/XtremeSecurity.png' },
  { name: 'GruasVIP', src: '/logos/GruasVIP.png' },
  { name: 'Halifax', src: '/logos/Halifax.png' },
  { name: 'MedalloCustoms', src: '/logos/MedalloCustoms.png' },
  { name: 'Tractomulas', src: '/logos/Tractomulas.png' },
];

const line3Logos = [
  { name: 'Cerolio', src: '/logos/Cerolio.png' },
  { name: 'IndustriasQatar', src: '/logos/IndustriasQatar.png' },
  { name: 'XecuroHelmets', src: '/logos/XecuroHelmets.png' },
  { name: 'AMT', src: '/logos/AMT.png' },
  { name: 'Rent4Racing', src: '/logos/Rent4Racing.png' },
];

// Reviews data with 20 testimonials
const reviews = [
  { name: 'Juan Pérez', rating: 5, comment: 'Qué genial poder ahorrar en la compra de mis llantas, ya hacia falta' },
  { name: 'María Gómez', rating: 4, comment: 'Me encanta ser parte de MotorManía. Es emocionante' },
  { name: 'Carlos Rodríguez', rating: 5, comment: 'El soporte es excelente. Me ayudaron a encontrar el negocio que necesitaba' },
  { name: 'Ana López', rating: 5, comment: 'Increible el juego de fantasia de la F1, solo decirles ufff' },
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
  { name: 'Santiago Gonzales', rating: 4, comment: 'Creo que es la empresa mas genial de Colombia' },
  { name: 'Mateo Silva', rating: 4, comment: 'La comunidad es increíble, siempre hay algo nuevo que descubrir.' },
  { name: 'Gabriela Mendoza', rating: 5, comment: 'MotorManía ha superado todas mis expectativas.' },
];

// Membership packages data
const membershipPackages = [
  {
    name: 'Intro',
    price: '$19.99',
    benefits: [
      '1 entrada acumulable GRATUITA en CADA Sorteo cada mes',
      '40% de acceso a descuentos de Tarifas de Amigos',
      'Descuentos Intro en socios seleccionados',
      '5% DE DESCUENTO en todo el merchandise de MotorManía',
      'Invitaciones a Juegos MotorManía en Colombia',
      'Correos de Promociones Tempranas de MotorManía',
    ],
    color: 'bg-amber-800/50',
    buttonColor: 'bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-600 hover:to-cyan-600',
    isPopular: false,
  },
  {
    name: 'Estándar',
    price: '$49.99',
    benefits: [
      '4 entradas acumulables GRATUITAS en CADA Sorteo cada mes',
      '70% de acceso a descuentos de Tarifas de Amigos',
      'Descuentos Estándar en socios seleccionados',
      '10% DE DESCUENTO en todo el merchandise de MotorManía',
      'Invitaciones VIP a Juegos MotorManía en Colombia',
      'Correos de Promociones Tempranas de MotorManía',
    ],
    color: 'bg-teal-800/50',
    buttonColor: 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600',
    isPopular: true,
  },
  {
    name: 'Premium',
    price: '$99.99',
    benefits: [
      '10 entradas acumulables GRATUITA en CADA Sorteo cada mes',
      'Acceso COMPLETO a descuentos de Tarifas de Amigos',
      'Descuentos Premium en socios seleccionados',
      '20% DE DESCUENTO en todo el merchandise de MotorManía',
      'Invitaciones VIP+ a Eventos MotorManía en Colombia',
      'Correos de Promociones Tempranas de MotorManía',
    ],
    color: 'bg-amber-900/50',
    buttonColor: 'bg-gradient-to-r from-cyan-500 to-cyan-700 hover:from-cyan-600 hover:to-cyan-800',
    isPopular: false,
  },
];

// Entry accumulation data
const entryData = {
  Intro: [1, 2, 3, 4, 5],
  Estándar: [4, 8, 12, 16, 20],
  Premium: [10, 20, 30, 40, 50],
};

const maxEntries = {
  Intro: 5,
  Estándar: 20,
  Premium: 50,
};

export default function Home() {
  const { isSignedIn } = useUser();
  const [selectedTier, setSelectedTier] = useState<'Intro' | 'Estándar' | 'Premium'>('Intro');
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const controls = useAnimation();

  const reviewsPerPage = 3;

  const handleNext = () => {
    setCurrentReviewIndex((prevIndex) =>
      Math.min(prevIndex + reviewsPerPage, reviews.length - reviewsPerPage)
    );
    controls.start({ x: `-${(currentReviewIndex / reviewsPerPage + 1) * 100}%`, transition: { duration: 0.5, ease: 'easeInOut' } });
  };

  const handlePrev = () => {
    setCurrentReviewIndex((prevIndex) => Math.max(prevIndex - reviewsPerPage, 0));
    controls.start({ x: `-${(currentReviewIndex / reviewsPerPage - 1) * 100}%`, transition: { duration: 0.5, ease: 'easeInOut' } });
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diffX = startX.current - currentX;
    if (diffX > 50 && currentReviewIndex < reviews.length - reviewsPerPage) {
      handleNext();
      startX.current = null;
    } else if (diffX < -50 && currentReviewIndex > 0) {
      handlePrev();
      startX.current = null;
    }
  }, [currentReviewIndex]);

  const startX = useRef<number | null>(null);
  const totalPages = Math.ceil(reviews.length / reviewsPerPage);

  return (
    <div className="min-h-screen text-white overflow-hidden">
      <MovingBar />
      <section className="relative pt-12 pb-16 px-4 sm:pt-16 sm:pb-24 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <motion.span
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-amber-400 text-lg sm:text-xl font-exo2 mb-4 block"
          >
            ¡El mejor club de beneficios en el sector automotriz!
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 mb-6 font-exo2 drop-shadow-[0_0_10px_rgba(255,191,0,0.5)]"
          >
            MotorManía Colombia
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg sm:text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl mx-auto"
          >
            Ahorro, velocidad y premios para los apasionados por los carros y las motos en Colombia.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row justify-center gap-6 mt-8"
          >
            <Link
              href="/aliados"
              className="bg-gray-800/50 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-semibold border border-gray-700/50 hover:border-cyan-400 hover:bg-cyan-400/20 hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all duration-300"
            >
              ALIADOS
            </Link>
            <Link
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="relative bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-cyan-600 hover:shadow-[0_0_20px_rgba(34,211,238,0.7)] transition-all duration-300 animate-pulse-glow"
            >
              {isSignedIn ? "VER MIS NÚMEROS" : "UNIRME"}
            </Link>
            <Link
              href={isSignedIn ? "/jugar-y-gana" : "/landing-fantasy"} // Conditional redirect
              className="relative bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-cyan-600 hover:shadow-[0_0_20px_rgba(34,211,238,0.7)] transition-all duration-300 animate-pulse-glow"
            >
              JUEGA Y GANA
            </Link>
          </motion.div>
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/5 w-48 sm:w-72 h-48 sm:h-72 bg-amber-500/10 rounded-full filter blur-2xl sm:blur-3xl animate-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/10 rounded-full filter blur-2xl sm:blur-3xl animate-pulse delay-1000" />
        </div>
      </section>

      {/* Partners Carousel Section (Nuestros Socios) */}
      <section className="relative overflow-hidden py-0 sm:py-16">
        <div className="px-4 sm:px-6 lg:px-8">
          <h2 className="hidden sm:block text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-8 font-exo2">
            Nuestros Socios
          </h2>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900/50 to-gray-950 pointer-events-none"></div>
            <InfiniteLogoCarousel
              topLineLogos={line1Logos}
              middleLineLogos={line2Logos}
              bottomLineLogos={line3Logos}
              speed="normal"
            />
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-12 font-exo2"
          >
            Explora Nuestras Ofertas
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                title: 'Automotriz',
                description: 'Tu tienda única para ofertas exclusivas en talleres, repuestos, accesorios y más.',
                image: '/images/automotriz.png',
              },
              {
                title: 'Servicios y Artículos del Hogar',
                description: 'Descubre servicios y productos para el hogar con descuentos exclusivos.',
                image: '/images/servicios_hogar.png',
              },
              {
                title: 'Merch',
                description: 'Explora nuestra colección oficial de MotorManía Colombia para fanáticos.',
                image: '/images/merch.png',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="p-6 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-amber-500/20 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all duration-300"
              >
                <div className="relative w-full h-48 mb-4 overflow-hidden rounded-lg group">
                  <Image
                    src={item.image}
                    alt={`${item.title} category`}
                    fill
                    className="object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-amber-400 text-xl sm:text-2xl font-bold mb-2 font-exo2">{item.title}</h3>
                <p className="text-gray-300 text-sm sm:text-base">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews Carousel Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 relative">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-12 font-exo2"
        >
          Lo que Dicen Nuestros Miembros
        </motion.h2>
        <div className="relative overflow-hidden">
          <motion.div
            ref={(el) => {
              if (el) el.style.touchAction = 'pan-y';
            }}
            className="w-full"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => (startX.current = null)}
          >
            <motion.div
              animate={controls}
              className="flex"
              style={{ x: 0 }}
            >
              {reviews.slice(currentReviewIndex, currentReviewIndex + reviewsPerPage).map((review, index) => (
                <motion.div
                  key={index}
                  className="flex-shrink-0 w-full sm:w-1/3 px-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <div className="p-6 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-amber-500/20 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all duration-300 relative">
                    <div className="absolute top-4 left-4 text-amber-400 text-4xl opacity-20">
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.003-.002 2.999 1.999c.003-.001.006-.002.009-.004 5.162-1.278 9.973-5.72 9.973-12.601v-7.392h-3.995zm12 0v7.391c0 5.704-3.748 9.571-9 10.609l-.003-.002 3 1.999c.003-.001.006-.002.009-.004 5.168-1.278 9.982-5.72 9.982-12.601v-7.392h-3.988z" />
                      </svg>
                    </div>
                    <div className="relative pt-8">
                      <div className="flex justify-center mb-4">
                        {Array.from({ length: 5 }).map((_, starIndex) => (
                          <svg
                            key={starIndex}
                            className={`w-6 h-6 sm:w-7 sm:h-7 ${starIndex < review.rating ? 'text-amber-400' : 'text-gray-500'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <p className="text-gray-300 text-sm sm:text-base italic mb-4">{review.comment}</p>
                      <h3 className="text-amber-400 text-lg font-semibold font-exo2 text-center">{review.name}</h3>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
          {/* Navigation Arrows */}
          <button
            onClick={handlePrev}
            disabled={currentReviewIndex === 0}
            className="absolute top-1/2 left-2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-amber-500/50 text-white hover:bg-amber-500 transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous review"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            disabled={currentReviewIndex >= reviews.length - reviewsPerPage}
            className="absolute top-1/2 right-2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-amber-500/50 text-white hover:bg-amber-500 transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next review"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {/* Pagination Dots */}
          <div className="flex justify-center mt-6 space-x-3">
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentReviewIndex(index * reviewsPerPage);
                  controls.start({ x: `-${index * 100}%`, transition: { duration: 0.5, ease: 'easeInOut' } });
                }}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  Math.floor(currentReviewIndex / reviewsPerPage) === index
                    ? 'bg-amber-400 scale-125'
                    : 'bg-gray-500 hover:bg-amber-400/50'
                }`}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Membership Packages Section soon */}

      {/* Entries Tracker Component */}
      <section className="py-12 px-2 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-6 font-exo2"
          >
            ¡Entradas que se acumulan!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-gray-400 mb-8 font-exo2"
          >
            Cuanto más tiempo estés con nosotros, más entradas mensuales acumularás
          </motion.p>
          <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-amber-500/20">
            {/* Tier Selection Tabs */}
            <div className="flex justify-center gap-3 sm:gap-4 mb-6 flex-wrap">
              {(['Intro', 'Estándar', 'Premium'] as const).map((tier) => (
                <motion.button
                  key={tier}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedTier(tier)}
                  className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all duration-300 font-exo2 text-xs sm:text-base ${
                    selectedTier === tier
                      ? tier === 'Intro'
                        ? 'bg-gradient-to-r from-amber-600 to-amber-400 text-white shadow-[0_0_10px_rgba(255,191,0,0.7)]'
                        : tier === 'Estándar'
                        ? 'bg-gradient-to-r from-teal-500 to-teal-700 text-white shadow-[0_0_10px_rgba(20,184,166,0.7)]'
                        : 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-[0_0_10px_rgba(34,211,238,0.7)]'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                  }`}
                >
                  {tier}
                </motion.button>
              ))}
            </div>
            {/* Data Rows with Animation on Tier Change */}
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedTier}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {Array.from({ length: 5 }, (_, monthIndex) => {
                  const month = monthIndex + 1;
                  const entries = entryData[selectedTier][monthIndex];
                  const max = maxEntries[selectedTier];
                  const progressPercentage = Math.min((entries / max) * 80, 80);
                  return (
                    <motion.div
                      key={month}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: monthIndex * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-center justify-between flex-row gap-2"
                    >
                      <motion.div
                        className="flex items-center text-gray-300 font-exo2 text-sm sm:text-base"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: monthIndex * 0.1 }}
                      >
                        <svg className="w-5 sm:w-6 h-5 sm:h-6 mr-1 sm:mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Mes {month}
                      </motion.div>
                      <motion.div
                        className="w-2/4 relative"
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ duration: 1, delay: monthIndex * 0.1 }}
                      >
                        <div className="h-6 sm:h-8 rounded-full bg-gray-700/50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 1.2, ease: "easeOut", delay: monthIndex * 0.1 }}
                            className={`h-full rounded-full ${
                              selectedTier === 'Intro'
                                ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                                : selectedTier === 'Estándar'
                                ? 'bg-gradient-to-r from-teal-500 to-teal-700'
                                : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                            }`}
                          ></motion.div>
                        </div>
                      </motion.div>
                      <motion.div
                        className="text-center"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: monthIndex * 0.1 }}
                      >
                        <span className={`inline-block px-3 sm:px-4 py-2 sm:py-3 rounded-full text-white font-exo2 text-sm sm:text-base shadow-[0_0_10px_rgba(255,191,0,0.5)] ${
                          selectedTier === 'Intro'
                            ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                            : selectedTier === 'Estándar'
                            ? 'bg-gradient-to-r from-teal-500 to-teal-700'
                            : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                        }`}>
                          {entries} Entrada{entries > 1 ? 's' : ''}
                        </span>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Sign Up Section */}
      <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 mb-6 font-exo2"
          >
            ¡Regístrate y Gana!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-lg sm:text-xl text-gray-300 mb-8 sm:mb-10 max-w-3xl mx-auto font-exo2"
          >
            Únete ahora y obtén <span className="text-amber-400 font-bold">5 números GRATIS</span> para el sorteo del LEGO F1.
          </motion.p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8 mb-10 sm:mb-12 max-w-4xl mx-auto">
            {[
              { num: 'Gratis', text: 'Participa en sorteos gratis' },
              { num: 'F1', text: 'Vive la emoción de la F1' },
              { num: 'Aliados', text: 'Ahorra gracias al ecosistema de aliados' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="p-4 sm:p-6 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-amber-500/20 hover:border-amber-500/50 hover:shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all duration-300"
              >
                <h3 className="text-amber-400 text-2xl sm:text-3xl font-bold mb-2 font-exo2">{item.num}</h3>
                <p className="text-white text-sm sm:text-base font-exo2">{item.text}</p>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <Link
              href="/sign-up"
              className="relative inline-block bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-8 sm:px-12 py-3 sm:py-4 rounded-full text-lg sm:text-xl font-semibold hover:from-amber-600 hover:to-cyan-600 hover:shadow-[0_0_20px_rgba(34,211,238,0.7)] transition-all duration-300 animate-pulse-glow"
            >
              ¡Quiero Mis Números Gratis!
            </Link>
            <p className="mt-4 sm:mt-6 text-gray-400 text-sm sm:text-base font-exo2">
              Solo necesitas un correo válido. Sin riesgos, sin complicaciones.
            </p>
          </motion.div>
          <SignedOut>
            <motion.div
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 md:hidden"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1 }}
            >
              <Link
                href="/sign-up"
                className="bg-gradient-to-r from-amber-500 to-cyan-500 text-gray-900 px-6 py-2 rounded-full font-semibold hover:from-amber-600 hover:to-cyan-600 shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all duration-300 animate-pulse-glow"
              >
                ¡Únete Ahora!
              </Link>
            </motion.div>
          </SignedOut>
        </div>
      </section>
    </div>
  );
}