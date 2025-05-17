// 📁 components/HotjarInit.tsx
'use client';

import { useEffect } from 'react';
import Hotjar from '@hotjar/browser';
import { useUser } from '@clerk/nextjs';   // opcional, para identify()
import { usePathname } from 'next/navigation';

const siteId = 6406849;      // tu ID
const hotjarVersion = 6;     // siempre es 6

export default function HotjarInit() {
  const pathname = usePathname();
  const { user } = useUser();   // opcional

  // 1️⃣ Init una sola vez (solo en navegador)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    Hotjar.init(siteId, hotjarVersion, {
      debug: process.env.NODE_ENV !== 'production', // quita logs en prod
    });
  }, []);

  // 2️⃣ Avísale a Hotjar cada vez que cambie la ruta (SPA tracking)
  useEffect(() => {
    Hotjar.stateChange(pathname);
  }, [pathname]);

  // 3️⃣ (OPCIONAL) Identifica al usuario logueado para grabar sesiones con email/ID
  useEffect(() => {
    if (user) {
      Hotjar.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
      });
    }
  }, [user]);

  return null; // no renderiza nada en pantalla
}