// 📁 /lib/trackFBEvent.ts

/**
 * Utilidad para generar un event_id único compatible con Meta Pixel y CAPI.
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
  
    // 1. Meta Pixel (cliente)
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', eventName, {
        ...params,
        eventID: event_id,
      });
  
      // Track adicional si se quiere forzar un trackCustom
      if (forceRetrack) {
        window.fbq('trackCustom', eventName, {
          ...params,
          eventID: event_id,
        });
      }
    }
  
    // 2. Meta CAPI (servidor)
    fetch('/api/fb-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        event_id,
        event_source_url,
        hashed_email: email, // si existe, se incluye
        params,
      }),
    }).catch((err) => console.error(`[CAPI] Error tracking ${eventName}:`, err));
  };