//Advertorial Page - ENHANCED WITH TRACKING
'use client';

import React from 'react';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createAuthClient } from '@/lib/supabase';
import { generateEventId, trackFBEvent } from '@/lib/trackFBEvent';

// TypeScript interfaces and types
interface GpSchedule { 
  gp_name: string; 
  qualy_time: string; 
  race_time: string; 
}

interface TrackableCTALinkProps {
  href: string;
  children: React.ReactNode;
  className: string;
  ctaLocation: string;
}

interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
}

interface SessionAttribution {
  landing_page: string;
  timestamp: number;
  referrer: string;
  utm_params: UTMParams;
  session_id: string;
  page_url: string;
}

// ==============================================
// TRACKING UTILITIES
// ==============================================

const getUTMParams = (): UTMParams => {
  if (typeof window === 'undefined') return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    fbclid: null,
    gclid: null
  };
  
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
    fbclid: params.get('fbclid'),
    gclid: params.get('gclid')
  };
};

const setSessionAttribution = (): void => {
  if (typeof window === 'undefined') return;
  
  // Only set if not already set (preserve first-touch attribution)
  if (!sessionStorage.getItem('session_attribution')) {
    const attribution: SessionAttribution = {
      landing_page: 'advertorial',
      timestamp: Date.now(),
      referrer: document.referrer,
      utm_params: getUTMParams(),
      session_id: generateEventId(),
      page_url: window.location.href
    };
    
    sessionStorage.setItem('session_attribution', JSON.stringify(attribution));
    sessionStorage.setItem('session_start', Date.now().toString());
    
    console.log('🎯 Session attribution set:', attribution);
  }
};

const getSessionAttribution = (): Partial<SessionAttribution> => {
  if (typeof window === 'undefined') return {};
  
  try {
    return JSON.parse(sessionStorage.getItem('session_attribution') || '{}');
  } catch {
    return {};
  }
};

// ==============================================
// TRACKABLE CTA COMPONENT
// ==============================================

const TrackableCTALink: React.FC<TrackableCTALinkProps> = ({ href, children, className, ctaLocation }) => {
  const handleClick = (): void => {
    const sessionAttr = getSessionAttribution();
    
    trackFBEvent('InitiateCheckout', {
      params: {
        content_type: 'cta_click',
        content_category: 'advertorial_cta',
        content_name: `cta_${ctaLocation}`,
        source: 'rn365_advertorial',
        value: 0,
        currency: 'USD',
        cta_location: ctaLocation,
        
        // Attribution data
        original_utm_source: sessionAttr.utm_params?.utm_source,
        original_utm_campaign: sessionAttr.utm_params?.utm_campaign,
        original_utm_medium: sessionAttr.utm_params?.utm_medium,
        session_duration: Date.now() - parseInt(sessionStorage.getItem('session_start') || '0'),
        referrer: sessionAttr.referrer
      },
      event_id: generateEventId()
    });
    
    console.log(`🎯 CTA clicked: ${ctaLocation}`);
  };

  return (
    <Link 
      href={href} 
      className={className}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
};

export default function MotorsportNewsArticle() {
  // State management
  const [hydrated, setHydrated] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [previousGp, setPreviousGp] = useState<GpSchedule | null>(null);
  const [gpSchedule, setGpSchedule] = useState<GpSchedule[]>([]);
  const [qualyCountdown, setQualyCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [raceCountdown, setRaceCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showQualy, setShowQualy] = useState(true);
  const [isQualyAllowed, setIsQualyAllowed] = useState(true);
  const [isRaceAllowed, setIsRaceAllowed] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  
  // New state for sticky button
  const [showStickyButton, setShowStickyButton] = useState(false);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  // Toggle dark mode
  const toggleDarkMode = (): void => {
    setDarkMode(!darkMode);
  };

  // Intersection Observer for sticky button trigger
  useEffect(() => {
    if (!hydrated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky button when headline has been viewed (when it goes out of view from top)
        if (entry.boundingClientRect.bottom < 0) {
          setShowStickyButton(true);
        } else if (entry.boundingClientRect.top > window.innerHeight) {
          setShowStickyButton(false);
        }
      },
      {
        rootMargin: '0px',
        threshold: 0
      }
    );

    if (headlineRef.current) {
      observer.observe(headlineRef.current);
    }

    return () => {
      if (headlineRef.current) {
        observer.unobserve(headlineRef.current);
      }
    };
  }, [hydrated]);

  // ==============================================
  // ENHANCED TRACKING: HEADLINE ENGAGEMENT
  // ==============================================
  useEffect(() => {
    if (!hydrated || !headlineRef.current) return;

    // Track when user scrolls past headline (engagement)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackFBEvent('ViewContent', {
            params: {
              content_type: 'article',
              content_category: 'advertorial_engagement',
              content_name: 'motormania_headline_engagement',
              source: 'rn365_advertorial',
              ...getUTMParams()
            },
            event_id: generateEventId()
          });
          
          console.log('🎯 Headline engagement tracked');
          observer.disconnect(); // Only track once
        }
      },
      { threshold: 0.5 } // Trigger when 50% of headline is visible
    );

    observer.observe(headlineRef.current);

    return () => observer.disconnect();
  }, [hydrated]);

  // Fetch data function (real Supabase integration)
  const fetchData = useCallback(async () => {
    try {
      const supabase = createAuthClient(null); // No auth needed for public schedule data
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('gp_schedule')
        .select('*')
        .order('race_time', { ascending: true });
      
      if (scheduleError) {
        console.error('Schedule fetch error:', scheduleError);
        return;
      }

      setGpSchedule(scheduleData || []);

      // Exact same logic as dashboard for determining current/previous GP
      const now = new Date();
      let currentGpIndex = -1;
      let previousGpIndex = -1;

      for (let i = 0; i < (scheduleData || []).length; i++) {
        const raceDate = new Date(scheduleData![i].race_time);
        // Find the first race that hasn't finished yet
        if (now <= raceDate && currentGpIndex === -1) {
            // Check if there's a previous race, and if its end time + buffer (e.g., 4 hours) has passed
            if (i > 0) {
                const prevRaceEndTime = new Date(scheduleData![i-1].race_time);
                prevRaceEndTime.setHours(prevRaceEndTime.getHours() + 4); // Add buffer time
                if (now < prevRaceEndTime) {
                    currentGpIndex = i - 1; // Still consider the previous race as "current" during the buffer
                } else {
                    currentGpIndex = i; // Move to the next GP
                }
            } else {
                 currentGpIndex = i; // First race of the season
            }
        }
        if (raceDate < now) {
          previousGpIndex = i;
        }
      }

       // If no future race found, the last race might be the current or previous one
       if (currentGpIndex === -1 && (scheduleData || []).length > 0) {
           const lastRaceIndex = scheduleData!.length - 1;
           const lastRaceEndTime = new Date(scheduleData![lastRaceIndex].race_time);
           lastRaceEndTime.setHours(lastRaceEndTime.getHours() + 4); // Add buffer
           if (now < lastRaceEndTime) {
               currentGpIndex = lastRaceIndex;
           } else {
               // Season likely over or between seasons
               previousGpIndex = lastRaceIndex;
           }
       }

      if (currentGpIndex >= 0 && scheduleData) {
        setCurrentGp(scheduleData[currentGpIndex]);
        const qualyDeadline = new Date(scheduleData[currentGpIndex].qualy_time).getTime() - 5 * 60 * 1000; // 5 mins before Qualy
        const raceDeadline = new Date(scheduleData[currentGpIndex].race_time).getTime() - 5 * 60 * 1000; // 5 mins before Race
        setIsQualyAllowed(now.getTime() < qualyDeadline);
        setIsRaceAllowed(now.getTime() < raceDeadline);
      } else {
        // Handle end of season or no schedule data
        setCurrentGp(null);
        setIsQualyAllowed(false);
        setIsRaceAllowed(false);
        if(scheduleData && scheduleData.length > 0) {
            // If season ended, set the last race as previous GP
             previousGpIndex = scheduleData.length - 1;
             setPreviousGp(scheduleData[previousGpIndex]);
        }
      }

      if (previousGpIndex >= 0 && scheduleData) {
        const prevGpToFetch = scheduleData[previousGpIndex];
        setPreviousGp(prevGpToFetch); // Set previous GP regardless of current GP status
      } else if (!previousGp && !currentGp && scheduleData && scheduleData.length > 0){
        // If it's before the first race, there are no previous results for this season yet.
        setPreviousGp(null);
      }

      setIsDataLoaded(true);
    } catch (err) {
      console.error('Fetch error:', err);
      setIsDataLoaded(true);
    }
  }, []);

  // Format countdown function
  const formatCountdown = (countdown: { days: number; hours: number; minutes: number; seconds: number }): string => {
    const d = Math.max(0, countdown.days);
    const h = Math.max(0, countdown.hours);
    const m = Math.max(0, countdown.minutes);
    const s = Math.max(0, countdown.seconds);
    return `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  // ==============================================
  // ENHANCED INITIAL DATA FETCH WITH TRACKING
  // ==============================================
  useEffect(() => {
    setHydrated(true);
    fetchData();
    
    // Set up session attribution
    setSessionAttribution();
    
    // Track page view
    if (typeof window !== 'undefined') {
      trackFBEvent('PageView', {
        params: {
          content_type: 'article',
          content_category: 'advertorial_investigation',
          content_name: 'motormania_rn365_investigation',
          source: 'rn365_advertorial',
          page_location: window.location.href,
          ...getUTMParams()
        },
        event_id: generateEventId()
      });
      
      console.log('🎯 Page view tracked for advertorial');
    }
  }, [fetchData]);

  // Countdown and GP switching logic (from dashboard)
  useEffect(() => {
    if (!currentGp || !gpSchedule.length) return;

    const updateCountdown = () => {
      const now = new Date();
      const qualyDate = new Date(currentGp.qualy_time);
      const raceDate = new Date(currentGp.race_time);
      const qualyDeadline = qualyDate.getTime() - 5 * 60 * 1000;
      const raceDeadline = raceDate.getTime() - 5 * 60 * 1000;
      const raceEndTimeBuffer = raceDate.getTime() + 4 * 60 * 60 * 1000;

      let qualyDiff = qualyDate.getTime() - now.getTime();
      let raceDiff = raceDate.getTime() - now.getTime();

      // Update Qualy Countdown
      if (qualyDiff > 0) {
        setQualyCountdown({
          days: Math.floor(qualyDiff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((qualyDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((qualyDiff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((qualyDiff % (1000 * 60)) / 1000),
        });
      } else {
        setQualyCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }

      // Update Race Countdown
      if (raceDiff > 0) {
        setRaceCountdown({
          days: Math.floor(raceDiff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((raceDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((raceDiff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((raceDiff % (1000 * 60)) / 1000),
        });
      } else {
        setRaceCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }

      // Update Prediction Allowed Status
      setIsQualyAllowed(now.getTime() < qualyDeadline);
      setIsRaceAllowed(now.getTime() < raceDeadline);

      // Auto-switch GP logic
      if (now.getTime() >= raceEndTimeBuffer) {
        const currentIndex = gpSchedule.findIndex((gp) => gp.gp_name === currentGp.gp_name);
        if (currentIndex !== -1 && currentIndex < gpSchedule.length - 1) {
          const nextGp = gpSchedule[currentIndex + 1];
          const nextRaceDate = new Date(nextGp.race_time);
          if (nextRaceDate.getTime() - now.getTime() < 14 * 24 * 60 * 60 * 1000) {
            setPreviousGp(currentGp);
            setCurrentGp(nextGp);
          }
        } else {
          setPreviousGp(currentGp);
          setCurrentGp(null);
          setIsQualyAllowed(false);
          setIsRaceAllowed(false);
        }
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [currentGp, gpSchedule]);

  // Toggle between qualy and race countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setShowQualy((prev) => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Global reset and layout overrides */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        html,
        body {
          margin: 0;
          padding: 0;
          background-color: white;
        }
        body {
          overflow-x: hidden;
        }
        /* Aggressive override for this advertorial page */
        main {
          padding: 0 !important;
          margin: 0 !important;
        }
        /* Reset any wrapper containers */
        body > * {
          margin-top: 0 !important;
        }
        /* Ensure our page starts at the very top */
        .advertorial-page {
          position: relative;
          top: 0;
          margin: 0;
          padding: 0;
        }
        /* Smooth scroll behavior for anchor links */
        html {
          scroll-behavior: smooth;
        }
        /* VIP banner animations */
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        /* F1 countdown animations */
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        /* Mobile-optimized countdown */
        @media (max-width: 640px) {
          .countdown-text {
            font-size: 0.75rem;
          }
          .countdown-time {
            font-size: 1rem;
          }
        }
        /* Sticky button animations */
        @keyframes slideInUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes slideOutDown {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
          }
        }
      `}</style>

      <div className={`advertorial-page min-h-screen w-full transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-white'}`}>
        {/* Top Navigation Bar - Static (not sticky) */}
        <nav className={`shadow-lg w-full transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-gray-900'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {/* Main Nav Bar */}
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4 sm:space-x-12">
                <div className="text-lg sm:text-2xl font-bold text-white">
                  <span className="text-red-500">RN</span>
                  <span className="bg-red-500 text-white px-1 rounded">365</span>
                </div>
                <div className="hidden md:flex space-x-6 text-sm font-medium text-gray-400">
                  <span className="cursor-default">HOME</span>
                  <span className="cursor-default">F1 NEWS</span>
                  <span className="cursor-default">F1 CALENDAR</span>
                  <span className="cursor-default">F1 STANDINGS</span>
                  <span className="cursor-default">INTERVIEWS</span>
                  <span className="cursor-default">VIDEOS</span>
                  <span className="cursor-default">PODCAST</span>
                </div>
              </div>
              
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                  darkMode ? 'bg-red-600' : 'bg-gray-600'
                }`}
                aria-label="Toggle dark mode"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-300 ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
                {/* Icons */}
                <span className="absolute left-1 top-1">
                  {!darkMode ? (
                    <svg className="h-3 w-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  ) : null}
                </span>
                <span className="absolute right-1 top-1">
                  {darkMode ? (
                    <svg className="h-3 w-3 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  ) : null}
                </span>
              </button>
            </div>
          </div>
        </nav>
          
        {/* F1 Race Info Banner - STICKY */}
        <div className="bg-black border-t border-gray-700 sticky top-0 z-50 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {/* Mobile Layout */}
            <div className="block sm:hidden py-3">
              <div className="text-center">
                <div className="text-white font-bold text-base mb-2">
                  {currentGp ? currentGp.gp_name.toUpperCase() : 'SEASON ENDED'}
                </div>
                {currentGp && (
                  <div className="text-red-500 font-bold text-sm mb-3">
                    <div className="flex flex-col items-center">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={showQualy ? 'qualy' : 'race'}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center gap-2 mb-1"
                        >
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
                          <div className="text-xs text-red-300 uppercase tracking-wide countdown-text">
                            {showQualy ? 'Qualifying in' : 'Race in'}
                          </div>
                          <div className="text-xs text-red-300 opacity-60">LIVE</div>
                        </motion.div>
                      </AnimatePresence>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={showQualy ? 'qualy-time' : 'race-time'}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3 }}
                          className="font-mono countdown-time font-bold"
                        >
                          {formatCountdown(showQualy ? qualyCountdown : raceCountdown)}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between py-3">
              {/* Previous Race */}
              <div className="flex items-center space-x-3 text-white opacity-60">
                <div className="text-center">
                  <div className="text-xs font-bold">PREVIOUS</div>
                  <div className="text-xs">{previousGp ? previousGp.gp_name.split(' ')[0] : 'N/A'}</div>
                </div>
              </div>
              
              {/* Current/Next Race */}
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center space-x-3 mb-2">
                  <div>
                    <div className="text-white font-bold text-lg sm:text-xl">
                      {currentGp ? currentGp.gp_name.toUpperCase() : 'SEASON ENDED'}
                    </div>
                    {currentGp && (
                      <div className="text-red-500 font-bold text-sm">
                        <div className="flex flex-col items-center">
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={showQualy ? 'qualy' : 'race'}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.3 }}
                              className="flex items-center gap-2 mb-1"
                            >
                              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                              <div className="text-xs text-red-300 uppercase tracking-wide">
                                {showQualy ? 'Qualifying in' : 'Race in'}
                              </div>
                              <div className="text-xs text-red-300 opacity-60">LIVE</div>
                            </motion.div>
                          </AnimatePresence>
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={showQualy ? 'qualy-time' : 'race-time'}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ duration: 0.3 }}
                              className="font-mono text-base sm:text-lg"
                            >
                              {formatCountdown(showQualy ? qualyCountdown : raceCountdown)}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Desktop Schedule */}
                {currentGp && (
                  <div className="flex justify-center space-x-8 text-xs text-gray-300">
                    <div>
                      <span className="text-white">Qualifying:</span> {new Date(currentGp.qualy_time).toLocaleDateString('en-US', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'UTC'
                      })} UTC
                    </div>
                    <div>
                      <span className="text-white">Race:</span> {new Date(currentGp.race_time).toLocaleDateString('en-US', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'UTC'
                      })} UTC
                    </div>
                  </div>
                )}
              </div>
              
              {/* Next Race */}
              <div className="flex items-center space-x-3 text-white opacity-60">
                <div className="text-center">
                  <div className="text-xs font-bold">NEXT</div>
                  <div className="text-xs">
                    {currentGp && gpSchedule.length > 0 ? (
                      (() => {
                        const currentIndex = gpSchedule.findIndex(gp => gp.gp_name === currentGp.gp_name);
                        const nextGp = currentIndex !== -1 && currentIndex < gpSchedule.length - 1 ? gpSchedule[currentIndex + 1] : null;
                        return nextGp ? nextGp.gp_name.split(' ')[0] : 'TBD';
                      })()
                    ) : 'TBD'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky CTA Button */}
        <AnimatePresence>
          {showStickyButton && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed bottom-0 left-0 right-0 z-40 p-4 sm:p-6"
            >
              <div className="max-w-lg mx-auto">
                <TrackableCTALink 
                  href="/investigacion-rn365" 
                  className={`block w-full px-4 sm:px-6 py-3 sm:py-4 text-center text-sm sm:text-base font-bold rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl transition-all active:scale-95 transform hover:scale-105 ${
                    darkMode 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                  ctaLocation="sticky_button_cta"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <span>💰</span>
                    <span>COMPETIR POR $1,000 USD</span>
                    <span>→</span>
                  </div>
                  <div className="text-xs opacity-90 mt-1">
                    Próximo GP: $500 al P1 + $500 sorteo
                  </div>
                </TrackableCTALink>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content with proper spacing */}
        <div className="">
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <div className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm border-b transition-colors duration-300 ${
              darkMode 
                ? 'text-gray-400 bg-gray-800 border-gray-700' 
                : 'text-gray-500 bg-gray-50 border-gray-100'
            }`}>
              <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
                <span className={`cursor-pointer whitespace-nowrap transition-colors ${
                  darkMode ? 'hover:text-red-400' : 'hover:text-red-600'
                }`}>Home</span>
                <span>/</span>
                <span className={`cursor-pointer whitespace-nowrap transition-colors ${
                  darkMode ? 'hover:text-red-400' : 'hover:text-red-600'
                }`}>F1 News</span>
                <span>/</span>
                <span className={`cursor-pointer whitespace-nowrap transition-colors ${
                  darkMode ? 'hover:text-red-400' : 'hover:text-red-600'
                }`}>Analysis</span>
                <span>/</span>
                <span className={`font-medium whitespace-nowrap ${
                  darkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>Special Investigation</span>
              </div>
            </div>

            {/* Article Header */}
            <header className="px-4 sm:px-6 py-6 sm:py-12">
              <div className="max-w-4xl mx-auto">
                <div className="inline-block bg-red-500 text-white px-3 sm:px-4 py-1 sm:py-2 text-xs font-semibold mb-4 sm:mb-8 rounded uppercase tracking-wide">
                  SPECIAL INVESTIGATION
                </div>
                <h1 
                  ref={headlineRef}
                  className={`text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-8 transition-colors duration-300 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  La nueva plataforma viral que está cambiando cómo los fanáticos viven la F1 en Latinoamérica
                </h1>
                <p className={`text-lg sm:text-xl md:text-2xl leading-relaxed mb-6 sm:mb-12 max-w-4xl transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Una investigación exclusiva revela cómo miles de seguidores están transformando su experiencia de espectadores pasivos a competidores reales cada domingo de carrera.
                </p>

                {/* Hero Image */}
                <div className="mb-8 sm:mb-16">
                  <div className="w-full h-48 sm:h-80 md:h-[500px] rounded-lg sm:rounded-2xl mb-3 sm:mb-6 relative overflow-hidden shadow-xl sm:shadow-2xl">
                    <img 
                      src="/images/advertorial/f1-hero-main.jpg" 
                      alt="F1 strategic operations and passionate fans"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 italic text-center px-2">
                    La intensidad y precisión de la Fórmula 1 inspira a millones de aficionados a poner a prueba sus conocimientos estratégicos
                  </p>
                </div>
                
                {/* Author and Meta Info */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0 text-sm border-b pb-4 sm:pb-8 transition-colors duration-300 ${
                  darkMode 
                    ? 'text-gray-400 border-gray-700' 
                    : 'text-gray-500 border-gray-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-6">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                        darkMode ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <svg className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-300 ${
                          darkMode ? 'text-gray-300' : 'text-gray-600'
                        }`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <div className={`font-semibold text-sm sm:text-base transition-colors duration-300 ${
                          darkMode ? 'text-gray-200' : 'text-gray-700'
                        }`}>Gabriel Torres</div>
                        <div className={`text-xs sm:text-sm transition-colors duration-300 ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>F1 Correspondent & Motorsport Analyst</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-xs sm:text-sm">
                      <span>10 Jul 2025</span>
                      <span className={darkMode ? 'text-gray-600' : 'text-gray-300'}>•</span>
                      <span>6 min read</span>
                      <span className={darkMode ? 'text-gray-600' : 'text-gray-300'}>•</span>
                      <span className={`px-2 py-1 rounded text-xs transition-colors duration-300 ${
                        darkMode 
                          ? 'bg-gray-700 text-gray-200' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>EXCLUSIVE</span>
                    </div>
                  </div>
                  
                  {/* Social Share Icons */}
                  <div className="flex items-center space-x-3 pt-2 sm:pt-0">
                    <span className={`text-xs font-medium transition-colors duration-300 ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>Compartir:</span>
                    <button className={`p-2 rounded-full transition-all hover:scale-110 ${
                      darkMode 
                        ? 'bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white' 
                        : 'bg-gray-100 hover:bg-blue-600 text-gray-600 hover:text-white'
                    }`}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                      </svg>
                    </button>
                    <button className={`p-2 rounded-full transition-all hover:scale-110 ${
                      darkMode 
                        ? 'bg-gray-700 hover:bg-blue-700 text-gray-300 hover:text-white' 
                        : 'bg-gray-100 hover:bg-blue-700 text-gray-600 hover:text-white'
                    }`}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </header>
            
            {/* Main Article Content */}
            <article className="px-4 sm:px-6">
              <div className="max-w-4xl mx-auto">
                {/* Opening Section */}
                <div className="prose prose-lg sm:prose-xl max-w-none mb-8 sm:mb-16">
                  <p className={`text-lg sm:text-xl leading-relaxed mb-6 sm:mb-8 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <span className={`font-bold transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>MEDELLÍN, Colombia</span> – Para millones de aficionados de la Fórmula 1 en Latinoamérica, el ritual del domingo se ha convertido en una mezcla de pasión y frustración. Un sentimiento creciente de que las decisiones tomadas en el pit wall por los equipos multimillonarios no siempre son las más acertadas ha dominado las conversaciones.
                  </p>
                  
                  <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Esta percepción de "genialidad desperdiciada" está ahora alimentando un fenómeno inesperado: una migración masiva de debates en redes sociales a arenas de competencia online, donde el conocimiento estratégico es, finalmente, puesto a prueba por premios reales.
                  </p>
                </div>
                
                {/* Expert Quote */}
                <div className="mb-8 sm:mb-16">
                  <blockquote className={`border-l-4 sm:border-l-8 border-red-400 p-6 sm:p-12 rounded-r-lg sm:rounded-r-2xl shadow-md sm:shadow-lg relative transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-800 shadow-gray-900/50' 
                      : 'bg-red-50 shadow-gray-200/50'
                  }`}>
                    <div className="text-4xl sm:text-8xl text-red-200 font-serif absolute -top-1 sm:-top-2 -left-1 sm:-left-2 select-none">"</div>
                    <p className={`text-lg sm:text-2xl italic leading-relaxed pl-6 sm:pl-12 mb-3 sm:mb-6 transition-colors duration-300 ${
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      La era del espectador pasivo terminó. El aficionado de hoy está altamente informado y se ve a sí mismo como un par estratégico de los equipos. No solo quieren un boleto; quieren un asiento en la mesa de estrategia, y la tecnología ahora lo permite.
                    </p>
                    <footer className={`text-sm sm:text-base pl-6 sm:pl-12 font-medium transition-colors duration-300 ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Dr. Alejandro Vargas, sociólogo especializado en comunidades de aficionados
                    </footer>
                  </blockquote>
                </div>
                
                <div className="prose prose-lg sm:prose-xl max-w-none mb-8 sm:mb-16">
                  <p className={`text-lg sm:text-xl leading-relaxed mb-6 sm:mb-8 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Tradicionalmente, esta experticia se limitaba a discusiones acaloradas que no generaban ningún valor tangible. Ahora, una plataforma colombiana, <span className={`font-bold transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>MotorManía</span>, ha emergido como la líder de este movimiento. En ella, los usuarios envían un plan estratégico completo para cada GP, prediciendo desde el pole position hasta el primer equipo en realizar una parada en pits.
                  </p>
                  
                  <p className={`text-lg sm:text-xl leading-relaxed mb-6 sm:mb-8 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    El desempeño se mide por un sistema de puntos que recompensa la precisión. El éxito del formato es notable, con la plataforma sumando ya <span className={`font-bold transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>miles de miembros VIP activos</span>.
                  </p>
                  
                  <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Lo que eleva la competencia a otro nivel son los premios. Al final de la temporada, los <span className={`font-bold transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>tres mejores estrategas no ganan un trofeo simbólico</span>. Ganan un <span className={`font-bold transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>viaje VIP con todo pago a un Gran Premio de F1 en 2026</span>: dos lugares se otorgan por puntaje acumulado y uno por sorteo entre todos los participantes activos, demostrando que tanto la estrategia como la suerte tienen su lugar.
                  </p>
                  
                  <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Pero los premios no terminan ahí. Para mantener la emoción en cada carrera, el <span className={`font-bold transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>próximo Gran Premio ofrecerá $500 USD al mejor estratega</span> y otros <span className={`font-bold transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>$500 USD a un participante seleccionado al azar</span>
                  </p>
                </div>

                {/* New Section: The Real Impact - WITH REF */}
                <div className="mb-8 sm:mb-12">
                  <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 transition-colors duration-300 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Cómo la Competencia Transforma Tu Experiencia de F1
                  </h2>
                  <div className="w-16 sm:w-24 h-1 bg-red-600 mb-6 sm:mb-8"></div>
                </div>

                <div className="prose prose-lg sm:prose-xl max-w-none mb-8 sm:mb-16">
                  <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    "Nunca me di cuenta de lo ABURRIDO que se estaba volviendo ver F1 hasta que comencé a competir", explica Ana Herrera, usuarioa de la plataforma MotorManía. "Pensé que amaba ver las carreras, pero solo estaba siguiendo la rutina. En el momento que tuve puntos en juego, cada vuelta se volvió eléctrica."
                  </p>
                </div>

                {/* Impact Cards */}
                <div className="grid md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-16">
                  <div className={`border rounded-xl sm:rounded-2xl p-6 sm:p-8 transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-blue-900/20 border-blue-700/30' 
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="text-3xl sm:text-4xl mb-4">⚡</div>
                    <h4 className={`text-xl sm:text-2xl font-bold mb-4 transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>De Espectador Pasivo a Competidor Activo</h4>
                    <p className={`text-base sm:text-lg leading-relaxed transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      "Cuando Verstappen hizo esa maniobra agresiva con Russell, no solo estaba viendo - estaba calculando cómo afectaba MI predicción, MI clasificación, MI oportunidad de esa experiencia VIP. Mi corazón latía como si estuviera en el cockpit."
                    </p>
                    <div className={`text-sm sm:text-base mt-3 font-medium transition-colors duration-300 ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      - Carlos Mendoza, Medellín
                    </div>
                  </div>
                  
                  <div className={`border rounded-xl sm:rounded-2xl p-6 sm:p-8 transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-green-900/20 border-green-700/30' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="text-3xl sm:text-4xl mb-4">🎯</div>
                    <h4 className={`text-xl sm:text-2xl font-bold mb-4 transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>La Adrenalina de la Comunidad</h4>
                    <p className={`text-base sm:text-lg leading-relaxed transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      "Tenemos 12 tipos de diferentes países compitiendo entre nosotros cada fin de semana. Las bromas antes de la clasificación, las celebraciones después de predicciones correctas, las sesiones de análisis grupal - es como tener tu propio club del paddock F1."
                    </p>
                    <div className={`text-sm sm:text-base mt-3 font-medium transition-colors duration-300 ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      - David Ruiz, Ciudad de México
                    </div>
                  </div>
                </div>

                <div className="prose prose-lg sm:prose-xl max-w-none mb-8 sm:mb-16">
                  <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    La plataforma ha convertido efectivamente la visualización casual en una competencia apasionada. "Mi esposa solía quejarse de que veía 'demasiada' F1", se ríe Miguel Santos de Rosario, Argentina. "Ahora ve conmigo porque le encanta verme celebrar cuando mis estrategias funcionan. El fin de semana pasado, cuando predije correctamente el podio, gritamos tan fuerte que los vecinos vinieron a ver si estábamos bien."
                  </p>
                </div>

                {/* Competition Journey Testimonial */}
                <div className={`border rounded-xl sm:rounded-2xl p-6 sm:p-12 my-8 sm:my-16 shadow-md sm:shadow-lg transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-red-900/20 border-red-700/30 shadow-gray-900/50' 
                    : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 shadow-red-100/50'
                }`}>
                  <h4 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 transition-colors duration-300 ${
                    darkMode ? 'text-red-400' : 'text-red-700'
                  }`}>El Viaje de 8 Semanas: De Frustrado a Fanático Total</h4>
                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-bold transition-colors duration-300 ${
                        darkMode 
                          ? 'bg-red-800/50 text-red-300' 
                          : 'bg-red-100 text-red-700'
                      }`}>Semana 1</div>
                      <p className={`text-base sm:text-lg transition-colors duration-300 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        "Era escéptico pero me registré para el GP de Hungría. Cuando acerté la predicción de pole position, obtuve PUNTOS reales por ello. Por primera vez, mi conocimiento valía algo."
                      </p>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-bold transition-colors duration-300 ${
                        darkMode 
                          ? 'bg-red-800/50 text-red-300' 
                          : 'bg-red-100 text-red-700'
                      }`}>Semana 4</div>
                      <p className={`text-base sm:text-lg transition-colors duration-300 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        "Estoy en el top 200. Mi esposa dice que estoy obsesionado, pero cuando predije correctamente la estrategia de neumáticos de Verstappen, salté del sofá celebrando como si hubiera ganado la carrera yo mismo."
                      </p>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-bold transition-colors duration-300 ${
                        darkMode 
                          ? 'bg-red-800/50 text-red-300' 
                          : 'bg-red-100 text-red-700'
                      }`}>Semana 8</div>
                      <p className={`text-base sm:text-lg transition-colors duration-300 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        "Top 15 en el ranking. No puedo creer que realmente estoy compitiendo por una experiencia VIP real en F1. Los domingos ya no son entretenimiento - son MI oportunidad de demostrar que sé de este deporte."
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm sm:text-base font-medium mt-6 transition-colors duration-300 ${
                    darkMode ? 'text-red-400' : 'text-red-600'
                  }`}>
                    - Testimonio real de usuario MotorManía
                  </div>
                </div>
                
                {/* Section Header */}
                <div className="mb-8 sm:mb-12">
                  <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 transition-colors duration-300 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>La Oportunidad para los Lectores</h2>
                  <div className="w-16 sm:w-24 h-1 bg-red-600 mb-6 sm:mb-8"></div>
                </div>
                
                <div className="prose prose-lg sm:prose-xl max-w-none mb-8 sm:mb-16">
                  <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Con la disputa por los cupos de 2026 ya en marcha, el equipo de MotorManía acordó abrir una ventana de oportunidad para los lectores de este artículo que deseen poner a prueba sus habilidades.
                  </p>
                </div>
                
                {/* Founder Quote */}
                <div className={`border rounded-xl sm:rounded-2xl p-6 sm:p-12 my-8 sm:my-16 shadow-md sm:shadow-lg transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
                    : 'bg-gray-50 border-gray-200 shadow-gray-200/50'
                }`}>
                  <p className={`text-lg sm:text-2xl italic leading-relaxed mb-4 sm:mb-6 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    "Creamos MotorManía porque creemos que la pasión por este deporte no debería estar limitada por tu código postal o cuenta bancaria. Queremos dar a otros fanáticos la oportunidad real de vivir la F1 desde adentro, algo que sin esta plataforma sería solo un sueño inalcanzable."
                  </p>
                  <div className={`text-sm sm:text-base font-medium transition-colors duration-300 ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Gabriel Toro, Co-Founder MotorManía
                  </div>
                </div>
                
                {/* VIP Experience Image */}
                <div className="mb-8 sm:mb-16">
                  <div className="w-full h-48 sm:h-80 md:h-[400px] rounded-lg sm:rounded-2xl mb-3 sm:mb-6 relative overflow-hidden shadow-xl sm:shadow-2xl">
                    <img 
                      src="/images/advertorial/f1-vip-paddock.jpg" 
                      alt="VIP paddock experience at F1 Grand Prix"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    </div>
                  </div>
                  <p className={`text-xs sm:text-sm italic text-center px-2 transition-colors duration-300 ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Experiencia VIP en el paddock: el sueño de todo aficionado a la F1 que ahora puede hacerse realidad a través de la competición MotorManía
                  </p>
                </div>
                
                <div className="prose prose-lg sm:prose-xl max-w-none mb-8 sm:mb-16">
                  <p className={`text-lg sm:text-xl leading-relaxed mb-6 sm:mb-8 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Para los lectores de este artículo, la plataforma está ofreciendo un <span className={`font-bold transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>"Pase de Estratega"</span> de acceso único. Este permite que cualquier aficionado entre a la arena para el próximo GP por un valor simbólico, acumulando puntos que ya cuentan para la carrera por uno de los tres viajes.
                  </p>
                  
                  <p className={`text-lg sm:text-xl leading-relaxed mb-6 sm:mb-8 font-semibold transition-colors duration-300 ${
                    darkMode ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    La oferta está condicionada a la disponibilidad de cupos para la próxima carrera.
                  </p>
                  
                  <p className={`text-lg sm:text-xl leading-relaxed text-center mb-8 sm:mb-12 transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Para verificar la disponibilidad y reclamar tu pase, utiliza el enlace seguro a continuación:
                  </p>
                </div>
                
                {/* Main CTA Section */}
                <div className={`border-2 rounded-2xl sm:rounded-3xl p-6 sm:p-12 my-12 sm:my-20 shadow-xl sm:shadow-2xl transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-black/50' 
                    : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 shadow-gray-200/50'
                }`}>
                  <div className="text-center mb-8 sm:mb-12">
                    <div className="inline-flex items-center justify-center bg-green-100 text-green-700 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
                      ✓ Estado de la Oferta para Lectores: ACTIVA
                    </div>
                    <h3 className={`text-2xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 leading-tight transition-colors duration-300 ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>Acceso a la Arena MotorManía</h3>
                    <p className={`text-lg sm:text-2xl mb-6 sm:mb-8 transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>Tu Pase de Estratega desbloquea:</p>
                    
                    {/* Prize Highlight Box */}
                    <div className={`border-2 border-dashed rounded-xl p-4 sm:p-6 mb-8 sm:mb-12 transition-colors duration-300 ${
                      darkMode 
                        ? 'border-yellow-600 bg-yellow-900/20' 
                        : 'border-yellow-500 bg-yellow-50'
                    }`}>
                      <div className="text-center">
                        <div className="text-2xl sm:text-3xl mb-2">💰</div>
                        <h4 className={`text-lg sm:text-xl font-bold mb-2 transition-colors duration-300 ${
                          darkMode ? 'text-yellow-400' : 'text-yellow-700'
                        }`}>¡PREMIOS DEL PRÓXIMO GP!</h4>
                        <p className={`text-sm sm:text-base transition-colors duration-300 ${
                          darkMode ? 'text-yellow-300' : 'text-yellow-800'
                        }`}>
                          <span className="font-bold">$500 USD</span> al mejor estratega + <span className="font-bold">$500 USD</span> por sorteo
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 sm:space-y-8 mb-8 sm:mb-12">
                    <div className={`flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 p-4 sm:p-8 rounded-xl sm:rounded-2xl border shadow-sm hover:shadow-md transition-all ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 hover:shadow-gray-900/50' 
                        : 'bg-white border-gray-200 hover:shadow-gray-200/50'
                    }`}>
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
                        <span className="text-2xl sm:text-3xl">🏆</span>
                      </div>
                      <div className="text-center sm:text-left">
                        <h4 className={`text-lg sm:text-xl font-bold mb-2 sm:mb-3 transition-colors duration-300 ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>Tu Entrada Oficial a la Competencia</h4>
                        <p className={`text-base sm:text-lg leading-relaxed transition-colors duration-300 ${
                          darkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          Registra tus predicciones estratégicas para el próximo GP y entra formalmente en la disputa por premios inmediatos ($1,000 USD este GP) y los 3 viajes VIP anuales a la Fórmula 1. ¡Múltiples formas de ganar!
                        </p>
                      </div>
                    </div>
                    
                    <div className={`flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 p-4 sm:p-8 rounded-xl sm:rounded-2xl border shadow-sm hover:shadow-md transition-all ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 hover:shadow-gray-900/50' 
                        : 'bg-white border-gray-200 hover:shadow-gray-200/50'
                    }`}>
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
                        <span className="text-2xl sm:text-3xl">🎯</span>
                      </div>
                      <div className="text-center sm:text-left">
                        <h4 className={`text-lg sm:text-xl font-bold mb-2 sm:mb-3 transition-colors duration-300 ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>La Adrenalina de Cada Vuelta</h4>
                        <p className={`text-base sm:text-lg leading-relaxed transition-colors duration-300 ${
                          darkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          De repente, cada decisión estratégica que predices correctamente genera una emoción real. Safety cars, pit stops, cambios de neumáticos - todo se convierte en TU momento de brillar mientras subes en el ranking.
                        </p>
                      </div>
                    </div>
                    
                    <div className={`flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 p-4 sm:p-8 rounded-xl sm:rounded-2xl border shadow-sm hover:shadow-md transition-all ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 hover:shadow-gray-900/50' 
                        : 'bg-white border-gray-200 hover:shadow-gray-200/50'
                    }`}>
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
                        <span className="text-2xl sm:text-3xl">⚡</span>
                      </div>
                      <div className="text-center sm:text-left">
                        <h4 className={`text-lg sm:text-xl font-bold mb-2 sm:mb-3 transition-colors duration-300 ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>Encuentra Tu Tribu de Verdaderos Conocedores</h4>
                        <p className={`text-base sm:text-lg leading-relaxed transition-colors duration-300 ${
                          darkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          Por primera vez, compites contra personas que REALMENTE saben de F1. Cuando vences a 2,000 estrategas con tu predicción de Mónaco, la sensación es mejor que ver ganar a tu equipo favorito.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <TrackableCTALink 
                      href="/investigacion-rn365" 
                      className="block w-full bg-red-600 text-white px-6 sm:px-12 py-4 sm:py-6 text-lg sm:text-xl font-bold rounded-xl sm:rounded-2xl hover:bg-red-700 transition-all active:scale-95 shadow-xl sm:shadow-2xl mb-4 sm:mb-8"
                      ctaLocation="main_article_cta"
                    >
                      RECLAMAR PASE DE ESTRATEGA - COMPETIR POR $1,000 USD →
                    </TrackableCTALink>
                    
                    <div className={`text-sm sm:text-base max-w-2xl mx-auto px-2 transition-colors duration-300 ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Serás redirigido a la página de inscripción segura. <span className="text-red-600 font-semibold">Próximo GP: $500 al mejor estratega + $500 por sorteo.</span>
                    </div>
                  </div>
                </div>
                
                {/* Article Footer */}
                <footer className={`border-t pt-8 sm:pt-12 mt-12 sm:mt-20 transition-colors duration-300 ${
                  darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className={`text-sm sm:text-base mb-6 sm:mb-8 leading-relaxed transition-colors duration-300 ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Esta investigación fue realizada entre marzo y julio de 2025 con testimonios verificados de usuarios de MotorManía Fantasy en Argentina, Colombia, México, España y Chile.
                  </div>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8">
                    {['#Formula1', '#FantasySports', '#Motorsport', '#FanEngagement', '#MotorManía'].map((tag) => (
                      <span 
                        key={tag}
                        className={`px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors duration-300 ${
                          darkMode 
                            ? 'bg-gray-700 text-gray-300' 
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {/* Share buttons */}
                  <div className={`flex flex-wrap items-center gap-4 sm:gap-6 text-sm sm:text-base transition-colors duration-300 ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    <span className="font-medium">Share:</span>
                    <a href="#" className={`flex items-center space-x-1 font-medium py-2 transition-colors ${
                      darkMode ? 'hover:text-blue-400' : 'hover:text-blue-600'
                    }`}>
                      <span>📘</span>
                      <span>Facebook</span>
                    </a>
                    <a href="#" className={`flex items-center space-x-1 font-medium py-2 transition-colors ${
                      darkMode ? 'hover:text-blue-300' : 'hover:text-blue-400'
                    }`}>
                      <span>🐦</span>
                      <span>Twitter</span>
                    </a>
                    <a href="#" className={`flex items-center space-x-1 font-medium py-2 transition-colors ${
                      darkMode ? 'hover:text-green-400' : 'hover:text-green-600'
                    }`}>
                      <span>📱</span>
                      <span>WhatsApp</span>
                    </a>
                    <a href="#" className={`flex items-center space-x-1 font-medium py-2 transition-colors ${
                      darkMode ? 'hover:text-red-400' : 'hover:text-red-600'
                    }`}>
                      <span>📺</span>
                      <span>YouTube</span>
                    </a>
                  </div>
                </footer>
              </div>
            </article>
            
            {/* Related Articles Sidebar */}
            <aside className={`px-4 sm:px-6 py-8 sm:py-12 border-t mt-8 sm:mt-16 transition-colors duration-300 ${
              darkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="max-w-4xl mx-auto">
                <h3 className={`text-xl sm:text-2xl font-bold mb-6 sm:mb-8 transition-colors duration-300 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>Related F1 Stories</h3>
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 lg:gap-8">
                  <div className="group cursor-pointer">
                    <div className="w-full h-24 sm:h-32 rounded-lg sm:rounded-xl mb-3 sm:mb-4 overflow-hidden relative group-hover:scale-105 transition-transform">
                      <img 
                        src="/images/advertorial/f1-digital-era.jpg" 
                        alt="F1 in the digital era"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-red-600 bg-opacity-20"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xl sm:text-2xl">🏎️</span>
                      </div>
                    </div>
                    <h4 className={`text-sm sm:text-base font-semibold mb-1 sm:mb-2 leading-tight transition-colors group-hover:text-red-600 ${
                      darkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>How the F1 fanbase has evolved in the digital era</h4>
                    <div className={`text-xs sm:text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>2 days ago</div>
                  </div>
                  <div className="group cursor-pointer">
                    <div className="w-full h-24 sm:h-32 rounded-lg sm:rounded-xl mb-3 sm:mb-4 overflow-hidden relative group-hover:scale-105 transition-transform">
                      <img 
                        src="/images/advertorial/predictions-latam.jpg" 
                        alt="Sports predictions in Latin America"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-blue-600 bg-opacity-20"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xl sm:text-2xl">📊</span>
                      </div>
                    </div>
                    <h4 className={`text-sm sm:text-base font-semibold mb-1 sm:mb-2 leading-tight transition-colors group-hover:text-red-600 ${
                      darkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>The rise of sports predictions in Latin America</h4>
                    <div className={`text-xs sm:text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>1 week ago</div>
                  </div>
                  <div className="group cursor-pointer sm:col-span-2 lg:col-span-1">
                    <div className="w-full h-24 sm:h-32 rounded-lg sm:rounded-xl mb-3 sm:mb-4 overflow-hidden relative group-hover:scale-105 transition-transform">
                      <img 
                        src="/images/advertorial/fan-participation.jpg" 
                        alt="F1 fan participation analysis"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-green-600 bg-opacity-20"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xl sm:text-2xl">🎯</span>
                      </div>
                    </div>
                    <h4 className={`text-sm sm:text-base font-semibold mb-1 sm:mb-2 leading-tight transition-colors group-hover:text-red-600 ${
                      darkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>Analysis: Why F1 fans seek greater participation</h4>
                    <div className={`text-xs sm:text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>2 weeks ago</div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
        
        {/* Bottom padding to account for sticky button */}
        <div className={`h-20 ${showStickyButton ? 'block' : 'hidden'}`}></div>
      </div>
    </>
  );
}