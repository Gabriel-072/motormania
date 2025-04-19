'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import FantasyPageContent from '@/components/FantasyPageContent';
import FantasyAuthRequiredModalWrapper from '@/components/FantasyAuthRequiredModalWrapper';
import LoadingAnimation from '@/components/LoadingAnimation';

export default function JugarYGanaPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setShowModal(true);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return <LoadingAnimation animationDuration={2} />;

  return (
    <>
      {isSignedIn ? <FantasyPageContent /> : <FantasyAuthRequiredModalWrapper show={showModal} />}
    </>
  );
}