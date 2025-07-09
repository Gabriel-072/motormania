// /app/fantasy-vip-info/page.tsx - PART 1: IMPORTS, CONFIGURATION & ENHANCED VIDEO PLAYER
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Disclosure } from '@headlessui/react';
import Image from 'next/image';
import { toast } from 'sonner';
import { generateEventId, trackFBEvent } from '@/lib/trackFBEvent';

import {
  PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon,
  ForwardIcon, ChevronUpIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

import { createClient } from '@supabase/supabase-js';
import { openBoldCheckout } from '@/lib/bold';
import MovingBarFantasy from '@/components/MovingBarFantasy';
import LoadingAnimation from '@/components/LoadingAnimation';
import StickyAccessCTA from '@/components/StickyAccessCTA';
import { useVideoAnalytics } from '@/hooks/useVideoAnalytics';

// ============================================================================
// ENHANCED HELPER FUNCTIONS FOR TRACKING
// ============================================================================
const hashUserData = (data: string) => {
  return btoa(data.toLowerCase().trim());
};

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

const getUserData = (user: any) => ({
  em: user?.primaryEmailAddress?.emailAddress ? 
      hashUserData(user.primaryEmailAddress.emailAddress) : undefined,
  ph: user?.phoneNumbers?.[0]?.phoneNumber ? 
      hashUserData(user.phoneNumbers[0].phoneNumber.replace(/\D/g, '')) : undefined,
  fn: user?.firstName ? hashUserData(user.firstName) : undefined,
  ln: user?.lastName ? hashUserData(user.lastName) : undefined,
  client_user_agent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
  fbc: typeof window !== 'undefined' ? getCookie('_fbc') : undefined,
  fbp: typeof window !== 'undefined' ? getCookie('_fbp') : undefined
});

// ============================================================================
// SUPABASE & CONFIGURATION
// ============================================================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================================================
// ENHANCED TEAM COLORS & DRIVER MAPPINGS
// ============================================================================
const teamColors: Record<
  string,
  { gradientFrom: string; gradientTo: string; border: string; accent: string }
> = {
  'Red Bull Racing': {
    gradientFrom: 'from-blue-950',
    gradientTo: 'to-blue-600',
    border: 'border-blue-400/60',
    accent: 'blue-400',
  },
  McLaren: {
    gradientFrom: 'from-orange-800',
    gradientTo: 'to-orange-500',
    border: 'border-orange-400/60',
    accent: 'orange-400',
  },
  Mercedes: {
    gradientFrom: 'from-teal-800',
    gradientTo: 'to-cyan-400',
    border: 'border-cyan-300/60',
    accent: 'cyan-300',
  },
  Ferrari: {
    gradientFrom: 'from-red-900',
    gradientTo: 'to-red-500',
    border: 'border-red-400/60',
    accent: 'red-400',
  },
  'Aston Martin': {
    gradientFrom: 'from-emerald-900',
    gradientTo: 'to-emerald-500',
    border: 'border-emerald-400/60',
    accent: 'emerald-400',
  },
  RB: {
    gradientFrom: 'from-indigo-900',
    gradientTo: 'to-indigo-500',
    border: 'border-indigo-400/60',
    accent: 'indigo-400',
  },
  Alpine: {
    gradientFrom: 'from-blue-900',
    gradientTo: 'to-blue-400',
    border: 'border-blue-300/60',
    accent: 'blue-300',
  },
  Williams: {
    gradientFrom: 'from-blue-800',
    gradientTo: 'to-sky-400',
    border: 'border-sky-300/60',
    accent: 'sky-300',
  },
  Sauber: {
    gradientFrom: 'from-green-900',
    gradientTo: 'to-lime-500',
    border: 'border-lime-400/60',
    accent: 'lime-400',
  },
  'Haas F1 Team': {
    gradientFrom: 'from-gray-800',
    gradientTo: 'to-red-600',
    border: 'border-red-500/60',
    accent: 'red-500',
  },
  Default: {
    gradientFrom: 'from-gray-700',
    gradientTo: 'to-gray-600',
    border: 'border-gray-400/60',
    accent: 'gray-400',
  },
};

const driverToTeam: Record<string, string> = {
  'Max Verstappen': 'Red Bull Racing',
  'Liam Lawson': 'RB',
  'Lando Norris': 'McLaren',
  'Oscar Piastri': 'McLaren',
  'Lewis Hamilton': 'Ferrari',
  'Charles Leclerc': 'Ferrari',
  'George Russell': 'Mercedes',
  'Kimi Antonelli': 'Mercedes',
  'Fernando Alonso': 'Aston Martin',
  'Lance Stroll': 'Aston Martin',
  'Yuki Tsunoda': 'Red Bull Racing',
  'Isack Hadjar': 'RB',
  'Nico Hulkenberg': 'Sauber',
  'Gabriel Bortoleto': 'Sauber',
  'Pierre Gasly': 'Alpine',
  'Franco Colapinto': 'Alpine',
  'Alex Albon': 'Williams',
  'Carlos Sainz': 'Williams',
  'Oliver Bearman': 'Haas F1 Team',
  'Esteban Ocon': 'Haas F1 Team',
};

const getDriverImage = (driver: string) =>
  `/images/pilots/${driver.trim().replace(/\s+/g, '-').toLowerCase()}.png`;

const getTeamCarImage = (team: string) =>
  `/images/cars/${team.trim().replace(/\s+/g, '-').toLowerCase()}.png`;

// ============================================================================
// TYPES
// ============================================================================
interface Plan {
  id: 'race-pass' | 'season-pass';
  nombre: string;
  precio: number;
  precioUSD: number;
  periodo: string;
  beneficios: string[];
  isPopular?: boolean;
}

interface FAQ { 
  q: string; 
  a: string; 
}

type RaceResult = {
  gp_name: string | null;
  gp1: string | null;
  pole1: string | null;
  fastest_lap_driver: string | null;
  fastest_pit_stop_team: string | null;
  first_team_to_pit: string | null;
};

type GpSchedule = { 
  gp_name: string; 
  qualy_time: string; 
  race_time: string 
};

// ============================================================================
// ENHANCED VIDEO PLAYER COMPONENT WITH COMPREHENSIVE TRACKING AND BULLETPROOF UNMUTE CTA
// ============================================================================
function VideoPlayer({ onWatchProgress }: { onWatchProgress?: (percentage: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Enhanced state management
  const [isMounted, setIsMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteCTA, setShowUnmuteCTA] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Enhanced tracking state
  const [videoSessionId] = useState(() => `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [watchStartTime, setWatchStartTime] = useState<number | null>(null);
  const [totalWatchTime, setTotalWatchTime] = useState(0);
  const [engagementEvents, setEngagementEvents] = useState(new Set<string>());
  const [lastProgressUpdate, setLastProgressUpdate] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [pauseCount, setPauseCount] = useState(0);
  const [seekCount, setSeekCount] = useState(0);
  const [muteToggles, setMuteToggles] = useState(0);

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize video with enhanced tracking and volume change handling
  useEffect(() => {
    if (!isMounted) return;
    const v = videoRef.current;
    if (!v) return;

    v.muted = true;
    v.volume = 0.8;

    const handleLoadedMetadata = () => {
      setDuration(v.duration);
      trackFBEvent('VIP_VideoLoad', {
        params: {
          content_type: 'video',
          content_category: 'vsl_video_performance',
          content_name: 'Fantasy VIP VSL Enhanced',
          video_duration: v.duration,
          video_session_id: videoSessionId,
          video_quality: 'auto',
          video_source: 'cdn_bunny',
          page_type: 'vip_landing',
        },
      });
    };

    const handleTimeUpdate = () => {
      setProgress(v.currentTime);
      if (!v.paused && watchStartTime) {
        const now = Date.now();
        const sessionTime = (now - watchStartTime) / 1000;
        setTotalWatchTime((prev) => prev + sessionTime / 10); // Approximate increment
      }
    };

    const handleSeeked = () => {
      setSeekCount((prev) => prev + 1);
      const seekAmount = Math.abs(v.currentTime - lastProgressUpdate);
      if (seekAmount > 5) {
        trackFBEvent('VIP_VideoSeek', {
          params: {
            content_type: 'video',
            content_category: 'vsl_engagement',
            video_session_id: videoSessionId,
            seek_from: lastProgressUpdate,
            seek_to: v.currentTime,
            seek_amount: seekAmount,
            seek_direction: v.currentTime > lastProgressUpdate ? 'forward' : 'backward',
          },
        });
      }
      setLastProgressUpdate(v.currentTime);
    };

    const handleVolumeChange = () => {
      setIsMuted(v.muted);
      if (!v.muted) {
        setShowUnmuteCTA(false); // Hide CTA when unmuted
      }
      setMuteToggles((prev) => prev + 1);
    };

    v.addEventListener('loadedmetadata', handleLoadedMetadata);
    v.addEventListener('timeupdate', handleTimeUpdate);
    v.addEventListener('seeked', handleSeeked);
    v.addEventListener('volumechange', handleVolumeChange);

    return () => {
      v.removeEventListener('loadedmetadata', handleLoadedMetadata);
      v.removeEventListener('timeupdate', handleTimeUpdate);
      v.removeEventListener('seeked', handleSeeked);
      v.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [isMounted, videoSessionId, lastProgressUpdate, watchStartTime]);

  // Enhanced progress tracking with detailed analytics
  useEffect(() => {
    if (!isMounted || !duration) return;
    const v = videoRef.current;
    if (!v || !onWatchProgress) return;

    const currentPercentage = Math.floor((v.currentTime / v.duration) * 100);
    onWatchProgress(currentPercentage);

    const detailedMilestones = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100];

    detailedMilestones.forEach((milestone) => {
      const eventKey = `milestone_${milestone}`;
      if (currentPercentage >= milestone && !engagementEvents.has(eventKey)) {
        setEngagementEvents((prev) => new Set([...prev, eventKey]));

        trackFBEvent('VIP_VideoProgress_Detailed', {
          params: {
            content_type: 'video',
            content_category: 'vsl_detailed_engagement',
            content_name: 'Fantasy VIP VSL Milestone',
            video_session_id: videoSessionId,
            video_percentage: milestone,
            watch_time_seconds: totalWatchTime,
            play_count: playCount,
            pause_count: pauseCount,
            seek_count: seekCount,
            mute_toggles: muteToggles,
            engagement_quality: milestone >= 80 ? 'high' : milestone >= 50 ? 'medium' : 'low',
            user_behavior: {
              replay_likelihood: playCount > 1 ? 'high' : 'low',
              engagement_pattern: pauseCount > 3 ? 'deliberate' : 'passive',
              audio_preference: muteToggles > 0 ? 'audio_enabled' : 'silent_viewer',
            },
          },
        });

        if (milestone === 25) {
          trackFBEvent('VIP_VideoQuarter', {
            params: {
              content_category: 'video_attribution_checkpoint',
              video_session_id: videoSessionId,
              engagement_level: 'qualified_viewer',
              attribution_value: 'medium',
            },
          });
        }

        if (milestone === 75) {
          trackFBEvent('VIP_VideoMostly_Complete', {
            params: {
              content_category: 'video_attribution_checkpoint',
              video_session_id: videoSessionId,
              engagement_level: 'highly_engaged_viewer',
              attribution_value: 'high',
            },
          });
        }
      }
    });
  }, [progress, duration, onWatchProgress, isMounted, totalWatchTime, playCount, pauseCount, seekCount, muteToggles, videoSessionId, engagementEvents]);

  // Sync fullscreen state across browsers
  useEffect(() => {
    if (!isMounted) return;
    const doc: any = document;
    const onFsChange = () => {
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
      const isEntering = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      trackFBEvent('VIP_VideoFullscreen', {
        params: {
          content_type: 'video',
          content_category: 'vsl_interaction',
          video_session_id: videoSessionId,
          action: isEntering ? 'enter_fullscreen' : 'exit_fullscreen',
          video_percentage: Math.floor((progress / duration) * 100),
          engagement_level: 'high_intent',
        },
      });
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [isMounted, videoSessionId, progress, duration]);

  // Enhanced Play / Pause with detailed tracking
  const togglePlay = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play();
      setIsPlaying(true);
      setPlayCount((prev) => prev + 1);
      setWatchStartTime(Date.now());

      if (!hasStarted) {
        setHasStarted(true);
        trackFBEvent('VIP_VideoStart', {
          params: {
            content_type: 'video',
            content_category: 'vsl_engagement',
            content_name: 'Fantasy VIP Video Sales Letter',
            video_session_id: videoSessionId,
            video_duration: duration,
            start_method: 'user_click',
            device_type: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop',
            connection_type: (navigator as any).connection?.effectiveType || 'unknown',
          },
        });
      } else {
        trackFBEvent('VIP_VideoResume', {
          params: {
            content_type: 'video',
            content_category: 'vsl_engagement',
            video_session_id: videoSessionId,
            resume_position: v.currentTime,
            resume_percentage: Math.floor((v.currentTime / duration) * 100),
            total_pauses: pauseCount,
          },
        });
      }

      if (v.muted) setShowUnmuteCTA(true);
    } else {
      v.pause();
      setIsPlaying(false);
      setPauseCount((prev) => prev + 1);
      setWatchStartTime(null);
      trackFBEvent('VIP_VideoPause', {
        params: {
          content_type: 'video',
          content_category: 'vsl_engagement',
          video_session_id: videoSessionId,
          pause_position: v.currentTime,
          pause_percentage: Math.floor((v.currentTime / duration) * 100),
          watch_time_this_session: totalWatchTime,
          pause_reason: 'user_initiated',
        },
      });
    }
  };

  // Enhanced Mute / Unmute with volume enforcement and tracking
  const toggleMute = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    v.muted = !v.muted;
    if (!v.muted) {
      v.volume = 1; // Ensure volume is set when unmuting
    }
    setIsMuted(v.muted);

    trackFBEvent('VIP_VideoAudio', {
      params: {
        content_type: 'video',
        content_category: 'vsl_audio_engagement',
        video_session_id: videoSessionId,
        action: v.muted ? 'muted' : 'unmuted',
        video_percentage: Math.floor((progress / duration) * 100),
        audio_engagement_value: !v.muted ? 'high' : 'low',
        user_intent: !v.muted ? 'engaged_listening' : 'visual_only',
      },
    });
  };

  // Enhanced Fullscreen toggle with vendor fallbacks
  const toggleFullscreen = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const c = containerRef.current;
    const v = videoRef.current;
    const doc: any = document;

    if (!(doc.fullscreenElement || doc.webkitFullscreenElement)) {
      if (c?.requestFullscreen) {
        c.requestFullscreen();
      } else if (c && (c as any).webkitRequestFullscreen) {
        (c as any).webkitRequestFullscreen();
      } else if (v && (v as any).webkitEnterFullscreen) {
        (v as any).webkitEnterFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    }
  };

  // Show enhanced loading state during hydration
  if (!isMounted) {
    return (
      <div className="relative w-full max-w-md aspect-video mx-auto bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl overflow-hidden flex items-center justify-center border border-amber-500/20 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-amber-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-amber-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-amber-400 text-sm font-semibold">Cargando experiencia VIP...</p>
        </div>
      </div>
    );
  }

  const progressPercent = duration ? (progress / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-md aspect-video mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl border border-amber-500/20 group"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        loop
        playsInline
        preload="metadata"
        muted
      >
        <source src="https://fantasy-vip-cdn.b-cdn.net/VSL-Short.mp4" type="video/mp4" />
      </video>

      {/* Enhanced Initial Play CTA */}
      {!hasStarted && (
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40 flex flex-col items-center justify-center text-white">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-full p-6 shadow-2xl mb-4 transform transition-transform group-hover:scale-110">
            <svg className="w-12 h-12 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 text-center">🎯 Descubre el Secreto</h3>
          <p className="text-sm text-gray-300 text-center px-4">Cómo convertir tu conocimiento en resultados</p>
        </div>
      )}

      {/* Enhanced Unmute CTA with z-index and pointer-events */}
      {showUnmuteCTA && (
        <div
          onClick={(e) => {
            toggleMute(e);
            setShowUnmuteCTA(false);
          }}
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/40 flex flex-col items-center justify-center text-white cursor-pointer z-10 pointer-events-auto"
        >
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full p-4 shadow-2xl mb-3 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </div>
          <p className="text-lg font-semibold">🔊 Activar Audio</p>
          <p className="text-xs text-gray-300 mt-1">Para una mejor experiencia</p>
        </div>
      )}

      {/* Enhanced Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Enhanced Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="bg-black/70 backdrop-blur-sm p-3 rounded-full text-white hover:bg-black/90 transition-all duration-200 border border-white/20"
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time Display */}
        <div className="text-white text-xs font-mono bg-black/70 backdrop-blur-sm px-2 py-1 rounded border border-white/20">
          {Math.floor(progress / 60)}:{String(Math.floor(progress % 60)).padStart(2, '0')} /{' '}
          {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
        </div>

        {/* Mute/Volume & Fullscreen */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="bg-black/70 backdrop-blur-sm p-3 rounded-full text-white hover:bg-black/90 transition-all duration-200 border border-white/20"
            aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            className="bg-black/70 backdrop-blur-sm p-3 rounded-full text-white hover:bg-black/90 transition-all duration-200 border border-white/20"
            aria-label={isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN LANDING PAGE COMPONENT - ENHANCED STATE & HOOKS
// ============================================================================
export default function FantasyVipLanding() {
  // ============================================================================
  // HOOKS & REFS - ALL HOOKS MUST BE AT THE TOP
  // ============================================================================
  const clerk = useClerk();
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const pendingPlanRef = useRef<string | null>(null);
  const heroButtonRef = useRef<HTMLButtonElement>(null);

  // ============================================================================
  // HYDRATION SAFETY - FIRST STATE
  // ============================================================================
  const [isMounted, setIsMounted] = useState(false);

  // ============================================================================
  // ENHANCED STATE MANAGEMENT - ALL STATE HOOKS
  // ============================================================================
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  
  // Video & tracking states (simplified - no unlock logic)
  const [watchPercentage, setWatchPercentage] = useState(0);
  const [videoEngagementTracked, setVideoEngagementTracked] = useState(new Set<number>());
  const [planViewsTracked, setPlanViewsTracked] = useState(new Set<string>());
  const { trackVideoProgress, trackVipEvent, sessionId } = useVideoAnalytics();

  // Countdown states
  const [gpSchedule, setGpSchedule] = useState<GpSchedule[]>([]);
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [qualyCountdown, setQualyCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [raceCountdown, setRaceCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showQualy, setShowQualy] = useState(true);

  // ============================================================================
  // HYDRATION EFFECT - FIRST EFFECT
  // ============================================================================
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ============================================================================
  // ENHANCED DATA CONFIGURATION
  // ============================================================================
  const planes: Plan[] = [
    {
      id: 'race-pass',
      nombre: 'Race Pass',
      precio: 20_000,
      precioUSD: 5,
      periodo: 'por carrera',
      beneficios: [
        'Predicciones VIP para 1 GP',
        'Acumula tus primeros puntos',
        'Empieza a competir por el viaje',
        'Acceso a sorteos exclusivos para VIPs',
      ]
    },
    {
      id: 'season-pass',
      nombre: 'Season Pass',
      precio: 80_000,
      precioUSD: 20,
      periodo: 'temporada completa',
      beneficios: [
        'Acceso VIP a todos los 24 GPs de 2025',
        'Ahorra un 40% vs Race Pass',
        'Elegible para viaje F1 2026 ($20,000+ valor)',
        'Participación automática en el sorteo VIP',
        'Acceso a estadísticas y análisis avanzados',
        'Historial completo de rendimiento',
        'Soporte prioritario 24/7'
      ],
      isPopular: true
    }
  ];

  const faqData: FAQ[] = [
    {
      q: '¿Qué incluye exactamente el Race Pass?',
      a: 'El Race Pass te da acceso VIP a nuestras predicciones avanzadas, el ranking exclusivo con premios especiales y estadísticas detalladas para un único Gran Premio de tu elección.'
    },
    {
      q: '¿Puedo cambiar de Race Pass a Season Pass más tarde?',
      a: '¡Claro! Puedes hacer el upgrade en cualquier momento. Pagarás solo la diferencia y todos los puntos que hayas acumulado en tu ranking se mantendrán.'
    },
    {
      q: '¿Qué tan seguro es el proceso de pago?',
      a: 'Utilizamos Bold Checkout, una pasarela de pagos líder que cumple con los más altos estándares de seguridad, incluyendo cifrado TLS 1.2. Tu información de pago nunca toca nuestros servidores.'
    },
    {
      q: '¿Cuál es la política de reembolso?',
      a: 'Ofrecemos una garantía de satisfacción. Tienes 7 días para solicitar un reembolso completo, siempre y cuando no se haya disputado ningún Gran Premio desde el momento de tu compra.'
    }
  ];

  // ============================================================================
  // ENHANCED HELPER FUNCTIONS
  // ============================================================================
  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const formatCountdown = (c: typeof qualyCountdown) => {
    const d = String(Math.max(0, c.days)).padStart(2, '0');
    const h = String(Math.max(0, c.hours)).padStart(2, '0');
    const m = String(Math.max(0, c.minutes)).padStart(2, '0');
    const s = String(Math.max(0, c.seconds)).padStart(2, '0');
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  // ============================================================================
  // ENHANCED TRACKING EFFECTS
  // ============================================================================

  // 1. Enhanced Page Load Tracking
  useEffect(() => {
    if (!isMounted) return;
    
    const pageViewEventId = generateEventId();
    
    trackFBEvent('PageView', {
      params: {
        content_category: 'vip_sales_funnel',
        content_name: 'Fantasy F1 VIP Sales Letter Landing - Enhanced',
        page_type: 'video_sales_letter_optimized',
        funnel_stage: 'awareness',
        content_format: 'vsl_page',
        source: 'organic',
        medium: 'web',
        campaign: 'vip_acquisition_2025_enhanced'
      },
      event_id: pageViewEventId
    });

    if (typeof window !== 'undefined') {
      fetch('/api/fb-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'PageView',
          event_id: pageViewEventId,
          event_source_url: window.location.href,
          user_data: getUserData(user),
          custom_data: {
            content_category: 'vip_sales_funnel',
            page_type: 'video_sales_letter_optimized',
            funnel_stage: 'awareness'
          }
        })
      }).catch(err => console.error('CAPI PageView error:', err));
    }
  }, [isMounted]);

  // 2. Post-Auth Tracking
  useEffect(() => {
    if (!isMounted || !isSignedIn || !user?.id) return;

    if (typeof window !== 'undefined') {
      const pendingPlan = sessionStorage.getItem('pendingVipPlan');
      const pendingEventId = sessionStorage.getItem('pendingVipEventId');

      if (pendingPlan) {
        trackFBEvent('CompleteRegistration', {
          params: {
            content_category: 'vip_user_registration_enhanced',
            content_name: `User Registration Completed for ${pendingPlan} Enhanced`,
            registration_method: 'clerk_oauth',
            registration_source: 'purchase_flow',
            intended_purchase: pendingPlan,
            registration_step: 'completed',
            user_type: 'new_vip_member',
            predicted_ltv: pendingPlan === 'season-pass' ? 300 : 150,
            currency: 'COP'
          },
          email: user.primaryEmailAddress?.emailAddress,
          event_id: `registration_${pendingEventId || generateEventId()}`
        });

        // Clean up
        sessionStorage.removeItem('pendingVipPlan');
        sessionStorage.removeItem('pendingVipEventId');

        // Auto-trigger purchase after small delay
        const timer = setTimeout(() => {
          const button = document.querySelector(`[data-plan-id="${pendingPlan}"]`);
          if (button) {
            (button as HTMLButtonElement).click();
          }
        }, 500);

        return () => clearTimeout(timer);
      }
    }
  }, [isMounted, isSignedIn, user?.id]);

  // ============================================================================
  // ENHANCED HANDLER FUNCTIONS
  // ============================================================================

  // Enhanced Video Engagement Tracking (simplified - no unlock logic)
  const handleWatchProgress = (percentage: number) => {
    if (!isMounted) return;
    
    setWatchPercentage(percentage);

    // Track Analytics (Database)
    trackVideoProgress(percentage, {
      page_type: 'vip_landing_enhanced',
      video_source: 'vsl',
      user_type: isSignedIn ? 'authenticated' : 'anonymous',
      session_id: sessionId,
      timestamp: Date.now()
    });

    // Track Facebook Events (Meta Pixel & CAPI)
    const milestones = [
      { percent: 25, eventName: 'VIP_VideoEngagement_25' },
      { percent: 50, eventName: 'VIP_VideoEngagement_50' },
      { percent: 75, eventName: 'VIP_VideoEngagement_75' },
      { percent: 100, eventName: 'VIP_VideoEngagement_Complete' }
    ];

    const currentMilestone = milestones.find(m =>
      percentage >= m.percent && !videoEngagementTracked.has(m.percent)
    );

    if (currentMilestone) {
      setVideoEngagementTracked(prev => new Set([...prev, currentMilestone.percent]));

      const eventId = generateEventId();
      
      trackFBEvent(currentMilestone.eventName, {
        params: {
          content_type: 'video',
          content_category: 'vsl_engagement_enhanced',
          content_name: 'Fantasy VIP Video Sales Letter Enhanced',
          content_ids: ['vip_vsl_2025_enhanced'],
          video_title: 'Fantasy VIP Access Reveal Enhanced',
          video_length: 300,
          video_percentage: currentMilestone.percent,
          engagement_level: currentMilestone.percent >= 75 ? 'high' : currentMilestone.percent >= 50 ? 'medium' : 'low',
          value: 0,
          currency: 'COP'
        },
        event_id: eventId
      });
    }

    // Lead Qualification at 20%
    if (percentage >= 20 && !videoEngagementTracked.has(20)) {
      setVideoEngagementTracked(prev => new Set([...prev, 20]));

      trackVipEvent('lead_qualification', {
        video_percentage: 20,
        qualification_method: 'video_engagement_threshold',
        lead_quality: 'medium'
      });

      const leadEventId = generateEventId();
      trackFBEvent('Lead', {
        params: {
          content_category: 'qualified_video_lead_enhanced',
          content_name: 'VIP Access Qualified Lead - 20% Video Engagement Enhanced',
          content_type: 'video_qualification',
          lead_type: 'video_qualified',
          qualification_method: 'video_engagement_threshold',
          video_percentage: 20,
          lead_quality: 'medium',
          predicted_ltv: 100,
          currency: 'COP',
          source: 'vsl_engagement'
        },
        event_id: leadEventId
      });
    }
  };

  // Enhanced Plan View Tracking
  const handlePlanView = (planId: string, planPrice: number, planName: string) => {
    if (planViewsTracked.has(planId)) return;
  
    setPlanViewsTracked(prev => new Set([...prev, planId]));
  
    trackVipEvent('plan_view', {
      plan_id: planId,
      plan_name: planName,
      plan_price: planPrice,
      action: 'plan_card_viewed'
    });
  
    const eventId = generateEventId();
    trackFBEvent('VIP_PlanView', {
      params: {
        content_type: 'product',
        content_category: 'vip_membership_plan_enhanced',
        content_name: planName,
        content_ids: [planId],
        value: planPrice / 1000,
        currency: 'COP',
        predicted_ltv: planId === 'season-pass' ? 300 : 150,
        product_type: planId === 'season-pass' ? 'premium_annual' : 'entry_single',
        discount_applied: planId === 'season-pass' ? 'yes' : 'no',
        discount_percentage: planId === 'season-pass' ? 40 : 0
      },
      event_id: eventId
    });
  };

  // Enhanced ROI Section View Tracking
  const handleROIView = () => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('roi_section_viewed')) {
      sessionStorage.setItem('roi_section_viewed', 'true');
      
      trackFBEvent('VIP_ROI_Section_View', {
        params: {
          content_category: 'roi_calculator_enhanced',
          content_name: 'ROI Section Engagement Enhanced',
          engagement_level: 'high_intent',
          section_type: 'value_proposition'
        }
      });
    }
  };

  // Enhanced ACCEDER Button Tracking
  const handleAccederClick = (buttonLocation: string) => {
    const eventId = generateEventId();
    
    trackFBEvent('VIP_AccederButton_Click', {
      params: {
        content_type: 'button',
        content_category: 'cta_interaction_enhanced',
        content_name: 'ACCEDER Button Click Enhanced',
        button_location: buttonLocation,
        button_text: 'ACCEDER',
        destination: 'pricing_section',
        click_intent: 'high_purchase_intent',
        funnel_stage: 'consideration',
        user_action: 'navigate_to_pricing'
      },
      event_id: eventId
    });

    // Scroll to pricing section smoothly
    const planesSection = document.getElementById('planes');
    if (planesSection) {
      planesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Enhanced Sticky Button Tracking
  const handleStickyButtonClick = () => {
    const scrollPosition = window.pageYOffset;
    const eventId = generateEventId();
    
    trackFBEvent('VIP_StickyButton_Click', {
      params: {
        content_type: 'button',
        content_category: 'sticky_cta_enhanced',
        content_name: 'Sticky CTA Button Click Enhanced',
        button_position: 'sticky_bottom',
        button_text: 'ASEGURAR MI LUGAR VIP',
        destination: 'pricing_section',
        scroll_position: scrollPosition,
        engagement_level: 'high_intent',
        user_behavior: 'persistent_interest',
        funnel_stage: 'decision'
      },
      event_id: eventId
    });

    // Navigate to pricing
    handleAccederClick('sticky_button');
  };

  // Enhanced Purchase Function with FIXED InitiateCheckout timing
  const handlePurchase = async (planId: Plan['id']) => {
    console.log('🛒 handlePurchase invocado para:', planId);
    const plan = planes.find(p => p.id === planId);
    if (!plan) return;
  
    // FIRST: Track purchase intent (button click)
    trackVipEvent('checkout_initiated', {
      plan_id: planId,
      plan_name: plan.nombre,
      plan_price: plan.precio,
      action: 'purchase_button_clicked'
    });
  
    // Auth check - REGISTRATION REQUIRED LEAD TRACKING
    if (!isSignedIn || !user) {
      const leadEventId = generateEventId();

      trackFBEvent('Lead', {
        params: {
          content_category: 'purchase_intent_registration_enhanced',
          content_name: `${plan.nombre} Purchase Intent - Registration Required Enhanced`,
          content_type: 'authentication_gate',
          content_ids: [planId],
          value: plan.precio / 1000,
          currency: 'COP',
          lead_type: 'purchase_intent_registration',
          lead_quality: 'high',
          predicted_ltv: planId === 'season-pass' ? 300 : 150,
          conversion_step: 'auth_required',
          barrier_type: 'registration_required'
        },
        event_id: leadEventId
      });

      // Store intent for post-auth tracking
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingVipPlan', planId);
        sessionStorage.setItem('pendingVipEventId', leadEventId);
      }

      clerk.openSignIn({
        redirectUrl: window.location.href,
        afterSignInUrl: window.location.href
      });
      return;
    }

    // Check for pending plan after login
    if (typeof window !== 'undefined') {
      const pendingPlan = sessionStorage.getItem('pendingVipPlan');
      if (pendingPlan && !planId) {
        sessionStorage.removeItem('pendingVipPlan');
        handlePurchase(pendingPlan as Plan['id']);
        return;
      }
    }

    // Verificar apiKey de Bold
    const apiKey = process.env.NEXT_PUBLIC_BOLD_BUTTON_KEY;
    if (!apiKey) {
      toast.error('El sistema de pagos no está disponible temporalmente. Por favor intenta más tarde.');
      return;
    }

    try {
      setProcessingPlan(planId);

      // Crear orden en el backend
      const res = await fetch('/api/vip/register-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.nombre,
          amount: plan.precio,
          fullName: user.fullName,
          email: user.primaryEmailAddress?.emailAddress,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error creando orden');
      }

      const { orderId, amount, redirectionUrl, integritySignature } = await res.json();

      // Configuración para Bold Checkout
      const config = {
        apiKey,
        orderId,
        amount,
        currency: 'COP',
        description: `Acceso VIP · ${plan.nombre}`,
        redirectionUrl,
        integritySignature,
        renderMode: 'embedded',
        containerId: 'bold-embed-vip',
        customerData: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress ?? '',
          fullName: user.fullName ?? '',
        }),
      };

      // CORRECTLY TIMED: InitiateCheckout fires ONLY when payment modal actually opens
      const eventId = generateEventId();
      
      trackFBEvent('InitiateCheckout', {
        params: {
          content_type: 'product',
          content_category: 'vip_membership_enhanced',
          content_name: plan.nombre,
          content_ids: [planId],
          value: plan.precio / 1000,
          currency: 'COP',
          num_items: 1,
          predicted_ltv: planId === 'season-pass' ? 300 : 150,
          checkout_step: 1,
          payment_method_types: ['credit_card', 'debit_card', 'bank_transfer'],
          product_type: planId === 'season-pass' ? 'premium_annual' : 'entry_single',
          discount_applied: planId === 'season-pass' ? 'yes' : 'no',
          discount_percentage: planId === 'season-pass' ? 40 : 0,
          offer_type: 'limited_time_discount',
          funnel_stage: 'checkout_initiation'
        },
        event_id: eventId
      });

      // Send CAPI backup immediately
      if (typeof window !== 'undefined') {
        fetch('/api/fb-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_name: 'InitiateCheckout',
            event_id: eventId,
            event_source_url: window.location.href,
            user_data: getUserData(user),
            custom_data: {
              content_ids: [planId],
              content_category: 'vip_membership_enhanced',
              value: plan.precio / 1000,
              currency: 'COP',
              predicted_ltv: planId === 'season-pass' ? 300 : 150,
              discount_percentage: planId === 'season-pass' ? 40 : 0
            }
          })
        }).catch(err => console.error('CAPI InitiateCheckout error:', err));
      }

      // Track Payment Modal Open
      const paymentEventId = generateEventId();
      trackFBEvent('VIP_PaymentModal_Open', {
        params: {
          content_type: 'product',
          content_category: 'vip_membership_enhanced',
          content_ids: [planId],
          value: plan.precio / 1000,
          currency: 'COP',
          checkout_step: 2,
          modal_type: 'bold_checkout',
          payment_provider: 'bold'
        },
        event_id: paymentEventId
      });

      // Abrir Bold Checkout
      openBoldCheckout({
        ...config,
        onSuccess: async (result: any) => {
          const purchaseEventId = generateEventId();
          trackFBEvent('Purchase', {
            params: {
              content_type: 'product',
              content_category: 'vip_membership_enhanced',
              content_name: plan.nombre,
              content_ids: [planId],
              value: plan.precio / 1000,
              currency: 'COP',
              transaction_id: result?.orderId || orderId,
              num_items: 1,
              order_id: orderId,
              payment_method: 'bold_checkout',
              purchase_type: planId === 'season-pass' ? 'premium_annual' : 'entry_single',
              discount_applied: planId === 'season-pass' ? 'yes' : 'no',
              discount_amount: planId === 'season-pass' ? (plan.precio * 0.4) / 1000 : 0
            },
            event_id: purchaseEventId
          });

          toast.success('✅ Pago exitoso! Redirigiendo...', { duration: 2000 });
          setProcessingPlan(null);
        },
        onFailed: ({ message }: { message?: string }) => {
          toast.error(`Pago rechazado: ${message || 'Por favor intenta con otro método de pago'}`);
          setProcessingPlan(null);
        },
        onPending: () => {
          toast.info('Tu pago está siendo procesado...');
          setProcessingPlan(null);
        },
        onClose: () => {
          if (processingPlan) {
            toast.info('Pago cancelado');
            setProcessingPlan(null);
          }
        },
      });

    } catch (err: any) {
      console.error('Error en handlePurchase:', err);
      toast.error(err.message || 'Error al iniciar el proceso de pago');
      setProcessingPlan(null);
    }
  };

  // ============================================================================
  // ADDITIONAL ENHANCED EFFECTS
  // ============================================================================

  // Scroll depth tracking
  useEffect(() => {
    if (!isMounted) return;
    
    let hasTracked = false;
    
    const handleScroll = () => {
      if (hasTracked) return;
      
      const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      
      if (scrollDepth >= 75) {
        hasTracked = true;
        
        if (typeof window !== 'undefined' && !sessionStorage.getItem('scroll_75_tracked')) {
          sessionStorage.setItem('scroll_75_tracked', 'true');
          
          trackFBEvent('VIP_DeepScroll', {
            params: {
              content_category: 'page_engagement_enhanced',
              content_name: 'Deep Page Scroll Engagement Enhanced',
              content_type: 'page_interaction',
              engagement_type: 'scroll_depth',
              scroll_percentage: scrollDepth,
              engagement_quality: 'high'
            }
          });
        }
      }
    };
  
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMounted]);
  
  // Load GP schedule
  useEffect(() => {
    if (!isMounted) return;
    
    let isCancelled = false;
    
    const loadSchedule = async () => {
      try {
        const { data, error } = await supabase
          .from('gp_schedule')
          .select('gp_name, qualy_time, race_time')
          .order('race_time', { ascending: true });

        if (error) {
          console.error('GP Schedule error:', error);
          return;
        }

        if (!isCancelled && data) {
          setGpSchedule(data as GpSchedule[]);
        }
      } catch (err: any) {
        console.error('GP Schedule fetch error:', err);
      }
    };

    loadSchedule();

    return () => {
      isCancelled = true;
    };
  }, [isMounted]);
  
  // Countdown logic
  useEffect(() => {
    if (!isMounted || gpSchedule.length === 0) return;
  
    const now = Date.now();
    let idx = gpSchedule.findIndex(g => new Date(g.race_time).getTime() > now);
    if (idx === -1) idx = gpSchedule.length - 1;
    
    const selectedGp = gpSchedule[idx];
    
    setCurrentGp(prev => {
      if (prev?.gp_name !== selectedGp?.gp_name) {
        return selectedGp;
      }
      return prev;
    });
  
    if (!selectedGp) return;
  
    let isActive = true;
  
    const tick = () => {
      if (!isActive) return;
      
      const now2 = Date.now();
      const qDiff = new Date(selectedGp.qualy_time).getTime() - now2;
      const rDiff = new Date(selectedGp.race_time).getTime() - now2;
  
      setQualyCountdown({
        days: Math.floor(qDiff / 86400000),
        hours: Math.floor((qDiff % 86400000) / 3600000),
        minutes: Math.floor((qDiff % 3600000) / 60000),
        seconds: Math.floor((qDiff % 60000) / 1000),
      });
      setRaceCountdown({
        days: Math.floor(rDiff / 86400000),
        hours: Math.floor((rDiff % 86400000) / 3600000),
        minutes: Math.floor((rDiff % 3600000) / 60000),
        seconds: Math.floor((rDiff % 60000) / 1000),
      });
    };
  
    tick();
    const countdownInterval = setInterval(tick, 1000);
    const toggleInterval = setInterval(() => {
      if (isActive) {
        setShowQualy(prev => !prev);
      }
    }, 5000);
  
    return () => {
      isActive = false;
      clearInterval(countdownInterval);
      clearInterval(toggleInterval);
    };
  }, [gpSchedule.length, isMounted]);

  // ============================================================================
  // FIXED UI COMPONENTS
  // ============================================================================

  // Fixed ROI Section Component
  const ROISection = () => {
    const [hasViewed, setHasViewed] = useState(false);
    
    const handleView = () => {
      if (!hasViewed) {
        setHasViewed(true);
        handleROIView();
      }
    };
    
    return (
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08),transparent_70%)]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-red-500/5 to-pink-500/5 rounded-full blur-3xl"></div>
        
        <div 
          className="relative max-w-6xl mx-auto" 
          onMouseEnter={handleView}
          onClick={handleView}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-amber-400 via-orange-500 to-red-400 bg-clip-text text-transparent drop-shadow-2xl">
              LAS CUENTAS: ROI DE TU CONOCIMIENTO
            </h2>
            <p className="text-xl text-gray-300 font-medium">
              La mejor inversión que podés hacer con tu conocimiento de F1
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* Investment */}
            <div className="text-center p-8 bg-gradient-to-br from-blue-900/60 via-blue-800/40 to-blue-900/60 rounded-3xl border border-blue-500/30 backdrop-blur-lg shadow-2xl hover:scale-105 transition-all duration-300">
              <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 hover:rotate-12 transition-transform duration-300">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-2xl font-bold text-blue-300 mb-4">Tu Inversión</h3>
              <div className="text-5xl font-black text-white mb-3">$20 USD</div>
              <p className="text-blue-200 font-medium">Temporada completa</p>
            </div>

            {/* Potential Returns */}
            <div className="text-center p-8 bg-gradient-to-br from-green-900/60 via-green-800/40 to-green-900/60 rounded-3xl border border-green-500/30 backdrop-blur-lg shadow-2xl hover:scale-105 transition-all duration-300">
              <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 hover:rotate-12 transition-transform duration-300">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-2xl font-bold text-green-300 mb-4">Retorno Potencial</h3>
              <ul className="space-y-3 text-green-200 font-medium">
                <li><strong className="text-green-300">Viaje F1 2026:</strong> $20,000+</li>
                <li><strong className="text-green-300">ROI:</strong> 40,000%</li>
                <li><strong className="text-green-300">Experiencia:</strong> No tiene precio</li>
              </ul>
            </div>

            {/* Comparison */}
            <div className="text-center p-8 bg-gradient-to-br from-amber-900/60 via-amber-800/40 to-amber-900/60 rounded-3xl border border-amber-500/30 backdrop-blur-lg shadow-2xl hover:scale-105 transition-all duration-300">
              <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 hover:rotate-12 transition-transform duration-300">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold text-amber-300 mb-4">Comparación Real</h3>
              <ul className="space-y-3 text-amber-200 font-medium">
                <li>Boletas 1 GP: $500-2,000</li>
                <li>Viaje F1 completo: $20,000+</li>
                <li className="text-xl font-bold text-amber-300 bg-amber-500/10 py-2 px-4 rounded-xl border border-amber-500/20">Tu Season Pass: $20</li>
              </ul>
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl px-8 py-4 text-green-400 text-xl font-bold backdrop-blur-lg shadow-xl">
              <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
              Es literalmente la mejor inversión que puedes hacer con tu pasión por la F1
            </div>
          </div>
        </div>
      </section>
    );
  };

  // Fixed Decision Framework Section
  const DecisionFrameworkSection = () => (
    <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-black via-neutral-950 to-neutral-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.1),transparent_50%)]"></div>
      
      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-red-400 via-orange-500 to-amber-400 bg-clip-text text-transparent drop-shadow-2xl">
            LLEGÓ EL MOMENTO DE DEJAR DE SER ESPECTADOR
          </h2>
          <p className="text-xl text-gray-300 font-medium">
            Tienes dos opciones frente a vos:
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Option 1 */}
          <div className="p-8 bg-gradient-to-br from-gray-800/60 via-gray-900/40 to-gray-800/60 rounded-3xl border border-gray-500/30 backdrop-blur-lg shadow-2xl">
            <h3 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-3">
              <span className="text-4xl">😴</span>
              OPCIÓN 1: Seguí viendo como siempre lo hiciste
            </h3>
            <ul className="space-y-4 text-gray-300">
              <li className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-xl">✗</span>
                <span className="font-medium">Gritá en el sofá cada domingo</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-xl">✗</span>
                <span className="font-medium">Mirá a otros desperdiciar oportunidades obvias</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-xl">✗</span>
                <span className="font-medium">Mantené tu conocimiento como hobby sin retorno</span>
              </li>
            </ul>
          </div>

          {/* Option 2 */}
          <div className="p-8 bg-gradient-to-br from-amber-900/60 via-orange-800/40 to-amber-900/60 rounded-3xl border border-amber-500/50 backdrop-blur-lg shadow-2xl relative overflow-hidden hover:scale-105 transition-all duration-300">
            <div className="absolute -top-4 -right-4 bg-gradient-to-r from-green-500 to-green-400 text-black text-sm font-bold px-4 py-2 rounded-full shadow-xl transform rotate-12 z-10">
              RECOMENDADO ⭐
            </div>
            
            <h3 className="text-2xl font-bold text-amber-300 mb-6 flex items-center gap-3">
              <span className="text-4xl">🏆</span>
              OPCIÓN 2: Convertí tu experiencia en ventaja competitiva
            </h3>
            <ul className="space-y-4 text-amber-100">
              <li className="flex items-start gap-4">
                <span className="text-green-400 mt-1 text-xl">✓</span>
                <span className="font-medium">Demostrá que sabés más que la mayoría</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-green-400 mt-1 text-xl">✓</span>
                <span className="font-medium">Sé recompensado por tu conocimiento real</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-green-400 mt-1 text-xl">✓</span>
                <span className="font-medium">Tené la oportunidad de estar en las tribunas en 2026</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );

// Fixed Why 2025 Section - NO MOTION COMPONENTS
const Why2025Section = () => (
  <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.1),transparent_60%)]"></div>
    
    <div className="max-w-5xl mx-auto relative">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-red-400 via-orange-500 to-amber-400 bg-clip-text text-transparent drop-shadow-2xl">
          POR QUÉ 2025 ES EL AÑO DEFINITIVO PARA ENTRAR
        </h2>
        <p className="text-xl text-gray-300 font-medium">
          Nunca vas a tener una oportunidad como esta
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Transition Season */}
        <div className="p-8 bg-gradient-to-br from-blue-900/60 via-blue-800/40 to-blue-900/60 rounded-3xl border border-blue-500/30 backdrop-blur-lg shadow-2xl group hover:scale-105 transition-all duration-300">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
              <span className="text-3xl">🔄</span>
            </div>
            <h3 className="text-2xl font-bold text-blue-300">TEMPORADA DE TRANSICIÓN</h3>
          </div>
          <ul className="space-y-3 text-blue-200 font-medium">
            <li>• Cambios reglamentarios en 2026</li>
            <li>• Última oportunidad con el reglamento actual</li>
            <li>• Tus años de conocimiento nunca fueron tan valiosos</li>
          </ul>
        </div>

        {/* Mature Platform */}
        <div className="p-8 bg-gradient-to-br from-green-900/60 via-green-800/40 to-green-900/60 rounded-3xl border border-green-500/30 backdrop-blur-lg shadow-2xl group hover:scale-105 transition-all duration-300">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
              <span className="text-3xl">🛠️</span>
            </div>
            <h3 className="text-2xl font-bold text-green-300">PLATAFORMA MADURA</h3>
          </div>
          <ul className="space-y-3 text-green-200 font-medium">
            <li>• Sistema probado y comprobado</li>
            <li>• Algoritmos refinados</li>
            <li>• Comunidad establecida de expertos</li>
          </ul>
        </div>

        {/* Manageable Competition */}
        <div className="p-8 bg-gradient-to-br from-amber-900/60 via-amber-800/40 to-amber-900/60 rounded-3xl border border-amber-500/30 backdrop-blur-lg shadow-2xl group hover:scale-105 transition-all duration-300">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
              <span className="text-3xl">🎯</span>
            </div>
            <h3 className="text-2xl font-bold text-amber-300">COMPETENCIA MANEJABLE</h3>
          </div>
          <ul className="space-y-3 text-amber-200 font-medium">
            <li>• Solo 2,847 miembros VIP activos</li>
            <li>• Menos del 0,001% de los aficionados globales</li>
            <li>• Tus posibilidades nunca fueron mejores</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
);

// Fixed Member Success Stories Section - NO MOTION COMPONENTS
const MemberSuccessSection = () => (
  <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-black via-neutral-950 to-neutral-900 relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.1),transparent_50%)]"></div>
    
    <div className="max-w-5xl mx-auto relative">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-amber-400 via-orange-500 to-red-400 bg-clip-text text-transparent drop-shadow-2xl">
          MIRÁ QUIÉN YA ESTÁ CONVIRTIENDO CONOCIMIENTO EN RESULTADOS
        </h2>
        <p className="text-xl text-gray-300 font-medium">
          <strong className="text-amber-400">+2,847 miembros VIP activos</strong> ya descubrieron cómo transformar su conocimiento en resultados
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-10 mb-16">
        {/* Current Leaderboard */}
        <div className="p-8 bg-gradient-to-br from-amber-900/60 via-amber-800/40 to-amber-900/60 rounded-3xl border border-amber-500/30 backdrop-blur-lg shadow-2xl">
          <h3 className="text-2xl font-bold text-amber-300 mb-8 text-center flex items-center justify-center gap-3">
            <span className="text-3xl">🏆</span>
            Tabla de Posiciones Actual
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500/20 to-yellow-400/20 rounded-2xl border border-yellow-400/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full flex items-center justify-center text-black font-black text-lg shadow-lg">1</div>
                <span className="text-white font-bold text-lg">Zaira Ramirez</span>
              </div>
              <span className="text-amber-300 font-black text-lg">114 puntos</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-500/20 to-gray-400/20 rounded-2xl border border-gray-400/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-gray-500 to-gray-400 rounded-full flex items-center justify-center text-black font-black text-lg shadow-lg">2</div>
                <span className="text-white font-bold text-lg">Cs Villamizar</span>
              </div>
              <span className="text-gray-300 font-black text-lg">110 puntos</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/20 to-orange-400/20 rounded-2xl border border-orange-400/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-400 rounded-full flex items-center justify-center text-black font-black text-lg shadow-lg">3</div>
                <span className="text-white font-bold text-lg">Adelaida Benito</span>
              </div>
              <span className="text-orange-300 font-black text-lg">91 puntos</span>
            </div>
          </div>
        </div>

{/* Top Earners */}
<div className="p-8 bg-gradient-to-br from-green-900/60 via-green-800/40 to-green-900/60 rounded-3xl border border-green-500/30 backdrop-blur-lg shadow-2xl">
          <h3 className="text-2xl font-bold text-green-300 mb-8 text-center flex items-center justify-center gap-3">
            <span className="text-3xl">💰</span>
            Destructores 2025
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500/20 to-green-400/20 rounded-2xl border border-green-400/30">
              <span className="text-white font-bold text-lg">Yuki Tsunoda</span>
              <span className="text-green-300 font-black text-lg">$2,050,000</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500/15 to-green-400/15 rounded-2xl border border-green-400/20">
              <span className="text-white font-bold text-lg">Jack Doohan</span>
              <span className="text-green-300 font-black text-lg">$1,514,000</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500/10 to-green-400/10 rounded-2xl border border-green-400/15">
              <span className="text-white font-bold text-lg">Lando Norris</span>
              <span className="text-green-300 font-black text-lg">$1,240,000</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-2xl px-8 py-4 text-blue-400 text-xl font-bold backdrop-blur-lg shadow-xl">
          <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
          No es suerte. Es pura habilidad.
        </div>
      </div>
    </div>
  </section>
);

// ============================================================================
  // EARLY RETURN CHECK - MOVED TO END AFTER ALL HOOKS
  // ============================================================================
  
  // Show enhanced loading state during hydration
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-black to-neutral-950 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.1),transparent_70%)]"></div>
        <div className="relative flex flex-col items-center gap-8">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-amber-500 border-r-orange-500 rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-transparent border-t-orange-500 border-r-red-500 rounded-full animate-spin animation-delay-150"></div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-2">
              Preparando Experiencia VIP
            </h2>
            <p className="text-gray-400 text-sm">Cargando el futuro de tu conocimiento en F1...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ENHANCED MAIN RENDER
  // ============================================================================
  return (
    <>
      {/* Bold Checkout Container */}
      {processingPlan && (
        <div
          id="bold-embed-vip"
          data-bold-embed
          className="fixed inset-0 z-[100] pointer-events-none"
        >
          <style>{`
            #bold-embed-vip > * {
              pointer-events: auto !important;
            }
          `}</style>
        </div>
      )}
  
      <MovingBarFantasy />
  
      {/* Enhanced Urgency Banner */}
      {(
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="fixed top-8 left-0 w-full z-[55] bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white text-center py-3 px-4 overflow-hidden shadow-2xl backdrop-blur-lg"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-orange-400/20"></div>
          <div className="relative z-10 flex items-center justify-center gap-3 text-sm font-black">
            <span className="animate-pulse">⚡</span>
            <span>OFERTA LIMITADA: 40% DE DESCUENTO EN TU PASE VIP</span>
            <span className="animate-pulse">⚡</span>
          </div>
        </motion.div>
      )}
  
      {/* Enhanced Background */}
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-black to-neutral-950 text-gray-200 font-sans relative overflow-hidden">
        {/* Enhanced Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem]
                       bg-[radial-gradient(circle_at_center,_rgba(251,146,60,0.12),transparent_40%)]
                       animate-[spin_20s_linear_infinite]"
          />
          <div
            className="absolute bottom-[-30%] right-[-20%] w-[60rem] h-[60rem]
                       bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.12),transparent_45%)]
                       animate-[spin_25s_linear_infinite_reverse]"
          />
          <div
            className="absolute top-1/2 left-1/2 w-[40rem] h-[40rem] transform -translate-x-1/2 -translate-y-1/2
                       bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),transparent_60%)]
                       animate-pulse"
          />
        </div>
  
        <main className="relative z-10">
          {/* CORRECTED HERO SECTION - Classic Single Column Layout */}
          <section className="relative py-8 sm:py-12 lg:py-16 px-4 sm:px-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-transparent to-orange-900/10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,107,0.15),transparent_50%)]" />
  
            <div className="relative max-w-4xl mx-auto text-center">
              {/* Social Proof Badge */}
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/40 rounded-2xl px-6 py-3 text-green-300 text-sm font-bold shadow-2xl backdrop-blur-lg mb-8">
                <div className="relative w-3 h-3">
                  <span className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
                  <span className="relative block w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                </div>
                La comunidad de apasionados por la F1 más grande!
              </div>
  
              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-6">
                <span className="block text-red-400 text-xl sm:text-2xl lg:text-3xl font-bold mb-3 drop-shadow-lg">
                  ¿Ya te diste cuenta que sabés más de F1 que el 90% de las personas...
                </span>
                <span className="block text-white text-2xl sm:text-3xl lg:text-4xl font-black mb-3 drop-shadow-lg">
                  pero nunca has sido recompensado por eso?
                </span>
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 drop-shadow-lg text-3xl sm:text-4xl lg:text-5xl">
                  Esto se acaba HOY.
                </span>
              </h1>

              {/* Subheadline */}
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold leading-snug text-white/90 mb-8 max-w-4xl mx-auto">
                Mientras otros "gritan" y sufren en el sofá, descubre en el video cómo fans comunes están convirtiendo su conocimiento en{' '}
                <span className="text-amber-400 font-bold">viajes VIP a la F1</span> y{' '}
                <span className="text-green-400 font-bold">premios en efectivo</span>.
              </h2>

              {/* Video */}
              <div className="w-full max-w-lg mx-auto mb-8">
                <VideoPlayer onWatchProgress={handleWatchProgress} />
              </div>

              {/* Enhanced ACCEDER Button - Add this here */}
              <div className="mb-8">
                <button
                  ref={heroButtonRef}
                  onClick={() => handleAccederClick('hero_section')}
                  className="inline-flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black rounded-2xl text-xl shadow-2xl transition-all transform hover:scale-105 active:scale-95"
                  data-track="acceder-button"
                  data-location="hero"
                >
                  ACTIVAR DRS
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* Pain Point Bullets */}
              <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-500/40 rounded-2xl p-6 text-left backdrop-blur-lg shadow-2xl mb-8 max-w-3xl mx-auto">
                <h3 className="text-red-400 font-bold mb-4 text-xl text-center">
                  Mientras otros "gritan" y sufren en el sofá, vos:
                </h3>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start gap-3">
                    <span className="text-amber-400 mt-1 text-lg">✓</span>
                    <span className="font-medium">Predecís exactamente cuándo un piloto va a hacer pit stop</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-amber-400 mt-1 text-lg">✓</span>
                    <span className="font-medium">Sabés qué estrategia de llantas va a funcionar en cada circuito</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-amber-400 mt-1 text-lg">✓</span>
                    <span className="font-medium">Identificás cuáles pilotos rinden mejor bajo presión</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-amber-400 mt-1 text-lg">✓</span>
                    <span className="font-medium">Entendés cómo el clima y el setup afectan el rendimiento</span>
                  </li>
                </ul>
                <p className="text-red-300 font-bold mt-4 text-lg text-center">
                  ¿Pero dónde está tu recompensa por toda esa experiencia?
                </p>
              </div>

              {/* Countdown - Only show if unlocked */}
              {currentGp && (
                <div className="w-full max-w-sm mx-auto rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl shadow-2xl px-6 py-4 flex flex-col gap-2">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-sm font-bold tracking-wide text-gray-200 truncate">
                      {currentGp.gp_name}
                    </span>
                  </div>

                  <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300 inline-block min-w-[120px] text-center">
                      {showQualy ? 'Clasificación en' : 'Carrera en'}
                    </span>

                    <div className="flex items-center gap-1 font-mono text-white">
                      {[
                        { v: (showQualy ? qualyCountdown : raceCountdown).days, l: 'd' },
                        { v: (showQualy ? qualyCountdown : raceCountdown).hours, l: 'h' },
                        { v: (showQualy ? qualyCountdown : raceCountdown).minutes, l: 'm' },
                        { v: (showQualy ? qualyCountdown : raceCountdown).seconds, l: 's' },
                      ].map((t, i) => (
                        <React.Fragment key={t.l}>
                          <span className="tabular-nums text-lg font-black">
                            {String(t.v).padStart(2, '0')}
                            <span className="text-xs ml-1 text-gray-400">{t.l}</span>
                          </span>
                          {i < 3 && <span className="text-lg text-gray-500">:</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
  
          {/* REST OF CONTENT - Only show if video has been watched */}
          {(
            <div>
              {/* Enhanced Sections */}
              <ROISection />

              {/* NEW: Random Winner Section */}
              <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 via-purple-950/20 to-black relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(147,51,234,0.15),transparent_60%)]"></div>
                <div className="absolute top-0 left-1/3 w-96 h-96 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
                
                <div className="max-w-5xl mx-auto relative">
                  <div className="text-center mb-16">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-purple-400 via-pink-500 to-red-400 bg-clip-text text-transparent drop-shadow-2xl">
                      ¿NO SOS EL MEJOR? NO IMPORTA
                    </h2>
                    <p className="text-xl text-gray-300 font-medium mb-4">
                      Tenés la misma oportunidad que cualquiera de ganar
                    </p>
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/40 rounded-2xl px-6 py-3 text-purple-300 text-lg font-bold backdrop-blur-lg shadow-xl">
                      <span className="text-2xl">🎲</span>
                      <span>1 ganador ALEATORIO entre TODOS los miembros VIP</span>
                    </div>
                  </div>

                  {/* Winner Distribution */}
                  <div className="grid md:grid-cols-3 gap-6 mb-16">
                    {/* Top 2 Winners */}
                    <div className="md:col-span-2 p-8 bg-gradient-to-br from-amber-900/40 to-yellow-900/40 rounded-3xl border border-amber-500/30 backdrop-blur-lg shadow-2xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-xl">
                          <span className="text-3xl">🏆</span>
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-amber-300">Top 2 del Ranking</h3>
                          <p className="text-amber-200 font-medium">Los mejores prediciendo van directo</p>
                        </div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                        <p className="text-amber-200 font-bold text-center">
                          💪 Para los expertos que dominan las predicciones
                        </p>
                      </div>
                    </div>

                    {/* Random Winner */}
                    <div className="p-8 bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-3xl border border-purple-500/30 backdrop-blur-lg shadow-2xl relative overflow-hidden">
                      <div className="absolute -top-3 -right-3 bg-gradient-to-r from-green-500 to-emerald-400 text-black text-sm font-black px-3 py-1.5 rounded-full shadow-xl transform rotate-12">
                        TU OPORTUNIDAD
                      </div>
                      
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
                          <span className="text-3xl">🎲</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-purple-300">Ganador Aleatorio</h3>
                          <p className="text-purple-200 font-medium text-sm">Cualquier miembro VIP</p>
                        </div>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <p className="text-purple-200 font-bold text-center text-sm">
                          🍀 Solo tenés que ser miembro VIP
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Your Odds */}
                  <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/40 rounded-3xl p-8 backdrop-blur-lg shadow-2xl mb-12">
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-green-300 mb-4 flex items-center justify-center gap-3">
                        <span className="text-3xl">📊</span>
                        TUS PROBABILIDADES ACTUALES
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-4xl font-black text-white mb-2">1 en 2,847</div>
                          <p className="text-green-200 font-semibold">Probabilidad actual</p>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-4xl font-black text-green-400 mb-2">0.035%</div>
                          <p className="text-green-200 font-semibold">Chance matemática</p>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-4xl font-black text-amber-400 mb-2">$20,000+</div>
                          <p className="text-green-200 font-semibold">Valor del premio</p>
                        </div>
                      </div>

                      <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                        <p className="text-green-300 font-bold text-lg">
                          ⚠️ <strong>Cada nuevo miembro VIP reduce tus probabilidades</strong>
                        </p>
                        <p className="text-green-200 text-sm mt-2">
                          Entrá ahora mientras las probabilidades están a tu favor
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Comparison with other competitions */}
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="p-6 bg-gradient-to-br from-red-900/30 to-red-800/30 border border-red-500/30 rounded-2xl backdrop-blur-lg">
                      <h4 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                        <span>❌</span>
                        Otras competencias
                      </h4>
                      <ul className="space-y-2 text-red-200 text-sm">
                        <li>• Lotería nacional: 1 en 14,000,000</li>
                        <li>• Baloto: 1 en 15,401,568</li>
                        <li>• Concursos de TV: 1 en 500,000+</li>
                        <li>• Sorteos de marcas: 1 en 100,000+</li>
                      </ul>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-green-900/30 to-emerald-800/30 border border-green-500/30 rounded-2xl backdrop-blur-lg">
                      <h4 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                        <span>✅</span>
                        Fantasy VIP
                      </h4>
                      <ul className="space-y-2 text-green-200 text-sm">
                        <li>• Solo 1 en 2,847 (y bajando)</li>
                        <li>• Premio garantizado: $20,000+ USD</li>
                        <li>• Basado en tu conocimiento, no suerte</li>
                        <li>• Comunidad exclusiva de expertos</li>
                      </ul>
                    </div>
                  </div>

                  {/* Call to Action */}
                  <div className="text-center mt-12">
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl px-8 py-4 text-purple-300 text-xl font-bold backdrop-blur-lg shadow-xl">
                      <div className="w-4 h-4 bg-purple-400 rounded-full animate-pulse"></div>
                      Mientras menos miembros VIP, mejores son tus probabilidades
                    </div>
                  </div>
                </div>
              </section>

              <DecisionFrameworkSection />
              <Why2025Section />
              <MemberSuccessSection />
              {/* PredictionsTeaser */}
              <PredictionsTeaser />

              {/* CORRECTED PRICING PLANS - No problematic animations */}
              <section id="planes" className="py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.1),transparent_70%)]"></div>
                
                <div className="max-w-6xl mx-auto relative">
                  <div className="text-center mb-16">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-6">
                      DOS FORMAS DE COMENZAR TU TRAVESÍA
                    </h2>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto font-medium">
                      <strong className="text-white">Oferta por Tiempo Limitado:</strong> Aprovechá el descuento y asegurá tu lugar.
                    </p>
                  </div>
  
                  {/* Trust Indicators */}
                  <div className="text-center mb-12">
                    <div className="flex items-center justify-center gap-6 mb-6">
                      <div className="flex items-center gap-2">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className="w-6 h-6 text-yellow-400 fill-current drop-shadow-lg" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        ))}
                      </div>
                      <span className="text-gray-400 font-semibold">4.9/5 (2,847 usuarios)</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-gray-500 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">🔒</span>
                        <span>Pago seguro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400">💳</span>
                        <span>Garantía de devolución</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">⚡</span>
                        <span>Acceso inmediato</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400">🕐</span>
                        <span>Soporte 24/7</span>
                      </div>
                    </div>
                  </div>
  
                  {/* Corrected Pricing Cards - No motion animations */}
                  <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {planes.map((plan, i) => (
                      <div
                        key={plan.id}
                        ref={(el) => {
                          if (el) {
                            const observer = new IntersectionObserver(
                              ([entry]) => {
                                if (entry.isIntersecting) {
                                  handlePlanView(plan.id, plan.precio, plan.nombre);
                                }
                              },
                              { threshold: 0.5 }
                            );
                            observer.observe(el);
                            return () => observer.disconnect();
                          }
                        }}
                        className={`relative p-8 rounded-3xl ring-1 bg-gradient-to-br backdrop-blur-xl transition-all duration-500 hover:ring-white/30 hover:scale-[1.02] group ${
                          plan.isPopular
                            ? 'from-amber-900/40 to-orange-900/40 border-2 border-amber-500/60 ring-2 ring-amber-500/40 shadow-2xl shadow-amber-500/20'
                            : 'from-neutral-900/60 to-neutral-800/60 border border-neutral-700/60 shadow-xl'
                        }`}
                        onMouseEnter={() => {
                            trackFBEvent('VIP_PlanHover', {
                              params: {
                                content_type: 'product',
                                content_ids: [plan.id],
                                content_name: plan.nombre,
                                value: plan.precio / 1000,
                                currency: 'COP',
                                action: 'plan_hover'
                              }
                            });
                        }}
                      >
                        {plan.isPopular && (
                          <>
                            <div className="absolute top-0 right-6 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-sm font-black rounded-full uppercase tracking-wide shadow-2xl">
                              PARA VERDADEROS CONOCEDORES
                            </div>
                            <div className="absolute top-0 left-6 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white text-sm font-black rounded-full uppercase tracking-wide shadow-2xl">
                              AHORRA 40%
                            </div>
                          </>
                        )}
  
                        <div className="flex flex-col h-full">
                          <div className="flex items-center gap-4 mb-6">
                            {plan.id === 'race-pass' ? (
                              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                                <span className="text-3xl">🏁</span>
                              </div>
                            ) : (
                              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl">
                                <span className="text-3xl">👑</span>
                              </div>
                            )}
                            <h3 className="text-2xl sm:text-3xl font-black text-white">{plan.nombre}</h3>
                          </div>

                          <div className="my-6">
                            <div className="flex items-baseline gap-3 mb-3">
                              <span className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
                                ${plan.precioUSD} USD
                              </span>
                              {plan.isPopular && (
                                <span className="text-xl text-gray-500 line-through">
                                  $83 USD
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm font-medium mb-2">
                              {plan.periodo}
                            </p>
                            {plan.id === 'race-pass' && (
                              <p className="text-blue-400 text-sm font-bold bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 inline-block">
                                Perfecto para probar tus habilidades
                              </p>
                            )}
                          </div>
  
                          <ul className="space-y-4 mb-8 text-sm flex-grow">
                            {plan.beneficios.map((b, idx) => (
                              <li key={idx} className="flex items-start gap-4 text-gray-300">
                                <svg
                                  className="w-6 h-6 flex-shrink-0 text-green-400 mt-0.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586l-2.293-2.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span
                                  className="font-medium leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: b
                                      .replace('viaje F1 2026', '<strong>viaje F1 2026</strong>')
                                      .replace('Elegible para viaje F1 2026', '<strong>Elegible para viaje F1 2026</strong>'),
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
  
                          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-center backdrop-blur-lg">
                            <p className="text-green-400 text-sm font-bold">
                              💡{' '}
                              {plan.isPopular
                                ? 'Acceso a TODO, máximo potencial de ganancias.'
                                : 'Ideal para probar y empezar a ganar.'}
                            </p>
                          </div>
  
                          {plan.id === 'race-pass' && currentGp && (
                            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl backdrop-blur-lg">
                              <p className="text-blue-400 text-sm font-bold text-center">
                                ✓ Válido para: {currentGp.gp_name}
                              </p>
                            </div>
                          )}
  
                          <div className="mt-auto">
                            <button
                              onClick={() => handlePurchase(plan.id)}
                              data-plan-id={plan.id}
                              disabled={processingPlan === plan.id}
                              className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-2xl hover:scale-105 active:scale-95 ${
                                plan.isPopular
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-amber-500/25'
                                  : 'bg-gradient-to-r from-gray-700 to-gray-600 text-white hover:from-gray-600 hover:to-gray-500'
                              } ${processingPlan === plan.id ? 'opacity-60 cursor-wait' : ''}`}
                            >
                              {processingPlan === plan.id ? (
                                <>
                                  <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24">
                                    <circle
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      strokeWidth="4"
                                      className="opacity-25"
                                      stroke="currentColor"
                                      fill="none"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                    />
                                  </svg>
                                  Procesando...
                                </>
                              ) : plan.isPopular ? (
                                <>
                                  <span className="text-2xl">🔥</span>
                                  ASEGURAR SEASON PASS
                                </>
                              ) : (
                                <>
                                  COMENZAR CON 1 GP - ${plan.precioUSD}
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                      fillRule="evenodd"
                                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

{/* FAQ - No animations */}
<section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-black to-neutral-950">
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-center text-3xl sm:text-4xl font-black mb-16 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                    Preguntas Frecuentes
                  </h2>
  
                  <div className="space-y-6">
                    {faqData.map((faq, index) => (
                      <details 
                        key={index} 
                        className="group bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 p-6 rounded-2xl ring-1 ring-white/10 backdrop-blur-lg shadow-xl hover:ring-white/20 transition-all duration-300"
                      >
                        <summary className="flex cursor-pointer items-center justify-between font-bold text-white text-lg">
                          <span>{faq.q}</span>
                          <svg
                            className="w-6 h-6 transition-transform duration-200 group-open:rotate-180 text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <p className="mt-4 text-gray-300 font-medium leading-relaxed">
                          {faq.a}
                        </p>
                      </details>
                    ))}

                    {/* Additional FAQ */}
                    <details className="group bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 p-6 rounded-2xl ring-1 ring-white/10 backdrop-blur-lg shadow-xl hover:ring-white/20 transition-all duration-300">
                      <summary className="flex cursor-pointer items-center justify-between font-bold text-white text-lg">
                        <span>¿Realmente puedo ganar un viaje a la F1?</span>
                        <svg
                          className="w-6 h-6 transition-transform duration-200 group-open:rotate-180 text-amber-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="mt-4 text-gray-300 font-medium leading-relaxed">
                        ¡Absolutamente! Hay 3 ganadores para 2026: los 2 mejores del ranking anual van automáticamente, y 1 ganador aleatorio entre todos los miembros VIP. Valor del viaje: $20,000+ USD incluyendo vuelos, hotel y entradas VIP.
                      </p>
                    </details>
                  </div>
                </div>
              </section>

              {/* Final CTA Section */}
              <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 via-black to-neutral-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.15),transparent_70%)]"></div>
                
                <div className="max-w-5xl mx-auto text-center relative">
                  <div className="space-y-10">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black bg-gradient-to-r from-red-400 via-orange-500 to-amber-400 bg-clip-text text-transparent mb-6">
                      La grilla de largada de tu nueva vida financiera está formada.
                    </h2>
                    
                    <p className="text-2xl text-white font-bold">
                      ¿Vas a largar o te vas a quedar viendo desde casa?
                    </p>

                    <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                      <button
                        onClick={() => handleAccederClick('final_cta')}
                        className="inline-flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black rounded-2xl text-xl shadow-2xl transition-all transform hover:scale-105 active:scale-95"
                        data-track="acceder-button"
                        data-location="final_cta"
                      >
                        <span className="text-2xl">🏁</span>
                        ASEGURAR MI LUGAR VIP
                      </button>
                      
                      <p className="text-gray-500 font-medium">
                        O seguí gritando desde el sofá...
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
  
      {/* Use Original StickyAccessCTA Component */}
      <StickyAccessCTA heroButtonRef={heroButtonRef} />

      {/* Enhanced Telegram Support Button */}
      {(
        <motion.a
          href="https://t.me/+573009290499"
          target="_blank"
          rel="noopener noreferrer"
          title="Soporte 24/7"
          aria-label="Soporte 24/7"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: "spring", stiffness: 200 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-32 right-6 z-50 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white p-4 rounded-2xl shadow-2xl transition-all duration-300 flex items-center justify-center group"
        >
          <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-black px-2 py-1 rounded-full shadow-lg">
            24/7
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-7 h-7 group-hover:rotate-12 transition-transform duration-300"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 0C5.371 0 0 5.371 0 12c0 6.628 5.371 12 12 12s12-5.372 12-12C24 5.371 18.629 0 12 0zm5.363 8.55l-1.482 7.06c-.112.54-.4.676-.81.423l-2.25-1.66-1.084 1.043c-.12.12-.22.22-.45.22l.162-2.283 4.152-3.758c.18-.16 0-.25-.28-.09l-5.13 3.227-2.21-.69c-.48-.15-.49-.48.1-.71l8.64-3.33c.4-.15.75.09.62.68z" />
          </svg>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-black px-2 py-1 rounded-full shadow-lg">
            Soporte
          </span>
        </motion.a>
      )}
    </>
  );
}

// Enhanced PredictionsTeaser component
function PredictionsTeaser() {
  const [result, setResult] = useState<RaceResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Get calendar
        const { data: schedRaw, error: schErr } = await supabase
          .from('gp_schedule')
          .select('gp_name, race_time');

        if (schErr) throw schErr;
        const schedule = (schedRaw ?? []) as GpSchedule[];
        if (!schedule.length) throw new Error('Sin calendario');

        // Get last completed GP
        const now = Date.now();
        const prevGp = [...schedule]
          .reverse()
          .find(({ race_time }) => new Date(race_time).getTime() < now);

        if (!prevGp) throw new Error('Aún no hay GP previos');
        const raceDateStr = prevGp.race_time.split('T')[0];

        // Get results
        const { data: resRaw, error: resErr } = await supabase
          .from('race_results')
          .select(
            'gp_name, gp1, pole1, fastest_lap_driver, fastest_pit_stop_team, first_team_to_pit'
          )
          .eq('gp_name', prevGp.gp_name)
          .eq('race_date', raceDateStr)
          .maybeSingle();

        if (resErr) throw resErr;
        setResult((resRaw as RaceResult) ?? null);
      } catch (e) {
        console.error('PredictionsTeaser:', e);
        setResult(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const buildDriverCard = (
    icon: string,
    label: string,
    driver: string | null | undefined,
    iconClass = 'text-amber-400'
  ) => {
    const team = driver ? driverToTeam[driver] ?? 'Default' : 'Default';
    const colors = teamColors[team] ?? teamColors.Default;

    return (
      <motion.div
        key={label}
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="relative group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
        <div
          className={`relative p-6 rounded-2xl shadow-2xl bg-gradient-to-br h-48 overflow-hidden backdrop-blur-lg border border-white/10 group-hover:scale-105 transition-all duration-300 ${colors.gradientFrom} ${colors.gradientTo}`}
        >
          <div className="absolute inset-0 bg-gradient-to-bl from-black/70 via-black/40 to-transparent z-0" />
          <div className="relative z-10 pr-[35%] sm:pr-[40%] flex flex-col justify-center h-full space-y-2">
            {driver ? (
              <>
                <div className="flex items-center gap-3">
                  <span className={`${iconClass} text-2xl drop-shadow-lg`}>{icon}</span>
                  <p className="text-lg sm:text-xl font-black text-white font-exo2 leading-tight drop-shadow-lg">
                    {label}: {driver.split(' ').slice(-1)[0]}
                  </p>
                </div>
                <p className="text-sm sm:text-base text-gray-200 font-exo2 leading-tight drop-shadow-md font-semibold">
                  {result?.gp_name ?? ''}
                </p>
                <p className="text-xs sm:text-sm text-gray-300 font-exo2 leading-tight drop-shadow-md font-medium">
                  {team}
                </p>
              </>
            ) : (
              <p className="text-gray-300 font-exo2 font-semibold">Sin datos</p>
            )}
          </div>

          {driver && (
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="absolute bottom-0 right-[-5px] w-[70%] sm:w-[75%] max-w-[200px] h-full"
            >
              <Image
                src={getDriverImage(driver)}
                alt={driver}
                fill
                sizes="200px"
                className="object-contain object-bottom drop-shadow-2xl"
              />
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  };

  const buildTeamCard = (title: string, team: string | null | undefined) => {
    const colors = team ? teamColors[team] ?? teamColors.Default : teamColors.Default;

    return (
      <motion.div
        key={title}
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        viewport={{ once: true }}
        className="relative group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
        <div
          className={`relative rounded-2xl shadow-2xl flex flex-col items-center bg-gradient-to-br h-48 overflow-hidden backdrop-blur-lg border border-white/10 group-hover:scale-105 transition-all duration-300 ${colors.gradientFrom} ${colors.gradientTo}`}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
          <div className="relative z-20 w-full text-center flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
            <h2 className="text-lg sm:text-xl font-black text-white font-exo2 drop-shadow-lg flex items-center justify-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
              </svg>
              {title}
            </h2>
            {team ? (
              <p className="text-xs sm:text-sm text-white/90 font-exo2 drop-shadow-md truncate font-semibold">
                {team} – {result?.gp_name}
              </p>
            ) : (
              <p className="text-gray-300 font-exo2 text-sm sm:text-base mt-2 font-medium">Sin datos</p>
            )}
          </div>

          {team && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute inset-0 w-full h-full z-0"
            >
              <Image
                src={getTeamCarImage(team)}
                alt={team}
                fill
                className="object-cover object-center"
              />
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-amber-500 border-r-orange-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <section className="relative py-20 px-4 sm:px-6 bg-gradient-to-b from-neutral-950 via-black to-neutral-900 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08),transparent_70%)]"></div>
      
      <motion.h2
        className="text-center text-3xl sm:text-4xl font-black mb-16 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        PREDICE DESDE EL GANADOR HASTA EL PRIMER EQUIPO EN PITS
      </motion.h2>

      <div className="grid gap-8 sm:grid-cols-2 max-w-4xl mx-auto">
        {buildDriverCard('🏆', 'Ganador', result?.gp1)}
        {buildTeamCard('Primer Equipo en Pits', result?.first_team_to_pit)}
      </div>
    </section>
  );
}