// 📁 lib/services/locationDetectionService.ts - FIXED VERSION
import { SupportedCurrency } from './exchangeRateService';

// Enhanced mapping with more timezone variations
const TIMEZONE_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // Americas - Enhanced with more variations
  'America/New_York': 'USD', 'America/Chicago': 'USD', 'America/Denver': 'USD', 'America/Los_Angeles': 'USD',
  'America/Phoenix': 'USD', 'America/Detroit': 'USD', 'America/Indiana/Indianapolis': 'USD',
  'America/Toronto': 'CAD', 'America/Vancouver': 'CAD', 'America/Montreal': 'CAD', 'America/Edmonton': 'CAD',
  'America/Mexico_City': 'MXN', 'America/Cancun': 'MXN', 'America/Merida': 'MXN', 'America/Monterrey': 'MXN',
  'America/Mazatlan': 'MXN', 'America/Chihuahua': 'MXN', 'America/Hermosillo': 'MXN', 'America/Tijuana': 'MXN',
  'America/Argentina/Buenos_Aires': 'ARS', 'America/Argentina/Cordoba': 'ARS', 'America/Argentina/Mendoza': 'ARS',
  'America/Sao_Paulo': 'BRL', 'America/Fortaleza': 'BRL', 'America/Recife': 'BRL', 'America/Manaus': 'BRL',
  'America/Santiago': 'CLP', 'America/Lima': 'PEN', 'America/Montevideo': 'UYU', 'America/Bogota': 'COP',
  
  // Europe
  'Europe/London': 'GBP', 'Europe/Dublin': 'EUR', 'Europe/Paris': 'EUR', 'Europe/Berlin': 'EUR',
  'Europe/Madrid': 'EUR', 'Europe/Rome': 'EUR', 'Europe/Amsterdam': 'EUR', 'Europe/Brussels': 'EUR',
  'Europe/Vienna': 'EUR', 'Europe/Zurich': 'EUR', 'Europe/Stockholm': 'EUR', 'Europe/Helsinki': 'EUR',
  
  // Asia Pacific  
  'Australia/Sydney': 'AUD', 'Australia/Melbourne': 'AUD', 'Australia/Perth': 'AUD', 'Australia/Brisbane': 'AUD',
  'Australia/Adelaide': 'AUD', 'Australia/Darwin': 'AUD', 'Australia/Hobart': 'AUD',
  'Pacific/Auckland': 'NZD', 'Asia/Tokyo': 'JPY', 'Asia/Seoul': 'KRW', 'Asia/Shanghai': 'CNY',
  'Asia/Hong_Kong': 'HKD', 'Asia/Singapore': 'SGD', 'Asia/Kolkata': 'INR', 'Asia/Mumbai': 'INR',
  
  // Africa
  'Africa/Johannesburg': 'ZAR', 'Africa/Cape_Town': 'ZAR', 'Africa/Lagos': 'NGN', 'Africa/Cairo': 'EGP'
};

const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // Americas
  'US': 'USD', 'United States': 'USD', 'USA': 'USD',
  'CA': 'CAD', 'Canada': 'CAD',
  'MX': 'MXN', 'Mexico': 'MXN', 'México': 'MXN',
  'AR': 'ARS', 'Argentina': 'ARS',
  'BR': 'BRL', 'Brazil': 'BRL', 'Brasil': 'BRL',
  'CL': 'CLP', 'Chile': 'CLP',
  'PE': 'PEN', 'Peru': 'PEN', 'Perú': 'PEN',
  'UY': 'UYU', 'Uruguay': 'UYU',
  'CO': 'COP', 'Colombia': 'COP',
  
  // Europe
  'GB': 'GBP', 'UK': 'GBP', 'United Kingdom': 'GBP',
  'DE': 'EUR', 'Germany': 'EUR', 'Deutschland': 'EUR',
  'FR': 'EUR', 'France': 'EUR', 'España': 'EUR',
  'ES': 'EUR', 'Spain': 'EUR', 'IT': 'EUR', 'Italy': 'EUR',
  'NL': 'EUR', 'Netherlands': 'EUR', 'PT': 'EUR', 'Portugal': 'EUR',
  'IE': 'EUR', 'Ireland': 'EUR', 'AT': 'EUR', 'Austria': 'EUR',
  
  // Asia Pacific
  'AU': 'AUD', 'Australia': 'AUD', 'NZ': 'NZD', 'New Zealand': 'NZD',
  'JP': 'JPY', 'Japan': 'JPY', 'KR': 'KRW', 'South Korea': 'KRW',
  'CN': 'CNY', 'China': 'CNY', 'IN': 'INR', 'India': 'INR',
  'SG': 'SGD', 'Singapore': 'SGD', 'HK': 'HKD', 'Hong Kong': 'HKD',
  
  // Africa
  'ZA': 'ZAR', 'South Africa': 'ZAR', 'NG': 'NGN', 'Nigeria': 'NGN'
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
  private detectFromTimezone(): { currency: SupportedCurrency; confidence: 'high' | 'medium' } | null {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`🌍 Detecting from timezone: ${timezone}`);
      
      // Direct match
      const directMatch = TIMEZONE_TO_CURRENCY[timezone];
      if (directMatch) {
        console.log(`✅ Direct timezone match: ${timezone} → ${directMatch}`);
        return { currency: directMatch, confidence: 'high' };
      }
      
      // Partial matching for missing timezones
      for (const [tz, currency] of Object.entries(TIMEZONE_TO_CURRENCY)) {
        const tzParts = tz.split('/');
        const userTzParts = timezone.split('/');
        
        // Match continent and city
        if (tzParts.length >= 2 && userTzParts.length >= 2) {
          if (tzParts[0] === userTzParts[0] && tzParts[1] === userTzParts[1]) {
            console.log(`✅ Partial timezone match: ${timezone} → ${tz} → ${currency}`);
            return { currency, confidence: 'medium' };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn('❌ Timezone detection failed:', error);
      return null;
    }
  }

  private detectFromLocale(): { currency: SupportedCurrency; confidence: 'medium' } | null {
    try {
      const locales = navigator.languages || [navigator.language];
      console.log(`🌍 Detecting from locales:`, locales);
      
      for (const locale of locales) {
        // Extract country from locale (e.g., 'en-US' → 'US', 'es-MX' → 'MX')
        const parts = locale.split('-');
        if (parts.length >= 2) {
          const countryCode = parts[1].toUpperCase();
          const currency = COUNTRY_TO_CURRENCY[countryCode];
          
          if (currency) {
            console.log(`✅ Locale match: ${locale} → ${countryCode} → ${currency}`);
            return { currency, confidence: 'medium' };
          }
        }
        
        // Check for specific locale patterns
        if (locale.includes('mx') || locale.includes('MX')) {
          console.log(`✅ Mexico locale pattern: ${locale} → MXN`);
          return { currency: 'MXN', confidence: 'medium' };
        }
      }
      
      return null;
    } catch (error) {
      console.warn('❌ Locale detection failed:', error);
      return null;
    }
  }

  private async detectFromIP(): Promise<{ currency: SupportedCurrency; country: string; confidence: 'high' } | null> {
    try {
      console.log('🌍 Attempting IP geolocation...');
      const response = await fetch('https://ipapi.co/json/', { 
        signal: AbortSignal.timeout(5000) 
      });
      
      if (!response.ok) throw new Error('IP API failed');
      
      const data = await response.json();
      const countryCode = data.country_code?.toUpperCase();
      const countryName = data.country_name;
      
      console.log(`🌍 IP detection result:`, { countryCode, countryName });
      
      if (countryCode && COUNTRY_TO_CURRENCY[countryCode]) {
        const currency = COUNTRY_TO_CURRENCY[countryCode];
        console.log(`✅ IP match: ${countryName} (${countryCode}) → ${currency}`);
        return { currency, country: countryName, confidence: 'high' };
      }
      
      return null;
    } catch (error) {
      console.warn('❌ IP geolocation failed:', error);
      return null;
    }
  }

  async detectUserCurrency(): Promise<LocationInfo> {
    console.log('🔍 Starting comprehensive currency detection...');
    
    // Try timezone detection first
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

    // Try IP geolocation
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
      console.warn('❌ IP detection failed');
    }

    // Fallback
    console.log('🌍 All detection methods failed, using USD fallback');
    return {
      currency: 'USD',
      country: null,
      timezone: null,
      locale: null,
      confidence: 'low',
      source: 'fallback',
    };
  }

  detectUserCurrencyQuick(): LocationInfo {
    console.log('⚡ Quick currency detection...');
    
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

    // Fallback
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

export const locationDetectionService = new LocationDetectionService();
export type { LocationInfo };