// 📁 lib/utmTracker.ts
export interface UTMData {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
    referrer: string;
    page_url: string;
    session_id: string;
  }
  
  const UTM_STORAGE_KEY = 'mmc_utm_data';
  const SESSION_STORAGE_KEY = 'mmc_session_id';
  
  export function trackUTMParameters() {
    if (typeof window === 'undefined') return;
  
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = getOrCreateSessionId();
    
    const utmData: UTMData = {
      utm_source: urlParams.get('utm_source'),
      utm_medium: urlParams.get('utm_medium'),
      utm_campaign: urlParams.get('utm_campaign'),
      utm_term: urlParams.get('utm_term'),
      utm_content: urlParams.get('utm_content'),
      referrer: document.referrer,
      page_url: window.location.href,
      session_id: sessionId
    };
  
    // Store UTM data for the entire session (will be used during purchase)
    if (hasUTMData(utmData)) {
      localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmData));
      console.log('🎯 UTM data stored for purchase tracking:', utmData);
    }
  
    // Track the visit (existing functionality)
    if (utmData.utm_source || utmData.referrer) {
      fetch('/api/track-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(utmData)
      }).catch(console.warn);
    }
  }
  
  export function getStoredUTMData(): UTMData | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(UTM_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
  
  export function clearStoredUTMData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(UTM_STORAGE_KEY);
  }
  
  function hasUTMData(data: UTMData): boolean {
    return !!(data.utm_source || data.utm_medium || data.utm_campaign || data.utm_term || data.utm_content);
  }
  
  function getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return `session_${Date.now()}`;
    
    let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  }