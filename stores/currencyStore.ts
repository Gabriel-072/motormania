// stores/currencyStore.ts - MINIMAL PATCH FOR EXISTING STRUCTURE
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  SupportedCurrency, 
  exchangeRateService, 
  formatCurrency,
  CURRENCY_INFO 
} from '@/lib/services/exchangeRateService';

// Simple detection function using your existing structure
const detectCurrencyFromLocation = async (): Promise<SupportedCurrency> => {
  try {
    // Try multiple detection methods quickly
    const methods = [
      async () => {
        const response = await fetch('/api/geo/cloudflare');
        if (response.ok) {
          const data = await response.json();
          if (data.country) {
            const countryMap: Record<string, SupportedCurrency> = {
              'US': 'USD', 'CA': 'CAD', 'MX': 'MXN', 'CO': 'COP',
              'AR': 'ARS', 'BR': 'BRL', 'CL': 'CLP', 'PE': 'PEN', 'UY': 'UYU',
              'GB': 'GBP', 'DE': 'EUR', 'FR': 'EUR', 'ES': 'EUR', 'IT': 'EUR',
              'AU': 'AUD', 'NZ': 'NZD', 'JP': 'JPY', 'KR': 'KRW', 'CN': 'CNY',
              'IN': 'INR', 'SG': 'SGD', 'HK': 'HKD', 'ZA': 'ZAR', 'NG': 'NGN',
              'EG': 'EGP', 'MA': 'MAD'
            };
            return countryMap[data.country.toUpperCase()];
          }
        }
        return null;
      },
      async () => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timezoneMap: Record<string, SupportedCurrency> = {
          'America/New_York': 'USD', 'America/Chicago': 'USD', 'America/Los_Angeles': 'USD',
          'America/Toronto': 'CAD', 'America/Mexico_City': 'MXN', 'America/Bogota': 'COP',
          'America/Argentina/Buenos_Aires': 'ARS', 'America/Sao_Paulo': 'BRL',
          'Europe/London': 'GBP', 'Europe/Berlin': 'EUR', 'Europe/Paris': 'EUR',
          'Australia/Sydney': 'AUD', 'Asia/Tokyo': 'JPY', 'Asia/Seoul': 'KRW'
        };
        return timezoneMap[timezone] || null;
      }
    ];

    for (const method of methods) {
      try {
        const result = await Promise.race([
          method(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        if (result) return result;
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.warn('Currency detection failed:', e);
  }
  
  return 'COP'; // Default fallback
};

interface CurrencyState {
  // Current state
  currency: SupportedCurrency;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Detection info (simplified)
  detectionInfo: { currency: SupportedCurrency; method: string } | null;
  ratesInfo: { lastUpdated: string; source: string } | null;
  
  // Actions
  setCurrency: (currency: SupportedCurrency) => void;
  initializeCurrency: () => Promise<void>;
  refreshRates: () => Promise<void>;
  
  // Conversion utilities
  convertFromCOP: (copAmount: number) => number;
  convertToCOP: (amount: number) => number;
  formatAmount: (copAmount: number, options?: { showCode?: boolean; showFlag?: boolean }) => string;
  
  // UI helpers
  getCurrencyInfo: () => typeof CURRENCY_INFO[SupportedCurrency];
  getMinimumBet: () => { cop: number; display: number; formatted: string };
}

const STORAGE_KEY = 'mmc-currency-preference';

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      // Initial state
      currency: 'COP', // Start with COP as default
      isLoading: false,
      isInitialized: false,
      detectionInfo: null,
      ratesInfo: null,

      // Set currency (user choice)
      setCurrency: (currency: SupportedCurrency) => {
        console.log(`💱 User selected currency: ${currency}`);
        set({ currency });
      },

      // Initialize currency with detection
      initializeCurrency: async () => {
        const state = get();
        if (state.isInitialized) return;
        
        set({ isLoading: true });
        
        try {
          console.log('🚀 Initializing currency system...');
          
          // Detect currency
          const detectedCurrency = await detectCurrencyFromLocation();
          console.log(`🎯 Detected currency: ${detectedCurrency}`);

          // Initialize exchange rates
          await exchangeRateService.getCurrentRates();
          const ratesInfo = exchangeRateService.getRatesInfo();
          
          set({ 
            currency: detectedCurrency,
            detectionInfo: { currency: detectedCurrency, method: 'auto' },
            ratesInfo,
            isInitialized: true,
            isLoading: false 
          });
          
          console.log('✅ Currency system initialized successfully');
          
        } catch (error) {
          console.error('❌ Currency initialization failed:', error);
          
          // Fallback to COP
          set({ 
            currency: 'COP',
            isInitialized: true,
            isLoading: false,
            detectionInfo: { currency: 'COP', method: 'fallback' }
          });
        }
      },

      // Refresh exchange rates
      refreshRates: async () => {
        try {
          console.log('🔄 Refreshing exchange rates...');
          await exchangeRateService.refreshRates();
          
          const ratesInfo = exchangeRateService.getRatesInfo();
          set({ ratesInfo });
          
          console.log('✅ Exchange rates refreshed');
        } catch (error) {
          console.error('❌ Failed to refresh rates:', error);
        }
      },

      // Convert COP to display currency
      convertFromCOP: (copAmount: number) => {
        const { currency } = get();
        if (currency === 'COP') return copAmount;
        return exchangeRateService.convertFromCOP(copAmount, currency);
      },

      // Convert display currency back to COP
      convertToCOP: (amount: number) => {
        const { currency } = get();
        if (currency === 'COP') return amount;
        return exchangeRateService.convertToCOP(amount, currency);
      },

      // Format amount in display currency
      formatAmount: (copAmount: number, options = {}) => {
        const { currency, convertFromCOP } = get();
        const convertedAmount = convertFromCOP(copAmount);
        return formatCurrency(convertedAmount, currency, options);
      },

      // Get current currency info
      getCurrencyInfo: () => {
        const { currency } = get();
        return CURRENCY_INFO[currency];
      },

      // Get minimum bet in current currency
      getMinimumBet: () => {
        const { currency, convertFromCOP } = get();
        const copAmount = 2000; // Minimum bet in COP
        
        if (currency === 'COP') {
          return {
            cop: copAmount,
            display: copAmount,
            formatted: formatCurrency(copAmount, currency)
          };
        }
        
        const displayAmount = convertFromCOP(copAmount);
        const roundedAmount = Math.max(1, Math.ceil(displayAmount));
        
        return {
          cop: copAmount,
          display: roundedAmount,
          formatted: formatCurrency(roundedAmount, currency)
        };
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ 
        currency: state.currency,
        isInitialized: state.isInitialized 
      }),
    }
  )
);

// Keep your existing hook structure
export const useCurrencyInfo = () => {
  const { currency, getCurrencyInfo, getMinimumBet, detectionInfo, ratesInfo, isInitialized, isLoading } = useCurrencyStore();
  
  return {
    currency,
    currencyInfo: getCurrencyInfo(),
    minimumBet: getMinimumBet(),
    detectionInfo,
    ratesInfo,
    isInitialized,
    isLoading, // Add this missing property
  };
};

// Add these missing exports that your components expect
export const useCurrencyConverter = () => {
  const { convertFromCOP, convertToCOP, formatAmount } = useCurrencyStore();
  
  return {
    convertFromCOP,
    convertToCOP,
    formatAmount,
    
    // Quick format for common use cases
    formatCOP: (copAmount: number) => formatAmount(copAmount),
    formatCOPWithCode: (copAmount: number) => formatAmount(copAmount, { showCode: true }),
    formatCOPWithFlag: (copAmount: number) => formatAmount(copAmount, { showFlag: true }),
  };
};