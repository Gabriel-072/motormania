// 📁 hooks/useAutoRedeem.ts
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState }        from 'react';
import { useUser }                    from '@clerk/nextjs';
import { toast }                      from 'sonner';

type Opts = {
  onSuccess?: (msg: string) => void;
  onError?  : (err: string) => void;
};

/**
 * Captura ?code=ABC123 en la URL.
 *  – Si el user está logueado ⇒ lo canjea y muestra toast.
 *  – Si NO está logueado ⇒ redirige a /sign-up manteniendo el parámetro.
 *  – Borra el parámetro tras procesar.
 *
 * Además, tras un canje exitoso hace router.refresh() para que
 * los datos de la Wallet se actualicen sin recargar toda la app.
 */
export default function useAutoRedeem(opts: Opts = {}) {
  const { isSignedIn } = useUser();
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const [done, setDone] = useState(false);

  /* helpers con fall-backs a toast */
  const handleOk  = (m: string) => opts.onSuccess ? opts.onSuccess(m) : toast.success(m);
  const handleErr = (e: string) => opts.onError   ? opts.onError(e)   : toast.error(e);

  useEffect(() => {
    if (done) return;

    const code = searchParams.get('code')?.trim().toUpperCase() ?? '';
    if (!code) return;                        // no parámetro → nada que hacer

    if (!isSignedIn) {
      // no logueado → al sign-up de Clerk con redirect de vuelta
      router.replace(
        `/sign-up?redirect_url=${encodeURIComponent(`/wallet?code=${code}`)}`
      );
      setDone(true);
      return;
    }

    // user logueado ⇒ intentar canje
    (async () => {
      try {
        const res = await fetch('/api/promocodes/redeem', {
          method : 'POST',
          headers: { 'Content-Type':'application/json' },
          body   : JSON.stringify({ code })
        });
        const j = await res.json();
        if (res.ok) {
          handleOk(j.message ?? 'Código aplicado');
          router.refresh();                  // <- fuerza refetch de datos wallet
        } else {
          handleErr(j.error ?? 'No se pudo aplicar el código');
        }
      } catch {
        handleErr('Error conectando con el servidor');
      } finally {
        // quita ?code=... de la URL sin recargar completa
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        router.replace(url.pathname + url.search);
        setDone(true);
      }
    })();
  }, [isSignedIn, searchParams, router, done]);
}