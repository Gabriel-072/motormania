'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState }        from 'react';
import { useUser }                    from '@clerk/nextjs';
import { toast }                      from 'sonner';

export default function useAutoRedeem() {
  const { isSignedIn, isLoaded } = useUser();           // ← isLoaded evita parpadeos
  const searchParams             = useSearchParams();
  const router                   = useRouter();
  const [done, setDone]          = useState(false);

  useEffect(() => {
    if (done || !isLoaded) return;                      // espera a Clerk

    const code = searchParams.get('code')?.trim().toUpperCase();
    if (!code) return;

    if (!isSignedIn) {                                 // no logueado → sign-up
      router.replace(`/sign-up?redirect_url=/wallet?code=${code}`);
      setDone(true);
      return;
    }

    // logueado → canjear
    (async () => {
      try {
        const res = await fetch('/api/promocodes/redeem', {
          method : 'POST',
          headers: { 'Content-Type':'application/json' },
          body   : JSON.stringify({ code })
        });
        const j = await res.json();
        res.ok ? toast.success(j.message ?? 'Código aplicado')
               : toast.error   (j.error   ?? 'No se pudo aplicar el código');
      } catch {
        toast.error('Error conectando con el servidor');
      } finally {
        // quita ?code=... de la URL sin recargar
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        router.replace(url.pathname + url.search);
        setDone(true);
      }
    })();
  }, [done, isLoaded, isSignedIn, searchParams, router]);
}