// lib/services/locationDetectionService.ts - SIMPLE BULLETPROOF VERSION
import { SupportedCurrency } from './exchangeRateService';

// Mapping ONLY your supported currencies
const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // Americas
  'US': 'USD', 'USA': 'USD', 'United States': 'USD',
  'CA': 'CAD', 'CAN': 'CAD', 'Canada': 'CAD',
  'MX': 'MXN', 'MEX': 'MXN', 'Mexico': 'MXN',
  'AR': 'ARS', 'ARG': 'ARS', 'Argentina': 'ARS',
  'BR': 'BRL', 'BRA': 'BRL', 'Brazil': 'BRL',
  'CL': 'CLP', 'CHL': 'CLP', 'Chile': 'CLP',
  'PE': 'PEN', 'PER': 'PEN', 'Peru': 'PEN',
  'UY': 'UYU', 'URY': 'UYU', 'Uruguay': 'UYU',
  'CO': 'COP', 'COL': 'COP', 'Colombia': 'COP',
  
  // Europe (EUR countries + UK)
  'GB': 'GBP', 'GBR': 'GBP', 'UK': 'GBP', 'United Kingdom': 'GBP',
  'DE': 'EUR', 'DEU': 'EUR', 'Germany': 'EUR',
  'FR': 'EUR', 'FRA': 'EUR', 'France': 'EUR',
  'ES': 'EUR', 'ESP': 'EUR', 'Spain': 'EUR',
  'IT': 'EUR', 'ITA': 'EUR', 'Italy': 'EUR',
  'NL': 'EUR', 'NLD': 'EUR', 'Netherlands': 'EUR',
  'PT': 'EUR', 'PRT': 'EUR', 'Portugal': 'EUR',
  'IE': 'EUR', 'IRL': 'EUR', 'Ireland': 'EUR',
  'AT': 'EUR', 'AUT': 'EUR', 'Austria': 'EUR',
  'BE': 'EUR', 'BEL': 'EUR', 'Belgium': 'EUR',
  'FI': 'EUR', 'FIN': 'EUR', 'Finland': 'EUR',
  'GR': 'EUR', 'GRC': 'EUR', 'Greece': 'EUR',
  
  // Asia Pacific
  'AU': 'AUD', 'AUS': 'AUD', 'Australia': 'AUD',
  'NZ': 'NZD', 'NZL': 'NZD', 'New Zealand': 'NZD',
  'JP': 'JPY', 'JPN': 'JPY', 'Japan': 'JPY',
  'KR': 'KRW', 'KOR': 'KRW', 'South Korea': 'KRW',
  'CN': 'CNY', 'CHN': 'CNY', 'China': 'CNY',
  'IN': 'INR', 'IND': 'INR', 'India': 'INR',
  'SG': 'SGD', 'SGP': 'SGD', 'Singapore': 'SGD',
  'HK': 'HKD', 'HKG': 'HKD', 'Hong Kong': 'HKD',
  
  // Africa
  'ZA': 'ZAR', 'ZAF': 'ZAR', 'South Africa': 'ZAR',
  'NG': 'NGN', 'NGA': 'NGN', 'Nigeria': 'NGN',
  'EG': 'EGP', 'EGY': 'EGP', 'Egypt': 'EGP',
  'MA': 'MAD', 'MAR': 'MAD', 'Morocco': 'MAD',
};

// Timezone mapping for more accuracy
const TIMEZONE_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // Americas
  'America/New_York': 'USD', 'America/Chicago': 'USD', 'America/Denver': 'USD', 'America/Los_Angeles': 'USD',
  'America/Toronto': 'CAD', 'America/Vancouver': 'CAD',
  'America/Mexico_City': 'MXN',
  'America/Argentina/Buenos_Aires': 'ARS',
  'America/Sao_Paulo': 'BRL',
  'America/Santiago': 'CLP',
  'America/Lima': 'PEN',
  'America/Montevideo': 'UYU',
  'America/Bogota': 'COP',
  
  // Europe
  'Europe/London': 'GBP',
  'Europe/Berlin': 'EUR', 'Europe/Paris': 'EUR', 'Europe/Madrid': 'EUR', 'Europe/Rome': 'EUR',
  'Europe/Amsterdam': 'EUR', 'Europe/Lisbon': 'EUR', 'Europe/Dublin': 'EUR', 'Europe/Vienna': 'EUR',
  'Europe/Brussels': 'EUR', 'Europe/Helsinki': 'EUR', 'Europe/Athens': 'EUR',
  
  // Asia Pacific
  'Australia/Sydney': 'AUD', 'Australia/Melbourne': 'AUD', 'Australia/Perth': 'AUD',
  'Pacific/Auckland': 'NZD',
  'Asia/Tokyo': 'JPY',
  'Asia/Seoul': 'KRW',
  'Asia/Shanghai': 'CNY',
  'Asia/Kolkata': 'INR',
  'Asia/Singapore': 'SGD',
  'Asia/Hong_Kong': 'HKD',
  
  // Africa
  'Africa/Johannesburg': 'ZAR',
  'Africa/Lagos': 'NGN',
  'Africa/Cairo': 'EGP',
  'Africa/Casablanca': 'MAD',
};

interface DetectionResult {
  currency: SupportedCurrency;
  confidence: number;
  method: string;
}

class SimpleLocationDetection {
  private sessionCache: SupportedCurrency | null = null;

  /**
   * Main detection method - returns detected currency
   */
  async detectLocation(): Promise<SupportedCurrency> {
    console.log('🌍 Starting simple currency detection...');

    // Check session cache first
    if (this.sessionCache) {
      console.log(`✅ Using session cache: ${this.sessionCache}`);
      return this.sessionCache;
    }

    const detectionMethods = [
      () => this.detectFromHeaders(),
      () => this.detectFromIPServices(),
      () => this.detectFromTimezone(),
      () => this.detectFromNavigator(),
    ];

    const results: DetectionResult[] = [];

    // Try all methods with timeout
    for (const method of detectionMethods) {
      try {
        const result = await Promise.race([
          method(),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 3000)
          )
        ]);
        if (result) results.push(result);
      } catch (error) {
        console.warn('Detection method failed:', error);
      }
    }

    // Find best result
    const bestResult = this.selectBestResult(results);
    
    if (bestResult) {
      this.sessionCache = bestResult.currency;
      console.log(`🎯 Detected currency: ${bestResult.currency} (${bestResult.method}, confidence: ${bestResult.confidence})`);
      return bestResult.currency;
    }

    // Fallback to COP for your Colombian market
    console.log('⚠️ All detection failed, using COP fallback');
    this.sessionCache = 'COP';
    return 'COP';
  }

  /**
   * Detect from server headers (Cloudflare/Vercel)
   */
  private async detectFromHeaders(): Promise<DetectionResult | null> {
    try {
      // Try Cloudflare first
      const cfResponse = await fetch('/api/geo/cloudflare');
      if (cfResponse.ok) {
        const data = await cfResponse.json();
        if (data.country) {
          const currency = COUNTRY_TO_CURRENCY[data.country.toUpperCase()];
          if (currency) {
            return {
              currency,
              confidence: 0.95,
              method: 'cloudflare-headers'
            };
          }
        }
      }

      // Try Vercel
      const vercelResponse = await fetch('/api/geo/vercel');
      if (vercelResponse.ok) {
        const data = await vercelResponse.json();
        if (data.country) {
          const currency = COUNTRY_TO_CURRENCY[data.country.toUpperCase()];
          if (currency) {
            return {
              currency,
              confidence: 0.90,
              method: 'vercel-headers'
            };
          }
        }
      }
    } catch (error) {
      console.warn('Header detection failed:', error);
    }

    return null;
  }

  /**
   * Detect using IP geolocation services
   */
  private async detectFromIPServices(): Promise<DetectionResult | null> {
    const services = [
      {
        url: 'http://ip-api.com/json/?fields=countryCode',
        parser: (data: any) => data.countryCode,
        name: 'ip-api'
      },
      {
        url: 'https://ipapi.co/json/',
        parser: (data: any) => data.country_code,
        name: 'ipapi'
      }
    ];

    for (const service of services) {
      try {
        const response = await fetch(service.url);
        if (response.ok) {
          const data = await response.json();
          const countryCode = service.parser(data);
          
          if (countryCode) {
            const currency = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()];
            if (currency) {
              return {
                currency,
                confidence: 0.80,
                method: service.name
              };
            }
          }
        }
      } catch (error) {
        console.warn(`${service.name} failed:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Detect from browser timezone
   */
  private async detectFromTimezone(): Promise<DetectionResult | null> {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const currency = TIMEZONE_TO_CURRENCY[timezone];
      
      if (currency) {
        return {
          currency,
          confidence: 0.70,
          method: 'timezone'
        };
      }
    } catch (error) {
      console.warn('Timezone detection failed:', error);
    }

    return null;
  }

  /**
   * Detect from navigator language/locale
   */
  private async detectFromNavigator(): Promise<DetectionResult | null> {
    try {
      const languages = navigator.languages || [navigator.language];
      
      for (const lang of languages) {
        const parts = lang.split('-');
        if (parts.length >= 2) {
          const countryCode = parts[1].toUpperCase();
          const currency = COUNTRY_TO_CURRENCY[countryCode];
          
          if (currency) {
            return {
              currency,
              confidence: 0.50,
              method: 'navigator-language'
            };
          }
        }
      }
    } catch (error) {
      console.warn('Navigator detection failed:', error);
    }

    return null;
  }

  /**
   * Select best result from multiple detection methods
   */
  private selectBestResult(results: DetectionResult[]): DetectionResult | null {
    if (results.length === 0) return null;
    
    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);
    
    // If top result has high confidence, use it
    if (results[0].confidence >= 0.80) {
      return results[0];
    }
    
    // Check for consensus among results
    const currencyCount: Record<string, number> = {};
    results.forEach(r => {
      currencyCount[r.currency] = (currencyCount[r.currency] || 0) + 1;
    });
    
    const mostCommon = Object.entries(currencyCount)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostCommon && mostCommon[1] >= 2) {
      const consensusResult = results.find(r => r.currency === mostCommon[0]);
      if (consensusResult) {
        consensusResult.confidence = Math.min(0.95, consensusResult.confidence + 0.15);
        consensusResult.method += '+consensus';
        return consensusResult;
      }
    }
    
    return results[0];
  }

  /**
   * Force refresh detection
   */
  async refreshLocation(): Promise<SupportedCurrency> {
    this.sessionCache = null;
    return this.detectLocation();
  }

  /**
   * Get cached currency
   */
  getCachedLocation(): SupportedCurrency | null {
    return this.sessionCache;
  }
}

// Export singleton instance
export const simpleLocationDetection = new SimpleLocationDetection();

// Export main function
export async function detectUserLocation(): Promise<SupportedCurrency> {
  return simpleLocationDetection.detectLocation();
}

// Export refresh function
export async function refreshUserLocation(): Promise<SupportedCurrency> {
  return simpleLocationDetection.refreshLocation();
}