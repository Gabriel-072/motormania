// 📁 lib/services/locationDetectionService.ts
import { SupportedCurrency } from './exchangeRateService';

// Mapping of countries/regions to currencies
const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // Americas
  'US': 'USD', 'United States': 'USD',
  'CA': 'CAD', 'Canada': 'CAD',
  'MX': 'MXN', 'Mexico': 'MXN',
  'AR': 'ARS', 'Argentina': 'ARS',
  'BR': 'BRL', 'Brazil': 'BRL',
  'CL': 'CLP', 'Chile': 'CLP',
  'PE': 'PEN', 'Peru': 'PEN',
  'UY': 'UYU', 'Uruguay': 'UYU',
  'CO': 'COP', 'Colombia': 'COP',
  
  // Europe
  'GB': 'GBP', 'UK': 'GBP', 'United Kingdom': 'GBP',
  'DE': 'EUR', 'Germany': 'EUR',
  'FR': 'EUR', 'France': 'EUR',
  'ES': 'EUR', 'Spain': 'EUR',
  'IT': 'EUR', 'Italy': 'EUR',
  'NL': 'EUR', 'Netherlands': 'EUR',
  'PT': 'EUR', 'Portugal': 'EUR',
  'IE': 'EUR', 'Ireland': 'EUR',
  'AT': 'EUR', 'Austria': 'EUR',
  'BE': 'EUR', 'Belgium': 'EUR',
  'FI': 'EUR', 'Finland': 'EUR',
  'GR': 'EUR', 'Greece': 'EUR',
  
  // Asia Pacific
  'AU': 'AUD', 'Australia': 'AUD',
  'NZ': 'NZD', 'New Zealand': 'NZD',
  'JP': 'JPY', 'Japan': 'JPY',
  'KR': 'KRW', 'South Korea': 'KRW',
  'CN': 'CNY', 'China': 'CNY',
  'IN': 'INR', 'India': 'INR',
  'SG': 'SGD', 'Singapore': 'SGD',
  'HK': 'HKD', 'Hong Kong': 'HKD',
  
  // Africa
  'ZA': 'ZAR', 'South Africa': 'ZAR',
  'NG': 'NGN', 'Nigeria': 'NGN',
  'EG': 'EGP', 'Egypt': 'EGP',
  'MA': 'MAD', 'Morocco': 'MAD',
};

// Timezone to currency mapping for more precise detection
const TIMEZONE_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // Americas
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'America/Mexico_City': 'MXN',
  'America/Argentina/Buenos_Aires': 'ARS',
  'America/Sao_Paulo': 'BRL',
  'America/Santiago': 'CLP',
  'America/Lima': 'PEN',
  'America/Montevideo': 'UYU',
  'America/Bogota': 'COP',
  
  // Europe
  'Europe/London': 'GBP',
  'Europe/Berlin': 'EUR',
  'Europe/Paris': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Amsterdam': 'EUR',
  'Europe/Lisbon': 'EUR',
  'Europe/Dublin': 'EUR',
  'Europe/Vienna': 'EUR',
  'Europe/Brussels': 'EUR',
  'Europe/Helsinki': 'EUR',
  'Europe/Athens': 'EUR',
  
  // Asia Pacific
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Perth': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Australia/Adelaide': 'AUD',
  'Australia/Darwin': 'AUD',
  'Australia/Hobart': 'AUD',
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

interface LocationInfo {
  currency: SupportedCurrency;
  country: string | null;
  timezone: string | null;
  locale: string | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'timezone' | 'locale' | 'ip' | 'fallback';
}

class LocationDetectionService {
  // Detect currency from browser timezone
  private detectFromTimezone(): { currency: SupportedCurrency; confidence: 'high' | 'medium' } | null {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const currency = TIMEZONE_TO_CURRENCY[timezone];
      
      if (currency) {
        console.log(`🌍 Currency detected from timezone ${timezone}: ${currency}`);
        return { currency, confidence: 'high' };
      }
      
      // Try partial timezone matching for regions we might have missed
      for (const [tz, curr] of Object.entries(TIMEZONE_TO_CURRENCY)) {
        if (timezone.includes(tz.split('/')[0]) || timezone.includes(tz.split('/')[1])) {
          console.log(`🌍 Currency detected from partial timezone match ${timezone} -> ${tz}: ${curr}`);
          return { currency: curr, confidence: 'medium' };
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to detect timezone:', error);
      return null;
    }
  }

  // Detect currency from browser locale
  private detectFromLocale(): { currency: SupportedCurrency; confidence: 'medium' } | null {
    try {
      const locale = navigator.language || navigator.languages?.[0];
      if (!locale) return null;

      // Extract country code from locale (e.g., 'en-US' -> 'US')
      const parts = locale.split('-');
      if (parts.length >= 2) {
        const countryCode = parts[1].toUpperCase();
        const currency = COUNTRY_TO_CURRENCY[countryCode];
        
        if (currency) {
          console.log(`🌍 Currency detected from locale ${locale}: ${currency}`);
          return { currency, confidence: 'medium' };
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to detect locale:', error);
      return null;
    }
  }

  // Detect currency using IP-based geolocation (optional, requires external service)
  private async detectFromIP(): Promise<{ currency: SupportedCurrency; country: string; confidence: 'high' } | null> {
    try {
      // Using a free IP geolocation service
      const response = await fetch('https://ipapi.co/json/', {
        timeout: 5000, // 5 second timeout
      } as any);
      
      if (!response.ok) throw new Error('IP geolocation failed');
      
      const data = await response.json();
      const countryCode = data.country_code?.toUpperCase();
      const countryName = data.country_name;
      
      if (countryCode) {
        const currency = COUNTRY_TO_CURRENCY[countryCode] || COUNTRY_TO_CURRENCY[countryName];
        
        if (currency) {
          console.log(`🌍 Currency detected from IP geolocation ${countryName} (${countryCode}): ${currency}`);
          return { currency, country: countryName, confidence: 'high' };
        }
      }
      
      return null;
    } catch (error) {
      console.warn('IP geolocation failed:', error);
      return null;
    }
  }

  // Main detection method that tries multiple sources
  async detectUserCurrency(): Promise<LocationInfo> {
    console.log('🔍 Starting automatic currency detection...');
    
    // Try timezone detection first (most reliable)
    const timezoneResult = this.detectFromTimezone();
    if (timezoneResult) {
      return {
        currency: timezoneResult.currency,
        country: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        confidence: timezoneResult.confidence,
        source: 'timezone',
      };
    }

    // Try locale detection
    const localeResult = this.detectFromLocale();
    if (localeResult) {
      return {
        currency: localeResult.currency,
        country: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        confidence: localeResult.confidence,
        source: 'locale',
      };
    }

    // Try IP geolocation (slower, but more accurate)
    try {
      const ipResult = await this.detectFromIP();
      if (ipResult) {
        return {
          currency: ipResult.currency,
          country: ipResult.country,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
          confidence: ipResult.confidence,
          source: 'ip',
        };
      }
    } catch (error) {
      console.warn('IP detection failed, using fallback');
    }

    // Fallback to USD
    console.log('🌍 Using fallback currency: USD');
    return {
      currency: 'USD',
      country: null,
      timezone: null,
      locale: null,
      confidence: 'low',
      source: 'fallback',
    };
  }

  // Quick detection without IP lookup (for faster initial load)
  detectUserCurrencyQuick(): LocationInfo {
    console.log('⚡ Quick currency detection (no IP lookup)...');
    
    // Try timezone first
    const timezoneResult = this.detectFromTimezone();
    if (timezoneResult) {
      return {
        currency: timezoneResult.currency,
        country: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        confidence: timezoneResult.confidence,
        source: 'timezone',
      };
    }

    // Try locale
    const localeResult = this.detectFromLocale();
    if (localeResult) {
      return {
        currency: localeResult.currency,
        country: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        confidence: localeResult.confidence,
        source: 'locale',
      };
    }

    // Fallback to USD
    return {
      currency: 'USD',
      country: null,
      timezone: null,
      locale: null,
      confidence: 'low',
      source: 'fallback',
    };
  }
}

// Export singleton instance
export const locationDetectionService = new LocationDetectionService();
export type { LocationInfo };