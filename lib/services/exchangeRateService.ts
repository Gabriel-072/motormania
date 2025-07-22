// 📁 lib/services/exchangeRateService.ts
export type SupportedCurrency = 
  | 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'NZD'
  | 'MXN' | 'ARS' | 'BRL' | 'CLP' | 'PEN' | 'UYU'
  | 'JPY' | 'KRW' | 'CNY' | 'INR' | 'SGD' | 'HKD'
  | 'ZAR' | 'NGN' | 'EGP' | 'MAD' | 'COP';

export interface ExchangeRates {
  base: 'COP';
  rates: Record<SupportedCurrency, number>;
  lastUpdated: string;
  source: 'api' | 'fallback';
}

const API_KEY = 'b53b1065b411e6de0bc28a63';
const API_BASE_URL = 'https://v6.exchangerate-api.com/v6';
const CACHE_KEY = 'mmc_exchange_rates';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Fallback rates based on 5 USD = 20,000 COP (1 USD = 4,000 COP)
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  COP: 1,
  USD: 0.00025,    // 1 COP = 0.00025 USD (4,000 COP = 1 USD)
  EUR: 0.00023,    // ~4,350 COP = 1 EUR
  GBP: 0.0002,     // ~5,000 COP = 1 GBP
  CAD: 0.00034,    // ~2,940 COP = 1 CAD
  AUD: 0.00038,    // ~2,630 COP = 1 AUD
  NZD: 0.00041,    // ~2,440 COP = 1 NZD
  MXN: 0.0043,     // ~232 COP = 1 MXN
  ARS: 0.24,       // ~4.17 COP = 1 ARS
  BRL: 0.0015,     // ~667 COP = 1 BRL
  CLP: 0.92,       // ~1.09 COP = 1 CLP
  PEN: 0.00095,    // ~1,053 COP = 1 PEN
  UYU: 0.01,       // ~100 COP = 1 UYU
  JPY: 0.037,      // ~27 COP = 1 JPY
  KRW: 0.33,       // ~3 COP = 1 KRW
  CNY: 0.0018,     // ~556 COP = 1 CNY
  INR: 0.021,      // ~48 COP = 1 INR
  SGD: 0.00034,    // ~2,941 COP = 1 SGD
  HKD: 0.00195,    // ~513 COP = 1 HKD
  ZAR: 0.0045,     // ~222 COP = 1 ZAR
  NGN: 0.39,       // ~2.56 COP = 1 NGN
  EGP: 0.012,      // ~83 COP = 1 EGP
  MAD: 0.0025,     // ~400 COP = 1 MAD
};

class ExchangeRateService {
  private cachedRates: ExchangeRates | null = null;

  // Load cached rates from localStorage
  private loadCachedRates(): ExchangeRates | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const age = Date.now() - new Date(data.lastUpdated).getTime();
      
      if (age > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  }

  // Save rates to localStorage
  private saveCachedRates(rates: ExchangeRates): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
    } catch (error) {
      console.warn('Failed to cache exchange rates:', error);
    }
  }

  // Fetch rates from API
  private async fetchRatesFromAPI(): Promise<ExchangeRates> {
    try {
      console.log('🌍 Fetching fresh exchange rates from API...');
      
      const response = await fetch(
        `${API_BASE_URL}/${API_KEY}/latest/COP`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();

      if (data.result !== 'success') {
        throw new Error(`API error: ${data['error-type'] || 'Unknown error'}`);
      }

      // The API gives us rates FROM COP TO other currencies
      const apiRates = data.conversion_rates;
      
      // Filter to only supported currencies
      const filteredRates: Record<SupportedCurrency, number> = {} as any;
      
      Object.keys(FALLBACK_RATES).forEach(currency => {
        const curr = currency as SupportedCurrency;
        if (apiRates[curr] !== undefined) {
          filteredRates[curr] = apiRates[curr];
        } else {
          // Use fallback for unsupported currencies
          filteredRates[curr] = FALLBACK_RATES[curr];
        }
      });

      const exchangeRates: ExchangeRates = {
        base: 'COP',
        rates: filteredRates,
        lastUpdated: new Date().toISOString(),
        source: 'api'
      };

      console.log('✅ Exchange rates fetched successfully');
      return exchangeRates;

    } catch (error) {
      console.error('❌ Failed to fetch exchange rates from API:', error);
      throw error;
    }
  }

  // Get fallback rates
  private getFallbackRates(): ExchangeRates {
    console.log('⚠️ Using fallback exchange rates');
    return {
      base: 'COP',
      rates: FALLBACK_RATES,
      lastUpdated: new Date().toISOString(),
      source: 'fallback'
    };
  }

  // Main method to get current rates
  async getCurrentRates(): Promise<ExchangeRates> {
    // Check cache first
    const cached = this.loadCachedRates();
    if (cached) {
      console.log('📦 Using cached exchange rates');
      this.cachedRates = cached;
      return cached;
    }

    try {
      // Try to fetch from API
      const freshRates = await this.fetchRatesFromAPI();
      this.cachedRates = freshRates;
      this.saveCachedRates(freshRates);
      return freshRates;
    } catch (error) {
      // Fallback to hardcoded rates
      const fallbackRates = this.getFallbackRates();
      this.cachedRates = fallbackRates;
      return fallbackRates;
    }
  }

  // Convert COP to target currency
  convertFromCOP(copAmount: number, targetCurrency: SupportedCurrency): number {
    if (!this.cachedRates) {
      // Use fallback rate if no rates are loaded
      return copAmount * FALLBACK_RATES[targetCurrency];
    }

    const rate = this.cachedRates.rates[targetCurrency];
    return copAmount * rate;
  }

  // Convert from any currency back to COP
  convertToCOP(amount: number, fromCurrency: SupportedCurrency): number {
    if (!this.cachedRates) {
      // Use fallback rate if no rates are loaded
      return Math.round(amount / FALLBACK_RATES[fromCurrency]);
    }

    const rate = this.cachedRates.rates[fromCurrency];
    return Math.round(amount / rate);
  }

  // Get current rates info
  getRatesInfo(): { lastUpdated: string; source: string } | null {
    if (!this.cachedRates) return null;
    
    return {
      lastUpdated: this.cachedRates.lastUpdated,
      source: this.cachedRates.source
    };
  }

  // Force refresh rates
  async refreshRates(): Promise<ExchangeRates> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
    }
    return this.getCurrentRates();
  }
}

// Export singleton instance
export const exchangeRateService = new ExchangeRateService();

// Currency metadata
export const CURRENCY_INFO: Record<SupportedCurrency, {
  name: string;
  symbol: string;
  code: string;
  flag: string;
  decimals: number;
}> = {
  COP: { name: 'Colombian Peso', symbol: '$', code: 'COP', flag: '🇨🇴', decimals: 0 },
  USD: { name: 'US Dollar', symbol: '$', code: 'USD', flag: '🇺🇸', decimals: 2 },
  EUR: { name: 'Euro', symbol: '€', code: 'EUR', flag: '🇪🇺', decimals: 2 },
  GBP: { name: 'British Pound', symbol: '£', code: 'GBP', flag: '🇬🇧', decimals: 2 },
  CAD: { name: 'Canadian Dollar', symbol: '$', code: 'CAD', flag: '🇨🇦', decimals: 2 },
  AUD: { name: 'Australian Dollar', symbol: '$', code: 'AUD', flag: '🇦🇺', decimals: 2 },
  NZD: { name: 'New Zealand Dollar', symbol: '$', code: 'NZD', flag: '🇳🇿', decimals: 2 },
  MXN: { name: 'Mexican Peso', symbol: '$', code: 'MXN', flag: '🇲🇽', decimals: 2 },
  ARS: { name: 'Argentine Peso', symbol: '$', code: 'ARS', flag: '🇦🇷', decimals: 0 },
  BRL: { name: 'Brazilian Real', symbol: 'R$', code: 'BRL', flag: '🇧🇷', decimals: 2 },
  CLP: { name: 'Chilean Peso', symbol: '$', code: 'CLP', flag: '🇨🇱', decimals: 0 },
  PEN: { name: 'Peruvian Sol', symbol: 'S/', code: 'PEN', flag: '🇵🇪', decimals: 2 },
  UYU: { name: 'Uruguayan Peso', symbol: '$', code: 'UYU', flag: '🇺🇾', decimals: 0 },
  JPY: { name: 'Japanese Yen', symbol: '¥', code: 'JPY', flag: '🇯🇵', decimals: 0 },
  KRW: { name: 'South Korean Won', symbol: '₩', code: 'KRW', flag: '🇰🇷', decimals: 0 },
  CNY: { name: 'Chinese Yuan', symbol: '¥', code: 'CNY', flag: '🇨🇳', decimals: 2 },
  INR: { name: 'Indian Rupee', symbol: '₹', code: 'INR', flag: '🇮🇳', decimals: 0 },
  SGD: { name: 'Singapore Dollar', symbol: '$', code: 'SGD', flag: '🇸🇬', decimals: 2 },
  HKD: { name: 'Hong Kong Dollar', symbol: '$', code: 'HKD', flag: '🇭🇰', decimals: 2 },
  ZAR: { name: 'South African Rand', symbol: 'R', code: 'ZAR', flag: '🇿🇦', decimals: 2 },
  NGN: { name: 'Nigerian Naira', symbol: '₦', code: 'NGN', flag: '🇳🇬', decimals: 0 },
  EGP: { name: 'Egyptian Pound', symbol: '£', code: 'EGP', flag: '🇪🇬', decimals: 2 },
  MAD: { name: 'Moroccan Dirham', symbol: 'د.م.', code: 'MAD', flag: '🇲🇦', decimals: 2 },
};

// Utility function to format currency
export const formatCurrency = (
  amount: number,
  currency: SupportedCurrency,
  options: {
    showCode?: boolean;
    showFlag?: boolean;
  } = {}
): string => {
  const { showCode = false, showFlag = false } = options;
  const info = CURRENCY_INFO[currency];
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  }).format(amount);
  
  let result = formatted;
  
  if (showFlag) {
    result = `${info.flag} ${result}`;
  }
  
  if (showCode && currency !== 'USD') {
    result = `${result} ${currency}`;
  }
  
  return result;
};