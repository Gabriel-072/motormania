// ============================================================================
// 1. UPDATED /lib/trackFBEvent.ts - Enhanced version
// ============================================================================

/**
 * Utilidad para generar un eventid único compatible con Meta Pixel y CAPI.
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Envía un evento a Meta Pixel y Conversions API con soporte para deduplicación.
 */
export const trackFBEvent = (
  eventName: string,
  options: {
    params?: Record<string, any>;
    event_id?: string;
    event_source_url?: string;
    email?: string;
    forceRetrack?: boolean;
  } = {}
) => {
  const {
    params = {},
    event_id = generateEventId(),
    event_source_url = typeof window !== 'undefined' ? window.location.href : '',
    email,
    forceRetrack = false,
  } = options;

  // Debug logging for custom events
  if (eventName.startsWith('VIP_')) {
    console.log(`🎯 Tracking VIP Event: ${eventName}`, {
      event_id,
      params,
      timestamp: new Date().toISOString()
    });
  }

  // 1. Meta Pixel (cliente)
  if (typeof window !== 'undefined' && window.fbq) {
    // For standard Facebook events
    const standardEvents = [
      'PageView', 'ViewContent', 'Lead', 'InitiateCheckout', 
      'Purchase', 'CompleteRegistration', 'Subscribe', 'AddPaymentInfo'
    ];

    if (standardEvents.includes(eventName)) {
      // Use standard track for Facebook standard events
      window.fbq('track', eventName, {
        ...params,
        eventID: event_id,
      });
    } else {
      // Use trackCustom for our custom VIP events
      window.fbq('trackCustom', eventName, {
        ...params,
        eventID: event_id,
      });
    }

    // Debug: verify fbq is working
    console.log(`📊 Facebook Pixel: ${eventName} sent with ID: ${event_id}`);
  } else {
    console.warn('❌ Facebook Pixel not loaded or fbq not available');
  }

  // 2. Meta CAPI (servidor) - Enhanced with better error handling
  fetch('/api/fb-track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      event_id,
      event_source_url,
      user_data: {
        em: email ? btoa(email.toLowerCase().trim()) : undefined,
        client_user_agent: navigator.userAgent,
        fbc: getCookie('_fbc'),
        fbp: getCookie('_fbp')
      },
      custom_data: params,
    }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`CAPI failed: ${response.status}`);
    }
    console.log(`✅ CAPI: ${eventName} sent successfully`);
    return response.json();
  })
  .catch((err) => {
    console.error(`❌ [CAPI] Error tracking ${eventName}:`, err);
  });
};

// Helper function to get cookies
const getCookie = (name: string) => {
  if (typeof window === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};