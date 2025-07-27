// 📁 components/UTMTracker.tsx
'use client';

import { useEffect } from 'react';
import { trackUTMParameters } from '@/lib/utmTracker';

export default function UTMTracker() {
  useEffect(() => {
    trackUTMParameters();
  }, []);

  return null; // This component doesn't render anything
}