// 📁 hooks/useAutoRedeem.ts  — versión completa
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState }        from 'react';
import { useUser }                    from '@clerk/nextjs';
import { toast }                      from 'sonner';

type Opts = {
  onSuccess?: (msg: string) => void;
  onError?  : (err: string) => void;
};

export default function useAutoRedeem(opts: Opts = {}) {
  const { isSignedIn } = useUser();
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const [done, setDone] = useState(false);

  const ok  = (m:string)=> opts.onSuccess ? opts.onSuccess(m) : toast.success(m);
  const err = (e:string)=> opts.onError   ? opts.onError(e)   : toast.error(e);

  useEffect(() => {
    if (done) return;

    const code = searchParams.get('code')?.trim().toUpperCase() ?? '';
    if (!code) return;

    if (!isSignedIn) {
      router.replace(`/sign-up?redirect_url=${encodeURIComponent(`/wallet?code=${code}`)}`);
      setDone(true);
      return;
    }

    (async () => {
      try {
        const r = await fetch('/api/promocodes/redeem', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ code })
        });
        const j = await r.json();
        if (r.ok) {
          ok(j.message ?? 'Código aplicado');
          window.dispatchEvent(new Event('promo-redeemed'));   // ⭐️
          router.refresh();
        } else {
          err(j.error ?? 'No se pudo aplicar el código');
        }
      } catch { err('Error conectando con el servidor'); }
      finally {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        router.replace(url.pathname + url.search);
        setDone(true);
      }
    })();
  }, [isSignedIn, searchParams, router, done]);
}