// ============================================================================
// 2. UPDATED /components/PixelTracker.tsx - Enhanced version
// ============================================================================

'use client';
import Script from 'next/script';

export default function PixelTracker() {
  return (
    <>
      {/* Meta Pixel Code - Enhanced */}
      <Script 
        id="fb-pixel-init" 
        strategy="afterInteractive"
        onLoad={() => {
          console.log('✅ Facebook Pixel loaded successfully');
        }}
        onError={(e) => {
          console.error('❌ Facebook Pixel failed to load:', e);
        }}
      >
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod ?
          n.callMethod.apply(n,arguments) : n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          
          if (!window.fbq.initialized) {
            fbq('init', '1232963721021743');
            fbq('track', 'PageView');
            window.fbq.initialized = true;
            console.log('🎯 Facebook Pixel initialized with ID: 1232963721021743');
          }
        `}
      </Script>
      
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src="https://www.facebook.com/tr?id=1232963721021743&ev=PageView&noscript=1"
        />
      </noscript>
    </>
  );
}
