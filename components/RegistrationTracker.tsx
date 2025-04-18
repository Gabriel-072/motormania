'use client';

import { useRegistrationTracking } from '@/hooks/useRegistrationTracking';

export default function RegistrationTracker() {
  useRegistrationTracking();
  return null;
}