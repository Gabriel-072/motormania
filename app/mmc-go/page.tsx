// 📁 app/mmc-go/page.tsx
'use client';

import dynamic from 'next/dynamic';
import Script from 'next/script';
import LoadingAnimation from '@/components/LoadingAnimation';

const MMCGoContent = dynamic(
  () => import('@/components/MMCGoContent'),
  {
    ssr: false,
    loading: () => (
      <LoadingAnimation text="Cargando MMC-GO…" animationDuration={3} />
    ),
  }
);

export default function MMCGoPage() {
  return (
    <>
      <MMCGoContent />

      {/* Tawk.to solo en MMC GO */}
      <Script id="tawk-widget-mmcgo" strategy="afterInteractive">
        {`
          var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
          (function(){
            var s1=document.createElement("script"), s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='https://embed.tawk.to/68268afe9ff758190ef1751a/1irbg7ade';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
          })();
        `}
      </Script>
    </>
  );
}