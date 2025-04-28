// /Users/imgabrieltoro/Projects/motormania/components/TutorialModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X as LucideX,
  Play,
  Pause,
  FastForward,
  Volume2, // Icono para sonido activo
  VolumeX, // Icono para silencio (mute)
} from 'lucide-react';

interface TutorialModalProps {
  show: boolean;
  onClose: () => void;
}

export default function TutorialModal({ show, onClose }: TutorialModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // --- Estados ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0); // Progreso del video (0-100)
  const [isLoading, setIsLoading] = useState(true); // Estado de carga inicial

  /* ▶️ Efecto principal para manejar apertura/cierre y estado inicial */
  useEffect(() => {
    const videoElement = videoRef.current;
    if (show && videoElement) {
      setIsLoading(true); // Mostrar carga al abrir
      setProgress(0); // Resetear progreso visual
      setIsPlaying(false); // Resetear estado play/pause visual
      setPlaybackRate(1); // Resetear velocidad visual
      videoElement.playbackRate = 1; // Resetear velocidad real
      setIsMuted(videoElement.muted); // Sincronizar estado mute inicial

      // Intenta reproducir (autoplay)
      videoElement.play().catch((e) => {
        console.warn('Autoplay con sonido bloqueado, se requiere interacción:', e);
        setIsPlaying(false); // Asegura estado correcto si autoplay falla
      });

    } else if (!show && videoElement) {
      // Pausa y resetea al cerrar
      videoElement.pause();
      videoElement.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setIsLoading(true); // Resetear estado de carga para la próxima apertura
    }
  }, [show]);

  /* ▶️ Cerrar modal con tecla Escape */
  useEffect(() => {
    if (!show) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  /* ▶️ Sincronizar estado Mute con el video */
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleVolumeChange = () => setIsMuted(videoElement.muted);
    videoElement.addEventListener('volumechange', handleVolumeChange);
    // Sincronización inicial por si acaso
    setIsMuted(videoElement.muted);
    return () => videoElement.removeEventListener('volumechange', handleVolumeChange);
  }, [show]); // Re-evaluar si el modal se muestra/oculta


  // --- Funciones de Control ---

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused || videoRef.current.ended) {
        videoRef.current.play().catch(e => console.warn("Error al reproducir:", e));
      } else {
        videoRef.current.pause();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      // El estado isMuted se actualiza via listener 'volumechange'
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  // --- Clases de Tailwind ---

  const overlayClasses = `
    fixed inset-0 z-[100] flex items-center justify-center
    bg-black/80 backdrop-blur-md p-4
  `;

  const modalPanelClasses = `
    relative w-full max-w-md bg-gradient-to-b from-gray-900 to-[#0a1922]
    border border-amber-500/50 rounded-2xl shadow-xl shadow-black/30
    flex flex-col items-center px-5 pt-8 pb-6 sm:px-6 sm:pt-10 sm:pb-8
  `;

  const closeButtonClasses = `
    absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full text-gray-400
    hover:text-white hover:bg-gray-700/70 focus:outline-none focus:ring-2
    focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-900
    transition-all duration-200 ease-in-out active:scale-90
  `;

  const titleClasses = `
    mb-5 text-center text-xl sm:text-2xl font-bold text-amber-400 tracking-tight
  `;

  const videoContainerClasses = `
    relative w-full max-w-[300px] aspect-[9/16] rounded-lg overflow-hidden
    shadow-lg shadow-black/40 border border-gray-700/50 bg-black group
  `;

  const videoClasses = `
    absolute inset-0 h-full w-full object-cover
  `;

  const descriptionClasses = `
    mt-6 text-center text-sm sm:text-base text-gray-300 leading-relaxed max-w-xs
  `;

  // Clases para Controles Personalizados y Progreso
  const controlsOverlayClasses = `
    absolute inset-x-0 bottom-0 pt-10 /* Espacio arriba para gradiente */
    opacity-30 group-hover:opacity-100 focus-within:opacity-100 /* Visibilidad */
    transition-opacity duration-200 ease-in-out
    bg-gradient-to-t from-black/70 via-black/50 to-transparent /* Gradiente suave */
    pointer-events-none /* Permite click al video debajo, botones habilitan pointer events */
  `;

  const progressBarContainerClasses = `
     absolute bottom-12 left-3 right-3 /* Posición ajustada */
     px-0 /* Sin padding extra aquí */
     opacity-0 group-hover:opacity-100 focus-within:opacity-100 /* Visibilidad */
     transition-opacity duration-200 ease-in-out
     pointer-events-auto /* Permite interaccion si fuera clickeable */
     cursor-pointer /* Opcional: si se hiciera clickeable */
  `;

   const progressBarTrackClasses = `
      h-1.5 bg-white/20 rounded-full w-full
   `;
   const progressBarFillClasses = `
      h-full bg-amber-500 rounded-full
   `;

  const customControlsContainerClasses = `
    flex items-center justify-between gap-2 p-3 pt-1 /* Padding ajustado */
    pointer-events-auto /* Habilita clicks en los controles */
  `;

  const playPauseButtonClasses = `
    p-1.5 rounded-full text-white hover:bg-white/20
    focus:outline-none focus:ring-2 focus:ring-amber-500
    transition-all duration-150 active:scale-95
  `;

  const speedControlClasses = `
    flex items-center gap-1 text-white text-xs font-medium
  `;

  const speedButtonClasses = (rate: number) => `
    px-1.5 py-0.5 rounded
    ${playbackRate === rate ? 'bg-amber-500 text-black font-semibold' : 'bg-white/10 hover:bg-white/30'}
    focus:outline-none focus:ring-1 focus:ring-amber-500
    transition-all duration-150 active:scale-90
  `;

  const loadingSpinnerContainerClasses = `
    absolute inset-0 flex items-center justify-center bg-black/50 z-10
  `;


  return (
    <AnimatePresence>
      {show && (
        <motion.div /* Overlay */
          key="tutorial-overlay" className={overlayClasses}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }} onClick={onClose}
        >
          <motion.div /* Panel */
            key="tutorial-dialog" className={modalPanelClasses}
            initial={{ y: 50, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-labelledby="tutorial-title"
          >
            <button /* Close Button */
              onClick={onClose} aria-label="Cerrar tutorial" className={closeButtonClasses}
            >
              <LucideX size={22} strokeWidth={2.5} />
            </button>

            <motion.h2 /* Title */
              id="tutorial-title" className={titleClasses}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              ¿Cómo se juega MMC GO?
            </motion.h2>

            {/* Video Container */}
            <motion.div
              className={videoContainerClasses}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <video
                ref={videoRef}
                src="/videos/mmcgo-howto.mp4"
                loop playsInline className={videoClasses}
                preload="metadata" poster="/videos/mmcgo-poster.jpg"
                onClick={togglePlayPause} // Click en video alterna play/pause
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)} // Asegura estado correcto al final
                onLoadedMetadata={() => { // Cuando las dimensiones y duración son conocidas
                    setProgress(0);
                    if (videoRef.current) setIsMuted(videoRef.current.muted);
                }}
                onCanPlay={() => setIsLoading(false)} // Ocultar loading cuando está listo
                onWaiting={() => setIsLoading(true)} // Mostrar loading si bufferea
                onError={() => { setIsLoading(false); console.error("Error al cargar el video."); }}
                onTimeUpdate={() => { // Actualizar barra de progreso
                  if (videoRef.current?.duration) {
                    const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
                    setProgress(isNaN(currentProgress) ? 0 : currentProgress);
                  }
                }}
              />

              {/* Indicador de Carga */}
              {isLoading && (
                <div className={loadingSpinnerContainerClasses}>
                  <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}

              {/* Overlay para Controles (Visibilidad y Gradiente) */}
              {!isLoading && (
                  <div className={controlsOverlayClasses}>
                      {/* Barra de Progreso */}
                      <div className={progressBarContainerClasses}>
                          <div className={progressBarTrackClasses}>
                              <div
                                  className={progressBarFillClasses}
                                  style={{ width: `${progress}%` }}
                              ></div>
                          </div>
                      </div>

                      {/* Controles Reales */}
                      <div className={customControlsContainerClasses}>
                          <div className="flex items-center gap-2"> {/* Play/Pause + Mute */}
                              <button onClick={togglePlayPause} aria-label={isPlaying ? 'Pausar' : 'Reproducir'} className={playPauseButtonClasses}>
                                  {isPlaying ? <Pause size={20} strokeWidth={2.5} /> : <Play size={20} strokeWidth={2.5} />}
                              </button>
                              <button onClick={toggleMute} aria-label={isMuted ? 'Quitar silencio' : 'Silenciar'} className={playPauseButtonClasses}>
                                  {isMuted ? <VolumeX size={20} strokeWidth={2.5} /> : <Volume2 size={20} strokeWidth={2.5} />}
                              </button>
                          </div>
                          <div className={speedControlClasses}> {/* Velocidad */}
                              <FastForward size={14} className="mr-1 text-gray-300" />
                              <button onClick={() => changePlaybackRate(0.75)} className={speedButtonClasses(0.75)}>0.75x</button>
                              <button onClick={() => changePlaybackRate(1)} className={speedButtonClasses(1)}>1x</button>
                              <button onClick={() => changePlaybackRate(1.5)} className={speedButtonClasses(1.5)}>1.5x</button>
                              <button onClick={() => changePlaybackRate(2)} className={speedButtonClasses(2)}>2x</button>
                          </div>
                      </div>
                  </div>
              )}
            </motion.div> {/* Fin Video Container */}

            <motion.p /* Description */
              className={descriptionClasses}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.3 }}
            >
              Aprende a hacer picks en &nbsp;MMC&nbsp;GO. ¡Es fácil y divertido!
            </motion.p>

          </motion.div> {/* Fin Panel */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}