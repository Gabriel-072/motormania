// 📁 /lib/trackFBEvent.ts
export const trackFBEvent = (eventName: string, params: Record<string, any> = {}) => {
    const eventId = `evt_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', eventName, {
        ...params,
        eventID: eventId,
      });
    }
  
    fetch('/api/fb-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        params,
        event_source_url: window.location.href,
      }),
    });
  };