// 📁 lib/utmTracker.ts
export function trackUTMParameters() {
    if (typeof window === 'undefined') return;
  
    const urlParams = new URLSearchParams(window.location.search);
    const utmData = {
      utm_source: urlParams.get('utm_source'),
      utm_medium: urlParams.get('utm_medium'),
      utm_campaign: urlParams.get('utm_campaign'),
      utm_term: urlParams.get('utm_term'),
      utm_content: urlParams.get('utm_content'),
      referrer: document.referrer,
      page_url: window.location.href,
      session_id: getOrCreateSessionId()
    };
  
    // Only track if we have UTM data or referrer
    if (utmData.utm_source || utmData.referrer) {
      fetch('/api/track-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(utmData)
      }).catch(console.warn);
    }
  }
  
  function getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem('mmc_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      localStorage.setItem('mmc_session_id', sessionId);
    }
    return sessionId;
  }